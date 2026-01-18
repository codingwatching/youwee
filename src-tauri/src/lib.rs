use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
struct DownloadProgress {
    id: String,
    percent: f64,
    speed: String,
    eta: String,
    status: String,
    title: Option<String>,
    playlist_index: Option<u32>,
    playlist_count: Option<u32>,
}

#[derive(Clone, Serialize, Deserialize)]
#[allow(dead_code)]
struct PlaylistEntry {
    id: String,
    title: String,
    url: String,
}

#[derive(Clone, Serialize)]
#[allow(dead_code)]
struct PlaylistInfo {
    entries: Vec<PlaylistEntry>,
    title: String,
}

fn build_format_string(quality: &str, format: &str) -> String {
    if quality == "audio" || format == "mp3" {
        return "bestaudio[ext=m4a]/bestaudio/best".to_string();
    }
    
    let height = match quality {
        "1080" => Some("1080"),
        "720" => Some("720"),
        "480" => Some("480"),
        "360" => Some("360"),
        _ => None,
    };
    
    if format == "mp4" {
        if let Some(h) = height {
            format!("bestvideo[height<={}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={}]+bestaudio/best[height<={}]/best", h, h, h)
        } else {
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best".to_string()
        }
    } else if let Some(h) = height {
        format!("bestvideo[height<={}]+bestaudio/best[height<={}]/best", h, h)
    } else {
        "bestvideo+bestaudio/best".to_string()
    }
}

fn parse_progress(line: &str) -> Option<(f64, String, String, Option<u32>, Option<u32>)> {
    let mut playlist_index: Option<u32> = None;
    let mut playlist_count: Option<u32> = None;
    
    // Check for playlist progress
    if line.contains("Downloading item") {
        let re = regex::Regex::new(r"Downloading item (\d+) of (\d+)").ok()?;
        if let Some(caps) = re.captures(line) {
            playlist_index = caps.get(1).and_then(|m| m.as_str().parse().ok());
            playlist_count = caps.get(2).and_then(|m| m.as_str().parse().ok());
        }
    }
    
    if line.contains("[download]") && line.contains("%") {
        let re = regex::Regex::new(r"(\d+\.?\d*)%.*?(?:at\s+(\S+))?.*?(?:ETA\s+(\S+))?").ok()?;
        if let Some(caps) = re.captures(line) {
            let percent: f64 = caps.get(1)?.as_str().parse().ok()?;
            let speed = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
            let eta = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_default();
            return Some((percent, speed, eta, playlist_index, playlist_count));
        }
    }
    
    None
}

/// Kill all yt-dlp and ffmpeg processes
fn kill_all_download_processes() {
    #[cfg(unix)]
    {
        use std::process::Command as StdCommand;
        // Kill all yt-dlp processes
        StdCommand::new("pkill")
            .args(["-9", "-f", "yt-dlp"])
            .spawn()
            .ok();
        // Kill all ffmpeg processes (yt-dlp spawns these)
        StdCommand::new("pkill")
            .args(["-9", "-f", "ffmpeg"])
            .spawn()
            .ok();
    }
    #[cfg(windows)]
    {
        use std::process::Command as StdCommand;
        StdCommand::new("taskkill")
            .args(["/F", "/IM", "yt-dlp.exe"])
            .spawn()
            .ok();
        StdCommand::new("taskkill")
            .args(["/F", "/IM", "ffmpeg.exe"])
            .spawn()
            .ok();
    }
}

