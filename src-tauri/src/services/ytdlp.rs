use std::process::Stdio;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tokio::process::Command;
use crate::types::YtdlpVersionInfo;

/// Helper to run yt-dlp command and get JSON output
pub async fn run_ytdlp_json(app: &AppHandle, args: &[&str]) -> Result<String, String> {
    let sidecar_result = app.shell().sidecar("yt-dlp");
    
    match sidecar_result {
        Ok(sidecar) => {
            let (mut rx, _child) = sidecar
                .args(args)
                .spawn()
                .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;
            
            let mut output = String::new();
            
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => {
                        output.push_str(&String::from_utf8_lossy(&bytes));
                    }
                    CommandEvent::Stderr(_) => {}
                    CommandEvent::Error(err) => {
                        return Err(format!("Process error: {}", err));
                    }
                    CommandEvent::Terminated(status) => {
                        if status.code != Some(0) {
                            return Err("yt-dlp command failed".to_string());
                        }
                    }
                    _ => {}
                }
            }
            
            Ok(output)
        }
        Err(_) => {
            // Fallback to system yt-dlp
            let output = Command::new("yt-dlp")
                .args(args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await
                .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
            
            if !output.status.success() {
                return Err("yt-dlp command failed".to_string());
            }
            
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
    }
}

/// Get yt-dlp version
pub async fn get_ytdlp_version_internal(app: &AppHandle) -> Result<YtdlpVersionInfo, String> {
    let sidecar_result = app.shell().sidecar("yt-dlp");
    
    let (version, is_bundled, binary_path) = match sidecar_result {
        Ok(sidecar) => {
            let (mut rx, _child) = sidecar
                .args(["--version"])
                .spawn()
                .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;
            
            let mut output = String::new();
            while let Some(event) = rx.recv().await {
                if let CommandEvent::Stdout(bytes) = event {
                    output.push_str(&String::from_utf8_lossy(&bytes));
                }
            }
            
            let version = output.trim().to_string();
            let resource_dir = app.path().resource_dir().ok();
            let bin_path = resource_dir
                .map(|p| p.join("bin").join("yt-dlp").to_string_lossy().to_string())
                .unwrap_or_else(|| "bundled".to_string());
            
            (version, true, bin_path)
        }
        Err(_) => {
            let output = Command::new("yt-dlp")
                .args(["--version"])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await
                .map_err(|e| format!("yt-dlp not found: {}", e))?;
            
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let which_output = Command::new("which")
                .arg("yt-dlp")
                .output()
                .await
                .ok();
            
            let bin_path = which_output
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_else(|| "system".to_string());
            
            (version, false, bin_path)
        }
    };
    
    Ok(YtdlpVersionInfo {
        version,
        latest_version: None,
        update_available: false,
        is_bundled,
        binary_path,
    })
}

/// Get the appropriate download URL and binary name for current platform
pub fn get_ytdlp_download_info() -> (&'static str, &'static str, &'static str) {
    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        { ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos", "yt-dlp", "yt-dlp_macos") }
        #[cfg(target_arch = "x86_64")]
        { ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos_legacy", "yt-dlp", "yt-dlp_macos_legacy") }
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
        { ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos", "yt-dlp", "yt-dlp_macos") }
    }
    #[cfg(target_os = "linux")]
    { ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux", "yt-dlp", "yt-dlp_linux") }
    #[cfg(target_os = "windows")]
    { ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", "yt-dlp.exe", "yt-dlp.exe") }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    { ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp", "yt-dlp", "yt-dlp") }
}

/// Verify SHA256 checksum
pub fn verify_sha256(data: &[u8], expected_hash: &str) -> bool {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let computed_hash = hex::encode(result);
    computed_hash.eq_ignore_ascii_case(expected_hash)
}
