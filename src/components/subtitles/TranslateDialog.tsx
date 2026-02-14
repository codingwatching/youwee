import { invoke } from '@tauri-apps/api/core';
import { Languages, Loader2, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubtitle } from '@/contexts/SubtitleContext';
import { LANGUAGE_OPTIONS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TranslateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TranslateDialog({ open, onClose }: TranslateDialogProps) {
  const { t } = useTranslation('subtitles');
  const subtitle = useSubtitle();

  const [targetLang, setTargetLang] = useState('vi');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    const entriesToTranslate =
      subtitle.selectedIds.size > 0
        ? subtitle.entries.filter((e) => subtitle.selectedIds.has(e.id))
        : subtitle.entries;

    if (entriesToTranslate.length === 0) return;

    setIsTranslating(true);
    setError(null);
    setProgress({ current: 0, total: entriesToTranslate.length });

    try {
      // Batch translate in chunks
      const BATCH_SIZE = 20;
      const updates: Array<{ id: string; changes: { text: string } }> = [];

      for (let i = 0; i < entriesToTranslate.length; i += BATCH_SIZE) {
        const batch = entriesToTranslate.slice(i, i + BATCH_SIZE);
        const textsToTranslate = batch.map((e) => e.text).join('\n---SEPARATOR---\n');

        const targetLangName =
          LANGUAGE_OPTIONS.find((l) => l.code === targetLang)?.name || targetLang;

        const prompt = `Translate the following subtitle texts to ${targetLangName}. Each subtitle is separated by "---SEPARATOR---". Return ONLY the translated texts, separated by "---SEPARATOR---". Keep the same number of texts. Preserve line breaks within each subtitle.\n\n${textsToTranslate}`;

        const response = await invoke<string>('generate_ai_response', {
          prompt,
        });

        const translatedTexts = response.split('---SEPARATOR---').map((s) => s.trim());

        for (let j = 0; j < batch.length; j++) {
          const translatedText = translatedTexts[j] || batch[j].text;
          updates.push({
            id: batch[j].id,
            changes: { text: translatedText },
          });
        }

        setProgress({
          current: Math.min(i + BATCH_SIZE, entriesToTranslate.length),
          total: entriesToTranslate.length,
        });
      }

      subtitle.updateEntries(updates);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsTranslating(false);
    }
  }, [subtitle, targetLang, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-[440px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold">{t('translate.title')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{t('translate.description')}</p>

          {/* Target Language */}
          <div className="space-y-2">
            <label htmlFor="translate-target" className="text-sm font-medium">
              {t('translate.targetLang')}
            </label>
            <select
              id="translate-target"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div className="text-sm text-muted-foreground">
            {subtitle.selectedIds.size > 0
              ? t('translate.translateSelected')
              : t('translate.translateAll')}
            {' — '}
            {subtitle.selectedIds.size > 0
              ? t('editor.selected', { count: subtitle.selectedIds.size })
              : t('editor.total', { count: subtitle.entries.length })}
          </div>

          {/* Progress */}
          {isTranslating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                {t('translate.progress', progress)}
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{
                    width:
                      progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg">
              {error}
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
            onClick={handleTranslate}
            disabled={isTranslating}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-purple-600 text-white',
              'hover:bg-purple-700 transition-colors',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('translate.translating')}
              </>
            ) : subtitle.selectedIds.size > 0 ? (
              t('translate.translateSelected')
            ) : (
              t('translate.translateAll')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
