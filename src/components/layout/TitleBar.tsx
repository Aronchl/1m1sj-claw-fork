/**
 * TitleBar Component
 * macOS: drag region + optional trailing (e.g. chat toolbar on the same row as traffic lights).
 * Windows: drag region + optional trailing + minimize/maximize/close.
 * Linux: no custom chrome unless trailing is set (then a slim top row for chat tools).
 */
import { useState, useEffect, type ReactNode } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';

export type TitleBarProps = {
  /** Shown on the top window row (same strip as close/minimize on Windows). */
  trailing?: ReactNode;
};

export function TitleBar({ trailing }: TitleBarProps) {
  const platform = window.electron?.platform;

  if (platform === 'darwin') {
    if (trailing) {
      return (
        <div className="flex h-10 shrink-0 items-stretch border-b border-black/10 bg-background dark:border-white/10">
          <div className="drag-region min-h-0 min-w-0 flex-1" />
          <div className="no-drag flex shrink-0 items-center pr-2">{trailing}</div>
        </div>
      );
    }
    return (
      <div className="drag-region h-10 shrink-0 border-b border-black/10 bg-background dark:border-white/10" />
    );
  }

  if (platform === 'win32') {
    if (trailing) {
      return (
        <div className="flex h-10 shrink-0 items-stretch border-b border-black/10 bg-background dark:border-white/10">
          <div className="drag-region min-w-0 flex-1" />
          <div className="no-drag flex shrink-0 items-center px-2">{trailing}</div>
          <WindowsTitleBarControls />
        </div>
      );
    }
    return (
      <div className="drag-region flex h-10 shrink-0 items-center justify-end border-b border-black/10 bg-background dark:border-white/10">
        <WindowsTitleBarControls />
      </div>
    );
  }

  // Linux / others: optional top row when trailing is needed
  if (trailing) {
    return (
      <div className="flex h-10 shrink-0 items-stretch border-b border-black/10 bg-background dark:border-white/10">
        <div className="min-w-0 flex-1" />
        <div className="flex shrink-0 items-center px-2">{trailing}</div>
      </div>
    );
  }

  return null;
}

function WindowsTitleBarControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void invokeIpc('window:isMaximized').then((val) => {
      setMaximized(val as boolean);
    });
  }, []);

  const handleMinimize = () => {
    invokeIpc('window:minimize');
  };

  const handleMaximize = () => {
    void invokeIpc('window:maximize').then(() => {
      void invokeIpc('window:isMaximized').then((val) => {
        setMaximized(val as boolean);
      });
    });
  };

  const handleClose = () => {
    invokeIpc('window:close');
  };

  return (
    <div className="no-drag flex h-full">
      <button
        type="button"
        onClick={handleMinimize}
        className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent"
        title="Minimize"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleMaximize}
        className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={handleClose}
        className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-red-500 hover:text-white"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
