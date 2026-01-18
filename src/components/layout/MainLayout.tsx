import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import type { Page } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export function MainLayout({ children, currentPage, onPageChange }: MainLayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden bg-background relative">
      {/* Gradient background overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% -20%, hsl(var(--gradient-from) / 0.15), transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 0%, hsl(var(--gradient-via) / 0.12), transparent 50%),
            radial-gradient(ellipse 50% 30% at 50% 100%, hsl(var(--gradient-to) / 0.1), transparent 50%)
          `
        }}
      />
      
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onPageChange={onPageChange} />
      
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {children}
      </main>
    </div>
  );
}
