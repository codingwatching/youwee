use std::path::Path;
use std::io::Cursor;

/// Extract binary from tar.gz archive
pub async fn extract_tar_gz(data: &[u8], dest_dir: &Path, target_binary: &str) -> Result<(), String> {
    use flate2::read::GzDecoder;
    use tar::Archive;
    
    let decoder = GzDecoder::new(Cursor::new(data));
    let mut archive = Archive::new(decoder);
    
    for entry in archive.entries().map_err(|e| format!("Failed to read tar: {}", e))? {
        let mut entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path().map_err(|e| format!("Failed to get path: {}", e))?.to_path_buf();
        
        // Look for ffmpeg/ffprobe binaries
        if let Some(name) = path.file_name() {
            let name_str = name.to_string_lossy();
            if name_str == target_binary || name_str == "ffprobe" {
                let dest_path = dest_dir.join(&*name_str);
                entry.unpack(&dest_path)
                    .map_err(|e| format!("Failed to extract {}: {}", name_str, e))?;
            }
        }
    }
    
    Ok(())
}

/// Extract binary from tar.xz archive
pub async fn extract_tar_xz(data: &[u8], dest_dir: &Path, target_binary: &str) -> Result<(), String> {
    use xz2::read::XzDecoder;
    use tar::Archive;
    
    let decoder = XzDecoder::new(Cursor::new(data));
    let mut archive = Archive::new(decoder);
    
    for entry in archive.entries().map_err(|e| format!("Failed to read tar: {}", e))? {
        let mut entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path().map_err(|e| format!("Failed to get path: {}", e))?.to_path_buf();
        
        if let Some(name) = path.file_name() {
            let name_str = name.to_string_lossy();
            if name_str == target_binary || name_str == "ffprobe" {
                let dest_path = dest_dir.join(&*name_str);
                entry.unpack(&dest_path)
                    .map_err(|e| format!("Failed to extract {}: {}", name_str, e))?;
            }
        }
    }
    
    Ok(())
}

/// Extract binary from zip archive
pub async fn extract_zip(data: &[u8], dest_dir: &Path, target_binary: &str) -> Result<(), String> {
    use zip::ZipArchive;
    
    let cursor = Cursor::new(data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;
        
        let name = file.name().to_string();
        
        // Look for ffmpeg/ffprobe binaries
        if name.ends_with(target_binary) || name.ends_with("ffprobe") || name.ends_with("ffprobe.exe") {
            let file_name = Path::new(&name).file_name()
                .ok_or_else(|| "Invalid file name".to_string())?;
            let dest_path = dest_dir.join(file_name);
            
            let mut outfile = std::fs::File::create(&dest_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract: {}", e))?;
        }
    }
    
    Ok(())
}

/// Extract bun binary from zip archive
pub async fn extract_bun_from_zip(data: &[u8], dest_dir: &Path, target_binary: &str) -> Result<(), String> {
    use zip::ZipArchive;
    
    let cursor = Cursor::new(data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;
        
        let name = file.name().to_string();
        
        // Look for bun binary - it's usually in a folder like bun-darwin-aarch64/bun
        #[cfg(windows)]
        let is_bun = name.ends_with("/bun.exe") || name == "bun.exe";
        #[cfg(not(windows))]
        let is_bun = (name.ends_with("/bun") || name == "bun") && !name.ends_with(".dSYM/bun");
        
        if is_bun {
            let dest_path = dest_dir.join(target_binary);
            let mut outfile = std::fs::File::create(&dest_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract: {}", e))?;
            return Ok(());
        }
    }
    
    Err("Bun binary not found in archive".to_string())
}
