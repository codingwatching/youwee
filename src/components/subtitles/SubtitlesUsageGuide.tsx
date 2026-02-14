import { Keyboard, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface SubtitlesUsageGuideProps {
  compact?: boolean;
  className?: string;
}

export function SubtitlesUsageGuide({ compact = false, className }: SubtitlesUsageGuideProps) {
  const { t } = useTranslation('subtitles');
  const steps = compact
    ? [t('hints.step2'), t('hints.step4')]
    : [t('hints.step1'), t('hints.step2'), t('hints.step3'), t('hints.step4')];

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/20',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('hints.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('hints.description')}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
        <Keyboard className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{t('hints.shortcuts')}</span>
      </div>
    </div>
  );
}
