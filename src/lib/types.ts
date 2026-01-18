export type Quality = 'best' | '1080' | '720' | '480' | '360' | 'audio';
export type Format = 'mp4' | 'mkv' | 'webm' | 'mp3';

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  speed: string;
  eta: string;
  error?: string;
  isPlaylist?: boolean;
  playlistIndex?: number;
  playlistTotal?: number;
}

export interface DownloadSettings {
  quality: Quality;
  format: Format;
  outputPath: string;
  downloadPlaylist: boolean;
}

export interface DownloadProgress {
  id: string;
  percent: number;
  speed: string;
  eta: string;
  status: string;
  title?: string;
  playlist_index?: number;
  playlist_count?: number;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  entries: PlaylistEntry[];
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration?: number;
}
