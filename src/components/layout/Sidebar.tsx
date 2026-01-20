import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { 
  Download, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type Page = 'download' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'download',
    label: 'Download',
    icon: <Download className="w-5 h-5" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { mode, toggleMode } = useTheme();

  return (
    <TooltipProvider delayDuration={0}>
      {/* Floating sidebar container */}
      <div className="h-full p-3 pr-0">
        <aside
          className={cn(
            'h-full flex flex-col rounded-2xl transition-all duration-300 ease-out',
            'bg-gradient-to-b from-card/80 via-card/60 to-card/40',
            'backdrop-blur-2xl',
            'border border-white/10 dark:border-white/5',
            'shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
            'relative overflow-hidden',
            isCollapsed ? 'w-[56px]' : 'w-[180px]'
          )}
        >
          {/* Gradient overlay for glass effect */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: `
                linear-gradient(135deg, 
                  hsl(var(--gradient-from) / 0.08) 0%, 
                  transparent 50%,
                  hsl(var(--gradient-to) / 0.05) 100%
                )
              `
            }}
          />
          
          {/* Shine effect */}
          <div 
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)'
            }}
          />

          {/* Logo */}
          <div className="relative flex items-center justify-center h-14 px-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={cn(
                "flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300",
                "ring-2 ring-primary/20 shadow-lg",
                isCollapsed ? "w-9 h-9" : "w-10 h-10"
              )}>
                <img 
                  src="/logo-64.png" 
                  alt="Youwee" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className={cn(
                  'font-bold text-lg whitespace-nowrap transition-all duration-300 gradient-text',
                  isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 ml-1'
                )}
              >
                Youwee
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

          {/* Navigation */}
          <nav className="relative flex-1 p-2 space-y-1">
            {navItems.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPageChange(item.id)}
                    className={cn(
                      'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                      'transition-all duration-200 ease-out',
                      'hover:bg-white/10 dark:hover:bg-white/5',
                      currentPage === item.id && [
                        'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent',
                        'text-primary',
                        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]',
                      ],
                      currentPage !== item.id && 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className={cn(
                      "flex-shrink-0 transition-transform duration-200",
                      "group-hover:scale-110",
                      currentPage === item.id && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                    )}>
                      {item.icon}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-medium whitespace-nowrap transition-all duration-300',
                        isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                      )}
                    >
                      {item.label}
                    </span>
                    
                    {/* Active indicator */}
                    {currentPage === item.id && (
                      <div className="absolute left-0 w-1 h-6 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
                    )}
                  </button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="relative p-2 space-y-1">
            {/* Divider */}
            <div className="mx-1 mb-2 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            
            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleMode}
                  className={cn(
                    'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                    'transition-all duration-200 ease-out',
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-white/10 dark:hover:bg-white/5'
                  )}
                >
                  <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                    {mode === 'dark' ? (
                      <Sun className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Moon className="w-5 h-5 text-indigo-400" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium whitespace-nowrap transition-all duration-300',
                      isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                    )}
                  >
                    {mode === 'dark' ? 'Light' : 'Dark'}
                  </span>
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="font-medium">
                  {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </TooltipContent>
              )}
            </Tooltip>

            {/* Collapse Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={cn(
                    'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                    'transition-all duration-200 ease-out',
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-white/10 dark:hover:bg-white/5'
                  )}
                >
                  <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                    {isCollapsed ? (
                      <ChevronRight className="w-5 h-5" />
                    ) : (
                      <ChevronLeft className="w-5 h-5" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium whitespace-nowrap transition-all duration-300',
                      isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                    )}
                  >
                    Collapse
                  </span>
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="font-medium">
                  Expand
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
