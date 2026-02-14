import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { FilePlus, FileUp, Globe, Subtitles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FindReplacePanel } from '@/components/subtitles/FindReplacePanel';
import { FixErrorsDialog } from '@/components/subtitles/FixErrorsDialog';
import { GrammarFixDialog } from '@/components/subtitles/GrammarFixDialog';
import { SubtitleDownloadDialog } from '@/components/subtitles/SubtitleDownloadDialog';
import { SubtitleEditor } from '@/components/subtitles/SubtitleEditor';
import { SubtitleToolbar } from '@/components/subtitles/SubtitleToolbar';
import { SubtitleVideoPreview } from '@/components/subtitles/SubtitleVideoPreview';
import { TimingDialog } from '@/components/subtitles/TimingDialog';
import { TranslateDialog } from '@/components/subtitles/TranslateDialog';
import { WhisperGenerateDialog } from '@/components/subtitles/WhisperGenerateDialog';
import { useSubtitle } from '@/contexts/SubtitleContext';
import { detectFormatFromFilename, parseSubtitles } from '@/lib/subtitle-parser';
import { cn } from '@/lib/utils';

export function SubtitlesPage() {
  const { t } = useTranslation('subtitles');
  const subtitle = useSubtitle();
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [showTimingDialog, setShowTimingDialog] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showFixErrors, setShowFixErrors] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [showGrammarFix, setShowGrammarFix] = useState(false);

  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Subtitle Files',
            extensions: ['srt', 'vtt', 'ass', 'ssa'],
          },
        ],
      });

      if (!selected) return;

      const filePath = typeof selected === 'string' ? selected : selected;
      const content = await readTextFile(filePath);
      const format = detectFormatFromFilename(filePath);
      const result = parseSubtitles(content, format);

      subtitle.loadFromFile(result.entries, result.format, filePath, result.assHeader);
    } catch (err) {
      console.error('Failed to open subtitle file:', err);
    }
  }, [subtitle]);

  const handleCreateNew = useCallback(() => {
    subtitle.createNew();
  }, [subtitle]);

  // Keyboard shortcuts for dialogs
  // Ctrl+F for find/replace, Ctrl+S for save (handled in toolbar)
  // These are handled in SubtitleEditor's window keydown handler

  const hasEntries = subtitle.entries.length > 0 || subtitle.fileName !== null;

  if (!hasEntries) {
    return (
      <div className="flex flex-col h-full">
        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Subtitles className="w-10 h-10 text-primary" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{t('title')}</h2>
              <p className="text-muted-foreground">{t('emptyState.description')}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 items-center">
              <button
                type="button"
                onClick={handleOpenFile}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'font-medium text-sm',
                )}
              >
                <FileUp className="w-4 h-4" />
                {t('emptyState.openFile')}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDownloadDialog(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                    'border border-dashed border-muted-foreground/30',
                    'hover:bg-accent/50 transition-colors',
                    'text-sm text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Globe className="w-4 h-4" />
                  {t('emptyState.downloadFromUrl')}
                </button>

                <button
                  type="button"
                  onClick={handleCreateNew}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                    'border border-dashed border-muted-foreground/30',
                    'hover:bg-accent/50 transition-colors',
                    'text-sm text-muted-foreground hover:text-foreground',
                  )}
                >
                  <FilePlus className="w-4 h-4" />
                  {t('emptyState.createNew')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Download Dialog (available from empty state too) */}
        <SubtitleDownloadDialog
          open={showDownloadDialog}
          onClose={() => setShowDownloadDialog(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <SubtitleToolbar
        onOpenFile={handleOpenFile}
        onShowDownloadDialog={() => setShowDownloadDialog(true)}
        onShowTimingDialog={() => setShowTimingDialog(true)}
        onShowFindReplace={() => setShowFindReplace((v) => !v)}
        onShowFixErrors={() => setShowFixErrors(true)}
        onShowWhisper={() => setShowWhisper(true)}
        onShowTranslate={() => setShowTranslate(true)}
        onShowGrammarFix={() => setShowGrammarFix(true)}
      />

      {/* Find & Replace Panel (inline, not a dialog) */}
      <FindReplacePanel open={showFindReplace} onClose={() => setShowFindReplace(false)} />

      {/* Main Content */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        {/* Left: Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <SubtitleEditor />
        </div>

        {/* Right: Video Preview */}
        <div className="w-[380px] flex-shrink-0 border-l border-border/50">
          <SubtitleVideoPreview />
        </div>
      </div>

      {/* Dialogs */}
      <SubtitleDownloadDialog
        open={showDownloadDialog}
        onClose={() => setShowDownloadDialog(false)}
      />
      <TimingDialog open={showTimingDialog} onClose={() => setShowTimingDialog(false)} />
      <FixErrorsDialog open={showFixErrors} onClose={() => setShowFixErrors(false)} />
      <WhisperGenerateDialog open={showWhisper} onClose={() => setShowWhisper(false)} />
      <TranslateDialog open={showTranslate} onClose={() => setShowTranslate(false)} />
      <GrammarFixDialog open={showGrammarFix} onClose={() => setShowGrammarFix(false)} />
    </div>
  );
}
