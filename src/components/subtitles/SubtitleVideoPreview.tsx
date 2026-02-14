import { open } from '@tauri-apps/plugin-dialog';
import { Pause, Play, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubtitle } from '@/contexts/SubtitleContext';
import { formatTimeDisplay } from '@/lib/subtitle-parser';
import { cn } from '@/lib/utils';

export function SubtitleVideoPreview() {
  const { t } = useTranslation('subtitles');
  const subtitle = useSubtitle();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSubText, setCurrentSubText] = useState('');
  const animFrameRef = useRef<number>(0);

  const handleLoadVideo = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v'],
          },
        ],
      });

      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : selected;
      subtitle.setVideoPath(filePath);
    } catch (err) {
      console.error('Failed to load video:', err);
    }
  }, [subtitle]);

  // Sync video time to context
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      const timeMs = video.currentTime * 1000;
      subtitle.setVideoCurrentTime(timeMs);

      // Find current subtitle
      const current = subtitle.entries.find((e) => timeMs >= e.startTime && timeMs <= e.endTime);
      setCurrentSubText(current?.text || '');

      if (!video.paused) {
        animFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    const onPlay = () => {
      subtitle.setIsVideoPlaying(true);
      animFrameRef.current = requestAnimationFrame(updateTime);
    };

    const onPause = () => {
      subtitle.setIsVideoPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
      updateTime();
    };

    const onSeeked = () => {
      updateTime();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('timeupdate', updateTime);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', updateTime);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [subtitle]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleSeekToEntry = useCallback((timeMs: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = timeMs / 1000;
  }, []);

  // Seek to active entry when it changes
  useEffect(() => {
    if (!subtitle.activeEntryId || !videoRef.current) return;
    const entry = subtitle.entries.find((e) => e.id === subtitle.activeEntryId);
    if (entry) {
      handleSeekToEntry(entry.startTime);
    }
  }, [subtitle.activeEntryId, subtitle.entries, handleSeekToEntry]);

  const videoSrc = subtitle.videoPath
    ? `asset://localhost/${encodeURIComponent(subtitle.videoPath)}`
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Video Container */}
      <div className="relative bg-black flex-shrink-0">
        {videoSrc ? (
          <div className="relative">
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full aspect-video object-contain"
              playsInline
            >
              <track kind="captions" />
            </video>
            {/* Subtitle Overlay */}
            {currentSubText && (
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <span
                  className={cn(
                    'inline-block px-3 py-1.5 rounded-md',
                    'bg-black/75 text-white text-sm leading-relaxed',
                    'max-w-full',
                  )}
                >
                  {currentSubText.split('\n').map((line, i) => (
                    <span key={`line-${i}-${line.slice(0, 10)}`}>
                      {i > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center bg-muted/30">
            <button
              type="button"
              onClick={handleLoadVideo}
              className={cn(
                'flex flex-col items-center gap-2 p-6 rounded-xl',
                'border border-dashed border-muted-foreground/30',
                'hover:bg-accent/50 transition-colors',
                'text-muted-foreground hover:text-foreground',
              )}
            >
              <Video className="w-8 h-8" />
              <span className="text-sm">{t('video.loadVideo')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {videoSrc && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <button
            type="button"
            onClick={handlePlayPause}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title={t('video.playPause')}
          >
            {subtitle.isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatTimeDisplay(subtitle.videoCurrentTime)}
          </span>
        </div>
      )}

      {/* Current subtitle info */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('video.currentSubtitle')}
          </h4>
          {currentSubText ? (
            <p className="text-sm leading-relaxed">{currentSubText}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
