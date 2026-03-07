use serde::{Deserialize, Serialize};

/// History entry structure
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct HistoryEntry {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub filepath: String,
    pub filesize: Option<u64>,
    pub duration: Option<u64>,
    pub quality: Option<String>,
    pub format: Option<String>,
    pub source: Option<String>, // "youtube", "tiktok", etc.
    pub downloaded_at: String,
    pub file_exists: bool,
    pub summary: Option<String>,    // AI-generated summary
    pub time_range: Option<String>, // Time range cut (e.g. "00:10-01:00")
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum HistorySort {
    #[default]
    Recent,
    Oldest,
    Title,
    Size,
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryMediaType {
    All,
    Video,
    Audio,
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryAdvancedFilters {
    pub media_type: Option<HistoryMediaType>,
    pub downloaded_at_from: Option<i64>,
    pub downloaded_at_to: Option<i64>,
    pub formats: Option<Vec<String>>,
    pub qualities: Option<Vec<String>>,
}
