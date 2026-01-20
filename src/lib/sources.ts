import type { SourcePlatform } from './types';

export interface SourceInfo {
  platform: SourcePlatform;
  icon: string;
  color: string;
  label: string;
}

const SOURCE_MAP: Record<string, SourceInfo> = {
  youtube: { 
    platform: 'youtube', 
    icon: '📺', 
    color: 'text-red-500', 
    label: 'YouTube' 
  },
  tiktok: { 
    platform: 'tiktok', 
    icon: '🎵', 
    color: 'text-pink-500', 
    label: 'TikTok' 
  },
  instagram: { 
    platform: 'instagram', 
    icon: '📷', 
    color: 'text-purple-500', 
    label: 'Instagram' 
  },
  twitter: { 
    platform: 'twitter', 
    icon: '𝕏', 
    color: 'text-foreground', 
    label: 'X/Twitter' 
  },
  facebook: { 
    platform: 'facebook', 
    icon: '📘', 
    color: 'text-blue-600', 
    label: 'Facebook' 
  },
  vimeo: { 
    platform: 'vimeo', 
    icon: '🎬', 
    color: 'text-cyan-500', 
    label: 'Vimeo' 
  },
  twitch: { 
    platform: 'twitch', 
    icon: '📺', 
    color: 'text-purple-400', 
    label: 'Twitch' 
  },
  bilibili: { 
    platform: 'bilibili', 
    icon: '📺', 
    color: 'text-pink-400', 
    label: 'Bilibili' 
  },
  soundcloud: { 
    platform: 'soundcloud', 
    icon: '🎧', 
    color: 'text-orange-500', 
    label: 'SoundCloud' 
  },
  dailymotion: { 
    platform: 'dailymotion', 
    icon: '▶️', 
    color: 'text-blue-400', 
    label: 'Dailymotion' 
  },
};

const DEFAULT_SOURCE: SourceInfo = {
  platform: 'other',
  icon: '🌐',
  color: 'text-muted-foreground',
  label: 'Video',
};

/**
 * Detect source platform from yt-dlp extractor name
 */
export function detectSource(extractor?: string): SourceInfo {
  if (!extractor) return DEFAULT_SOURCE;
  
  // Normalize extractor name (remove special chars, lowercase)
  const key = extractor.toLowerCase().replace(/[^a-z]/g, '');
  
  // Check for known platforms
  for (const [platformKey, info] of Object.entries(SOURCE_MAP)) {
    if (key.includes(platformKey)) {
      return info;
    }
  }
  
  // Return default with the original extractor name as label
  return { 
    ...DEFAULT_SOURCE, 
    label: extractor.charAt(0).toUpperCase() + extractor.slice(1) 
  };
}

/**
 * Check if URL looks like a valid HTTP/HTTPS URL
 */
export function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse URLs from text input, filtering for valid HTTP/HTTPS URLs
 */
export function parseUniversalUrls(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) return false;
      // Validate URL format
      return isValidUrl(line);
    });
}