#[tauri::command]
async fn download_video(
    app: AppHandle,
    id: String,
    url: String,
    output_path: String,
    quality: String,
    format: String,
    download_playlist: bool,
) -> Result<(), String> {
    CANCEL_FLAG.store(false, Ordering::SeqCst);
    
    let format_string = build_format_string(&quality, &format);
    let output_template = format!("{}/%(title)s.%(ext)s", output_path);
    
    let mut args = vec![
        "--newline".to_string(),
        "-f".to_string(),
        format_string,
        "-o".to_string(),
        output_template,
    ];
    
    // Handle playlist option
    if !download_playlist {
        args.push("--no-playlist".to_string());
    }
    
    // Set merge output format
    if format != "mp3" {
        args.push("--merge-output-format".to_string());
        args.push(format.clone());
    }
    
    // For MP3, extract audio
    if format == "mp3" {
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
    }
    
    args.push(url);
    
    // Try to use bundled sidecar first, fallback to system yt-dlp
    let sidecar_result = app.shell().sidecar("yt-dlp");
    
    match sidecar_result {
        Ok(sidecar) => {
            let (mut rx, child) = sidecar
                .args(&args)
                .spawn()
                .map_err(|e| format!("Failed to start bundled yt-dlp: {}", e))?;
            
            let mut current_title: Option<String> = None;
            let mut current_index: Option<u32> = None;
            let mut total_count: Option<u32> = None;
            
            while let Some(event) = rx.recv().await {
                // Check cancel flag first
                if CANCEL_FLAG.load(Ordering::SeqCst) {
                    child.kill().ok();
                    kill_all_download_processes();
                    return Err("Download cancelled".to_string());
                }
                
                match event {
                    CommandEvent::Stdout(line_bytes) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        
                        // Check for playlist item info
                        if line.contains("Downloading item") {
                            let re = regex::Regex::new(r"Downloading item (\d+) of (\d+)").ok();
                            if let Some(re) = re {
                                if let Some(caps) = re.captures(&line) {
                                    current_index = caps.get(1).and_then(|m| m.as_str().parse().ok());
                                    total_count = caps.get(2).and_then(|m| m.as_str().parse().ok());
                                }
                            }
                        }
                        
                        // Extract video title from output
                        if line.contains("[download] Destination:") || line.contains("[ExtractAudio]") {
                            if let Some(start) = line.rfind('/') {
                                let filename = &line[start + 1..];
                                if let Some(end) = filename.rfind('.') {
                                    current_title = Some(filename[..end].to_string());
                                }
                            }
                        }
                        
                        if let Some((percent, speed, eta, pi, pc)) = parse_progress(&line) {
                            if pi.is_some() { current_index = pi; }
                            if pc.is_some() { total_count = pc; }
                            
                            let progress = DownloadProgress {
                                id: id.clone(),
                                percent,
                                speed,
                                eta,
                                status: "downloading".to_string(),
                                title: current_title.clone(),
                                playlist_index: current_index,
                                playlist_count: total_count,
                            };
                            app.emit("download-progress", progress).ok();
                        }
                    }
                    CommandEvent::Stderr(_) => {}
                    CommandEvent::Error(err) => {
                        return Err(format!("Process error: {}", err));
                    }
                    CommandEvent::Terminated(status) => {
                        if CANCEL_FLAG.load(Ordering::SeqCst) {
                            return Err("Download cancelled".to_string());
                        }
                        
                        if status.code == Some(0) {
                            let progress = DownloadProgress {
                                id: id.clone(),
                                percent: 100.0,
                                speed: String::new(),
                                eta: String::new(),
                                status: "finished".to_string(),
                                title: current_title.clone(),
                                playlist_index: current_index,
                                playlist_count: total_count,
                            };
                            app.emit("download-progress", progress).ok();
                            return Ok(());
                        } else {
                            return Err("Download failed".to_string());
                        }
                    }
                    _ => {}
                }
            }
            Ok(())
        }
        Err(_) => {
            // Fallback to system yt-dlp using tokio
            let process = Command::new("yt-dlp")
                .args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start yt-dlp: {}. Please install yt-dlp: brew install yt-dlp", e))?;
            
            handle_tokio_download(app, id, process).await
        }
    }
}

async fn handle_tokio_download(
    app: AppHandle,
    id: String,
    mut process: tokio::process::Child,
) -> Result<(), String> {
    let stdout = process.stdout.take().ok_or("Failed to get stdout")?;
    let mut reader = BufReader::new(stdout).lines();
    
    let mut current_title: Option<String> = None;
    let mut current_index: Option<u32> = None;
    let mut total_count: Option<u32> = None;
    
    while let Ok(Some(line)) = reader.next_line().await {
        if CANCEL_FLAG.load(Ordering::SeqCst) {
            process.kill().await.ok();
            kill_all_download_processes();
            return Err("Download cancelled".to_string());
        }
        
        // Check for playlist item info
        if line.contains("Downloading item") {
            let re = regex::Regex::new(r"Downloading item (\d+) of (\d+)").ok();
            if let Some(re) = re {
                if let Some(caps) = re.captures(&line) {
                    current_index = caps.get(1).and_then(|m| m.as_str().parse().ok());
                    total_count = caps.get(2).and_then(|m| m.as_str().parse().ok());
                }
            }
        }
        
        // Extract video title from output
        if line.contains("[download] Destination:") {
            if let Some(start) = line.rfind('/') {
                let filename = &line[start + 1..];
                if let Some(end) = filename.rfind('.') {
                    current_title = Some(filename[..end].to_string());
                }
            }
        }
        
        if let Some((percent, speed, eta, pi, pc)) = parse_progress(&line) {
            if pi.is_some() { current_index = pi; }
            if pc.is_some() { total_count = pc; }
            
            let progress = DownloadProgress {
                id: id.clone(),
                percent,
                speed,
                eta,
                status: "downloading".to_string(),
                title: current_title.clone(),
                playlist_index: current_index,
                playlist_count: total_count,
            };
            app.emit("download-progress", progress).ok();
        }
    }
    
    let status = process.wait().await.map_err(|e| format!("Process error: {}", e))?;
    
    if CANCEL_FLAG.load(Ordering::SeqCst) {
        return Err("Download cancelled".to_string());
    }
    
    if status.success() {
        let progress = DownloadProgress {
            id: id.clone(),
            percent: 100.0,
            speed: String::new(),
            eta: String::new(),
            status: "finished".to_string(),
            title: current_title,
            playlist_index: current_index,
            playlist_count: total_count,
        };
        app.emit("download-progress", progress).ok();
        Ok(())
    } else {
        Err("Download failed".to_string())
    }
}

#[tauri::command]
async fn stop_download() -> Result<(), String> {
    // Set cancel flag
    CANCEL_FLAG.store(true, Ordering::SeqCst);
    
    // Kill all yt-dlp and ffmpeg processes immediately
    kill_all_download_processes();
    
    // Wait a bit and kill again to make sure
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    kill_all_download_processes();
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![download_video, stop_download])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
