import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Loader2, Mic, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAI } from '@/contexts/AIContext';
import { useSubtitle } from '@/contexts/SubtitleContext';
import { parseSubtitles } from '@/lib/subtitle-parser';
import type { SubtitleFormat } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WhisperGenerateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WhisperGenerateDialog({ open: isOpen, onClose }: WhisperGenerateDialogProps) {
  const { t } = useTranslation('subtitles');
  const subtitle = useSubtitle();
  const ai = useAI();

  const [filePath, setFilePath] = useState('');
  const [language, setLanguage] = useState('');
  const [outputFormat, setOutputFormat] = useState<SubtitleFormat>('srt');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Media Files',
            extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'mp3', 'm4a', 'wav', 'ogg', 'flac'],
          },
        ],
      });

      if (selected) {
        setFilePath(typeof selected === 'string' ? selected : selected);
      }
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!filePath) return;

    // Check if whisper API key is configured
    const whisperApiKey =
      ai.config.whisper_api_key || (ai.config.provider === 'openai' ? ai.config.api_key : '');
    if (!whisperApiKey) {
      setError(t('whisper.noApiKey'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const content = await invoke<string>('generate_subtitles_with_whisper', {
        filePath,
        language: language || undefined,
        format: outputFormat,
        apiKey: whisperApiKey,
        endpointUrl: ai.config.whisper_endpoint_url || undefined,
        model: ai.config.whisper_model || 'whisper-1',
      });

      // Parse and load into editor
      const _result = parseSubtitles(content, outputFormat);
      const fileName = `whisper_${language || 'auto'}.${outputFormat}`;
      subtitle.loadFromContent(content, fileName, outputFormat);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsGenerating(false);
    }
  }, [filePath, language, outputFormat, ai.config, subtitle, onClose, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-[480px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold">{t('whisper.title')}</h2>
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
          <p className="text-sm text-muted-foreground">{t('whisper.description')}</p>

          {/* File Selection */}
          <div className="space-y-2">
            <label htmlFor="whisper-file" className="text-sm font-medium">
              {t('whisper.videoFile')}
            </label>
            <div className="flex gap-2">
              <input
                id="whisper-file"
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder={t('whisper.selectFile')}
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg truncate outline-none focus:ring-2 focus:ring-primary/50"
                readOnly
              />
              <button
                type="button"
                onClick={handleSelectFile}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >
                {t('whisper.selectFile')}
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <label htmlFor="whisper-lang" className="text-sm font-medium">
              {t('whisper.language')}
            </label>
            <select
              id="whisper-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none"
            >
              <option value="">{t('whisper.autoDetect')}</option>
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
            </select>
          </div>

          {/* Output Format */}
          <div className="space-y-2">
            <label htmlFor="whisper-format" className="text-sm font-medium">
              {t('whisper.outputFormat')}
            </label>
            <select
              id="whisper-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as SubtitleFormat)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none"
            >
              <option value="srt">{t('formats.srt')}</option>
              <option value="vtt">{t('formats.vtt')}</option>
            </select>
          </div>

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
            onClick={handleGenerate}
            disabled={!filePath || isGenerating}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-purple-600 text-white',
              'hover:bg-purple-700 transition-colors',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('whisper.generating')}
              </>
            ) : (
              t('whisper.generate')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
