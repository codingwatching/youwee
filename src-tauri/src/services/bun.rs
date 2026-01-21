use std::process::Stdio;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::process::Command;
use crate::types::BunStatus;

/// Get the Bun binary path (app data or system)
pub async fn get_bun_path(app: &AppHandle) -> Option<PathBuf> {
    // First check app data directory
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let bin_dir = app_data_dir.join("bin");
        #[cfg(windows)]
        let bun_path = bin_dir.join("bun.exe");
        #[cfg(not(windows))]
        let bun_path = bin_dir.join("bun");
        
        if bun_path.exists() {
            return Some(bun_path);
        }
    }
    
    // Fallback: check if system bun is available
    #[cfg(unix)]
    {
        let output = Command::new("which")
            .arg("bun")
            .output()
            .await
            .ok()?;
        
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Some(PathBuf::from(path_str));
            }
        }
    }
    
    #[cfg(windows)]
    {
        let output = Command::new("where")
            .arg("bun")
            .output()
            .await
            .ok()?;
        
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).lines().next()?.to_string();
            if !path_str.is_empty() {
                return Some(PathBuf::from(path_str));
            }
        }
    }
    
    None
}

/// Check Bun runtime status
pub async fn check_bun_internal(app: &AppHandle) -> Result<BunStatus, String> {
    // First check app data directory
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let bin_dir = app_data_dir.join("bin");
        #[cfg(windows)]
        let bun_path = bin_dir.join("bun.exe");
        #[cfg(not(windows))]
        let bun_path = bin_dir.join("bun");
        
        if bun_path.exists() {
            let output = Command::new(&bun_path)
                .args(["--version"])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await;
            
            if let Ok(output) = output {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let version = stdout.trim().to_string();
                    return Ok(BunStatus {
                        installed: true,
                        version: Some(version),
                        binary_path: Some(bun_path.to_string_lossy().to_string()),
                        is_system: false,
                    });
                }
            }
        }
    }
    
    // Check system Bun
    let output = Command::new("bun")
        .args(["--version"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;
    
    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let version = stdout.trim().to_string();
            
            #[cfg(unix)]
            let path = Command::new("which")
                .arg("bun")
                .output()
                .await
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
            
            #[cfg(windows)]
            let path = Command::new("where")
                .arg("bun")
                .output()
                .await
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("").to_string());
            
            #[cfg(not(any(unix, windows)))]
            let path: Option<String> = None;
            
            Ok(BunStatus {
                installed: true,
                version: Some(version),
                binary_path: path,
                is_system: true,
            })
        }
        _ => Ok(BunStatus {
            installed: false,
            version: None,
            binary_path: None,
            is_system: false,
        }),
    }
}

/// Get Bun download URL for current platform
pub fn get_bun_download_url() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        { "https://github.com/oven-sh/bun/releases/latest/download/bun-darwin-aarch64.zip" }
        #[cfg(target_arch = "x86_64")]
        { "https://github.com/oven-sh/bun/releases/latest/download/bun-darwin-x64.zip" }
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
        { "https://github.com/oven-sh/bun/releases/latest/download/bun-darwin-aarch64.zip" }
    }
    #[cfg(target_os = "windows")]
    { "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip" }
    #[cfg(target_os = "linux")]
    {
        #[cfg(target_arch = "aarch64")]
        { "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-aarch64.zip" }
        #[cfg(target_arch = "x86_64")]
        { "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip" }
        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
        { "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip" }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    { "" }
}
