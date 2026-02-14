import { ArrowDown, ArrowUp, Timer } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubtitle } from '@/contexts/SubtitleContext';
import { cn } from '@/lib/utils';

interface TimingDialogProps {
  open: boolean;
  onClose: () => void;
}

type TimingTab = 'shift' | 'scale' | 'twopoint';

export function TimingDialog({ open, onClose }: TimingDialogProps) {
  const { t } = useTranslation('subtitles');
  const subtitle = useSubtitle();
  const [tab, setTab] = useState<TimingTab>('shift');

  // Shift state
  const [shiftMs, setShiftMs] = useState(0);
  const [shiftMode, setShiftMode] = useState<'all' | 'selected'>('all');

  // Scale state
  const [scaleRatio, setScaleRatio] = useState(1.0);

  // Two-point sync state
  const [point1Original, setPoint1Original] = useState(0);
  const [point1Desired, setPoint1Desired] = useState(0);
  const [point2Original, setPoint2Original] = useState(0);
  const [point2Desired, setPoint2Desired] = useState(0);

  const handleShift = useCallback(() => {
    if (shiftMs === 0) return;

    const entriesToUpdate =
      shiftMode === 'selected' && subtitle.selectedIds.size > 0
        ? subtitle.entries.filter((e) => subtitle.selectedIds.has(e.id))
        : subtitle.entries;

    const updates = entriesToUpdate.map((e) => ({
      id: e.id,
      changes: {
        startTime: Math.max(0, e.startTime + shiftMs),
        endTime: Math.max(0, e.endTime + shiftMs),
      },
    }));

    subtitle.updateEntries(updates);
    onClose();
  }, [shiftMs, shiftMode, subtitle, onClose]);

  const handleScale = useCallback(() => {
    if (scaleRatio === 1.0) return;

    const updates = subtitle.entries.map((e) => ({
      id: e.id,
      changes: {
        startTime: Math.max(0, Math.round(e.startTime * scaleRatio)),
        endTime: Math.max(0, Math.round(e.endTime * scaleRatio)),
      },
    }));

    subtitle.updateEntries(updates);
    onClose();
  }, [scaleRatio, subtitle, onClose]);

  const handleTwoPointSync = useCallback(() => {
    if (point1Original === point2Original) return;

    // Calculate linear transformation: newTime = a * oldTime + b
    const a = (point2Desired - point1Desired) / (point2Original - point1Original);
    const b = point1Desired - a * point1Original;

    const updates = subtitle.entries.map((e) => ({
      id: e.id,
      changes: {
        startTime: Math.max(0, Math.round(a * e.startTime + b)),
        endTime: Math.max(0, Math.round(a * e.endTime + b)),
      },
    }));

    subtitle.updateEntries(updates);
    onClose();
  }, [point1Original, point1Desired, point2Original, point2Desired, subtitle, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-[460px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
          <Timer className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('timing.title')}</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          {(['shift', 'scale', 'twopoint'] as TimingTab[]).map((tabId) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setTab(tabId)}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === tabId
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tabId === 'shift' && t('timing.shiftAll')}
              {tabId === 'scale' && t('timing.scale')}
              {tabId === 'twopoint' && t('timing.twoPointSync')}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Shift Tab */}
          {tab === 'shift' && (
            <>
              <div className="space-y-2">
                <label htmlFor="shift-ms" className="text-sm font-medium">
                  {t('timing.shiftMs')}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShiftMs((v) => v - 100)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title={t('timing.shiftBackward')}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <input
                    id="shift-ms"
                    type="number"
                    value={shiftMs}
                    onChange={(e) => setShiftMs(Number(e.target.value))}
                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg text-center tabular-nums outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShiftMs((v) => v + 100)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title={t('timing.shiftForward')}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {shiftMs > 0 ? `+${shiftMs}ms` : `${shiftMs}ms`}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShiftMode('all')}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                    shiftMode === 'all'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {t('timing.shiftAll')}
                </button>
                <button
                  type="button"
                  onClick={() => setShiftMode('selected')}
                  disabled={subtitle.selectedIds.size === 0}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                    'disabled:opacity-50',
                    shiftMode === 'selected'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {t('timing.shiftSelected')}
                </button>
              </div>
            </>
          )}

          {/* Scale Tab */}
          {tab === 'scale' && (
            <div className="space-y-2">
              <label htmlFor="scale-ratio" className="text-sm font-medium">
                {t('timing.scaleRatio')}
              </label>
              <input
                id="scale-ratio"
                type="number"
                value={scaleRatio}
                onChange={(e) => setScaleRatio(Number(e.target.value))}
                step={0.01}
                min={0.1}
                max={10}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-center tabular-nums outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground">
                1.0 = {t('timing.scale')} (no change), 0.5 = half speed, 2.0 = double speed
              </p>
            </div>
          )}

          {/* Two-Point Sync Tab */}
          {tab === 'twopoint' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('timing.point1')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="p1-orig" className="text-xs text-muted-foreground">
                      {t('timing.originalTime')}
                    </label>
                    <input
                      id="p1-orig"
                      type="number"
                      value={point1Original}
                      onChange={(e) => setPoint1Original(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg tabular-nums outline-none"
                      placeholder="ms"
                    />
                  </div>
                  <div>
                    <label htmlFor="p1-desired" className="text-xs text-muted-foreground">
                      {t('timing.desiredTime')}
                    </label>
                    <input
                      id="p1-desired"
                      type="number"
                      value={point1Desired}
                      onChange={(e) => setPoint1Desired(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg tabular-nums outline-none"
                      placeholder="ms"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('timing.point2')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="p2-orig" className="text-xs text-muted-foreground">
                      {t('timing.originalTime')}
                    </label>
                    <input
                      id="p2-orig"
                      type="number"
                      value={point2Original}
                      onChange={(e) => setPoint2Original(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg tabular-nums outline-none"
                      placeholder="ms"
                    />
                  </div>
                  <div>
                    <label htmlFor="p2-desired" className="text-xs text-muted-foreground">
                      {t('timing.desiredTime')}
                    </label>
                    <input
                      id="p2-desired"
                      type="number"
                      value={point2Desired}
                      onChange={(e) => setPoint2Desired(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg tabular-nums outline-none"
                      placeholder="ms"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
          >
            {t('timing.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (tab === 'shift') handleShift();
              else if (tab === 'scale') handleScale();
              else handleTwoPointSync();
            }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
            )}
          >
            {t('timing.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
