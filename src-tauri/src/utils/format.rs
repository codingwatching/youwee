/// Format file size in human readable format
pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    
    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Build yt-dlp format string based on quality, format and codec preferences
pub fn build_format_string(quality: &str, format: &str, video_codec: &str) -> String {
    // Audio-only formats
    if quality == "audio" || format == "mp3" || format == "m4a" || format == "opus" {
        return match format {
            "mp3" => "bestaudio/best".to_string(),
            "m4a" => "bestaudio[ext=m4a]/bestaudio/best".to_string(),
            "opus" => "bestaudio[ext=webm]/bestaudio/best".to_string(),
            _ => "bestaudio[ext=m4a]/bestaudio/best".to_string(),
        };
    }
    
    let height = match quality {
        "8k" => Some("4320"),
        "4k" => Some("2160"),
        "2k" => Some("1440"),
        "1080" => Some("1080"),
        "720" => Some("720"),
        "480" => Some("480"),
        "360" => Some("360"),
        _ => None,
    };
    
    // Build codec filter based on selection
    let is_high_res = matches!(quality, "8k" | "4k" | "2k");
    let codec_filter = if is_high_res {
        "[vcodec^=vp9]" // Prefer VP9 for high-res
    } else {
        match video_codec {
            "h264" => "[vcodec^=avc]",
            "vp9" => "[vcodec^=vp9]",
            "av1" => "[vcodec^=av01]",
            _ => "", // auto - no codec filter
        }
    };
    
    if format == "mp4" {
        if let Some(h) = height {
            if is_high_res {
                format!(
                    "bestvideo[height<={}][vcodec^=vp9]+bestaudio/bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                    h, h, h
                )
            } else if !codec_filter.is_empty() {
                format!(
                    "bestvideo[height<={}]{}[ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={}]{}+bestaudio/bestvideo[height<={}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                    h, codec_filter, h, codec_filter, h, h, h
                )
            } else {
                format!(
                    "bestvideo[height<={}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                    h, h, h
                )
            }
        } else {
            "bestvideo[vcodec^=vp9]+bestaudio/bestvideo+bestaudio/best".to_string()
        }
    } else if let Some(h) = height {
        if is_high_res {
            format!(
                "bestvideo[height<={}][vcodec^=vp9]+bestaudio/bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                h, h, h
            )
        } else if !codec_filter.is_empty() {
            format!(
                "bestvideo[height<={}]{}+bestaudio/bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                h, codec_filter, h, h
            )
        } else {
            format!("bestvideo[height<={}]+bestaudio/best[height<={}]/best", h, h)
        }
    } else {
        "bestvideo[vcodec^=vp9]+bestaudio/bestvideo+bestaudio/best".to_string()
    }
}
