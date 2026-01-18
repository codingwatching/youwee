import { useTheme } from '@/contexts/ThemeContext';
import { themes } from '@/lib/themes';
import type { ThemeName } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { Check, Sun, Moon } from 'lucide-react';
import { Label } from '@/components/ui/label';

// Gradient backgrounds for theme preview
const themeGradients: Record<ThemeName, string> = {
  midnight: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
  aurora: 'bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-500',
  sunset: 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500',
  ocean: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500',
  forest: 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500',
  candy: 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500',
};

export function SettingsPage() {
  const { theme, setTheme, mode, setMode } = useTheme();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center h-14 px-6 border-b bg-card/30 backdrop-blur-xl">
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Appearance */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Appearance</h2>
            <p className="text-xs text-muted-foreground">
              Customize the look and feel of the app
            </p>
          </div>

          {/* Mode Selection */}
          <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 space-y-4">
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('light')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  mode === 'light'
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent bg-accent/30 hover:bg-accent/50'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center shadow-lg">
                  <Sun className="w-5 h-5 text-amber-700" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Light</p>
                  <p className="text-xs text-muted-foreground">Clean & bright</p>
                </div>
                {mode === 'light' && (
                  <Check className="w-5 h-5 text-primary ml-auto" />
                )}
              </button>

              <button
                onClick={() => setMode('dark')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  mode === 'dark'
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent bg-accent/30 hover:bg-accent/50'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
                  <Moon className="w-5 h-5 text-slate-300" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Dark</p>
                  <p className="text-xs text-muted-foreground">Easy on the eyes</p>
                </div>
                {mode === 'dark' && (
                  <Check className="w-5 h-5 text-primary ml-auto" />
                )}
              </button>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 space-y-4">
            <Label className="text-xs text-muted-foreground">Theme Color</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {themes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name)}
                  className={cn(
                    'flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all group',
                    theme === t.name
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-accent/50'
                  )}
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110',
                      themeGradients[t.name]
                    )}
                  >
                    {theme === t.name ? (
                      <Check className="w-5 h-5 text-white drop-shadow" />
                    ) : (
                      <span className="text-lg">{t.emoji}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* About */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">About</h2>
            <p className="text-xs text-muted-foreground">
              App information
            </p>
          </div>

          <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg">
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-7 h-7 text-primary-foreground"
                  fill="currentColor"
                >
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold gradient-text">Youwee</h3>
                <p className="text-xs text-muted-foreground">Version 0.1.0</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A modern YouTube video downloader powered by yt-dlp. 
              Download videos in various qualities and formats.
            </p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>Built with Tauri + React</span>
              <span>•</span>
              <a 
                href="https://github.com/vanloctech/youtube-downloader" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
