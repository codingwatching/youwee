import { Inbox, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { UniversalQueueItem } from './UniversalQueueItem';
import type { DownloadItem } from '@/lib/types';

interface UniversalQueueListProps {
  items: DownloadItem[];
  isDownloading: boolean;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export function UniversalQueueList({ 
  items, 
  isDownloading, 
  onRemove,
  onClearCompleted,
}: UniversalQueueListProps) {
  const completedCount = items.filter(i => i.status === 'completed').length;
  const hasCompleted = completedCount > 0;

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">No videos in queue</h3>
        <p className="text-xs text-muted-foreground/70 max-w-[200px]">
          Paste any video URL from TikTok, Instagram, Twitter, and 1000+ other sites
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Queue Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? 'video' : 'videos'} in queue
        </span>
        {hasCompleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={onClearCompleted}
            disabled={isDownloading}
          >
            <CheckCircle2 className="w-3 h-3" />
            Clear {completedCount} completed
          </Button>
        )}
      </div>

      {/* Queue Items */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="space-y-2 pb-2">
          {items.map((item) => (
            <UniversalQueueItem
              key={item.id}
              item={item}
              disabled={isDownloading}
              onRemove={onRemove}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
