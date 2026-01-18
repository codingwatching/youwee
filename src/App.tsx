import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { downloadDir } from '@tauri-apps/api/path';
import { 
  Download, 
  FolderOpen, 
  Play, 
  Square, 
  Trash2, 
  Plus,
  Youtube,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  FileVideo,
  Music,
  Settings2,
  Moon,
  Sun,
  ListVideo
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import type { DownloadItem, DownloadSettings, DownloadProgress, Quality, Format } from '@/lib/types';
import { cn } from '@/lib/utils';

const qualityOptions: { value: Quality; label: string; icon?: React.ReactNode }[] = [
  { value: 'best', label: 'Best Available' },
  { value: '1080', label: '1080p Full HD' },
  { value: '720', label: '720p HD' },
  { value: '480', label: '480p SD' },
  { value: '360', label: '360p Low' },
  { value: 'audio', label: 'Audio Only', icon: <Music className="w-4 h-4" /> },
];

const formatOptions: { value: Format; label: string; icon: React.ReactNode }[] = [
  { value: 'mp4', label: 'MP4', icon: <FileVideo className="w-4 h-4" /> },
  { value: 'mkv', label: 'MKV', icon: <FileVideo className="w-4 h-4" /> },
  { value: 'webm', label: 'WebM', icon: <FileVideo className="w-4 h-4" /> },
  { value: 'mp3', label: 'MP3', icon: <Music className="w-4 h-4" /> },
];

function App() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [settings, setSettings] = useState<DownloadSettings>({
    quality: 'best',
    format: 'mp4',
    outputPath: '',
    downloadPlaylist: false,
  });
  const [currentPlaylistInfo, setCurrentPlaylistInfo] = useState<{
    index: number;
    total: number;
    title: string;
  } | null>(null);
  const isDownloadingRef = useRef(false);

  // Toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Get default download path on mount
  useEffect(() => {
    const getDefaultPath = async () => {
      try {
        const path = await downloadDir();
        setSettings(s => ({ ...s, outputPath: path }));
      } catch (error) {
        console.error('Failed to get download directory:', error);
      }
    };
    getDefaultPath();
  }, []);

  // Listen for progress updates from Rust backend
  useEffect(() => {
    const unlisten = listen<DownloadProgress>('download-progress', (event) => {
      const progress = event.payload;
      
      // Update playlist info if available
      if (progress.playlist_index && progress.playlist_count) {
        setCurrentPlaylistInfo({
          index: progress.playlist_index,
          total: progress.playlist_count,
          title: progress.title || '',
        });
      }
      
      setItems(items => items.map(item => 
        item.id === progress.id 
          ? { 
              ...item, 
              progress: progress.percent,
              speed: progress.speed,
              eta: progress.eta,
              title: progress.title || item.title,
              status: progress.status === 'finished' ? 'completed' : 
                      progress.status === 'error' ? 'error' : 'downloading',
              playlistIndex: progress.playlist_index,
              playlistTotal: progress.playlist_count,
            }
          : item
      ));
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleAddUrls = () => {
    const urls = urlInput
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0 && (url.includes('youtube.com') || url.includes('youtu.be')));
    
    if (urls.length === 0) return;

    const newItems: DownloadItem[] = urls
      .filter(url => !items.some(item => item.url === url))
      .map(url => {
        // Check if URL contains playlist
        const hasPlaylist = url.includes('list=');
        return {
          id: crypto.randomUUID(),
          url,
          title: url,
          status: 'pending' as const,
          progress: 0,
          speed: '',
          eta: '',
          isPlaylist: hasPlaylist,
        };
      });
    
    setItems([...items, ...newItems]);
    setUrlInput('');
  };

  const handleSelectFolder = async () => {
    try {
      const folder = await open({
        directory: true,
        multiple: false,
        title: 'Select Download Folder',
      });
      
      if (folder) {
        setSettings({ ...settings, outputPath: folder as string });
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleRemove = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleClear = () => {
    setItems([]);
    setCurrentPlaylistInfo(null);
  };

  const handleStart = async () => {
    if (items.length === 0) return;
    
    setIsDownloading(true);
    isDownloadingRef.current = true;
    setCurrentPlaylistInfo(null);
    
    // Reset all items to pending
    setItems(items => items.map(item => ({
      ...item,
      status: 'pending' as const,
      progress: 0,
      speed: '',
      eta: '',
      error: undefined,
      playlistIndex: undefined,
      playlistTotal: undefined,
    })));

    try {
      for (const item of items) {
        if (!isDownloadingRef.current) break;
        
        setItems(items => items.map(i => 
          i.id === item.id ? { ...i, status: 'downloading' } : i
        ));

        try {
          await invoke('download_video', {
            id: item.id,
            url: item.url,
            outputPath: settings.outputPath,
            quality: settings.quality,
            format: settings.format,
            downloadPlaylist: settings.downloadPlaylist,
          });
          
          setItems(items => items.map(i => 
            i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i
          ));
        } catch (error) {
          setItems(items => items.map(i => 
            i.id === item.id ? { ...i, status: 'error', error: String(error) } : i
          ));
        }
      }
    } finally {
      setIsDownloading(false);
      isDownloadingRef.current = false;
      setCurrentPlaylistInfo(null);
    }
  };

  const handleStop = async () => {
    try {
      await invoke('stop_download');
    } catch (error) {
      console.error('Failed to stop download:', error);
    }
    setIsDownloading(false);
    isDownloadingRef.current = false;
    setCurrentPlaylistInfo(null);
  };

  const getStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'downloading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (item: DownloadItem) => {
    switch (item.status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'downloading':
        if (item.playlistIndex && item.playlistTotal) {
          return (
            <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
              {item.playlistIndex}/{item.playlistTotal}
            </Badge>
          );
        }
        return <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Downloading</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const completedCount = items.filter(i => i.status === 'completed').length;
  const totalCount = items.length;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-background/80 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">YouTube Downloader</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 py-6 space-y-4">
        {/* URL Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Videos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste YouTube URLs here (one per line)&#10;https://www.youtube.com/watch?v=...&#10;https://youtu.be/...?list=... (playlist URL)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isDownloading}
              className="min-h-[100px] resize-none font-mono text-sm"
            />
            <Button 
              onClick={handleAddUrls} 
              disabled={isDownloading || !urlInput.trim()}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Queue
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Download Settings
                  </div>
                  <div className="flex items-center gap-2">
                    {settings.downloadPlaylist && (
                      <Badge variant="outline" className="font-normal bg-purple-500/10 text-purple-500 border-purple-500/20">
                        <ListVideo className="w-3 h-3 mr-1" />
                        Playlist
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-normal">
                      {settings.quality === 'best' ? 'Best' : settings.quality} • {settings.format.toUpperCase()}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                  {/* Quality */}
                  <div className="space-y-2">
                    <Label>Quality</Label>
                    <Select
                      value={settings.quality}
                      onValueChange={(value: Quality) => setSettings({ ...settings, quality: value })}
                      disabled={isDownloading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {qualityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              {opt.icon}
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Format */}
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={settings.format}
                      onValueChange={(value: Format) => setSettings({ ...settings, format: value })}
                      disabled={isDownloading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formatOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              {opt.icon}
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Playlist Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <ListVideo className="w-5 h-5 text-purple-500" />
                    <div>
                      <Label className="text-sm font-medium">Download Playlist</Label>
                      <p className="text-xs text-muted-foreground">
                        Download all videos when URL contains a playlist
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.downloadPlaylist}
                    onCheckedChange={(checked) => setSettings({ ...settings, downloadPlaylist: checked })}
                    disabled={isDownloading}
                  />
                </div>

                {/* Output Folder */}
                <div className="space-y-2">
                  <Label>Output Folder</Label>
                  <div className="flex gap-2">
                    <Input
                      value={settings.outputPath}
                      readOnly
                      className="flex-1 font-mono text-sm"
                      placeholder="Select download folder..."
                    />
                    <Button
                      variant="secondary"
                      onClick={handleSelectFolder}
                      disabled={isDownloading}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Browse
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Download Queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Queue
                {currentPlaylistInfo && (
                  <Badge variant="outline" className="ml-2 bg-purple-500/10 text-purple-500 border-purple-500/20">
                    Playlist: {currentPlaylistInfo.index}/{currentPlaylistInfo.total}
                  </Badge>
                )}
              </div>
              {totalCount > 0 && (
                <Badge variant="secondary">
                  {completedCount}/{totalCount} completed
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Download className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">No videos in queue</p>
                <p className="text-xs mt-1">Add YouTube URLs above to get started</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] pr-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "group relative flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        item.status === 'downloading' && "bg-blue-500/5 border-blue-500/20",
                        item.status === 'completed' && "bg-green-500/5 border-green-500/20",
                        item.status === 'error' && "bg-red-500/5 border-red-500/20",
                        item.status === 'pending' && "bg-muted/50"
                      )}
                    >
                      {getStatusIcon(item.status)}
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.isPlaylist && settings.downloadPlaylist && (
                            <ListVideo className="w-3 h-3 text-purple-500 flex-shrink-0" />
                          )}
                        </div>
                        
                        {item.status === 'downloading' && (
                          <div className="space-y-1">
                            <Progress value={item.progress} className="h-1.5" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {item.progress.toFixed(1)}%
                                {item.playlistIndex && item.playlistTotal && (
                                  <span className="ml-2 text-purple-500">
                                    (Video {item.playlistIndex}/{item.playlistTotal})
                                  </span>
                                )}
                              </span>
                              <span>{item.speed} {item.eta && `• ETA: ${item.eta}`}</span>
                            </div>
                          </div>
                        )}
                        
                        {item.status === 'error' && item.error && (
                          <p className="text-xs text-red-500 truncate">{item.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(item)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemove(item.id)}
                          disabled={isDownloading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer Actions */}
      <footer className="flex-shrink-0 border-t bg-background/80 backdrop-blur-lg">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            {!isDownloading ? (
              <Button 
                className="flex-1" 
                size="lg"
                onClick={handleStart}
                disabled={items.length === 0}
              >
                <Play className="w-4 h-4 mr-2" />
                Start Download ({items.filter(i => i.status !== 'completed').length})
              </Button>
            ) : (
              <Button 
                className="flex-1" 
                size="lg"
                variant="destructive"
                onClick={handleStop}
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Download
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={handleClear}
              disabled={isDownloading || items.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
