import { useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { useLayoutStore } from '../store';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { Viewport } from './Viewport';
import { SpecsPanel } from './SpecsPanel';
import { ChatPanel } from './ChatPanel';
import { TitleBar } from './TitleBar';

export function Layout() {
  const { viewMode, filesCollapsed, specsCollapsed, setViewMode, toggleFiles, toggleSpecs } =
    useLayoutStore();
  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setViewMode('code');
            break;
          case '2':
            e.preventDefault();
            setViewMode('preview');
            break;
          case 'b':
            e.preventDefault();
            toggleFiles();
            break;
          case 'j':
            e.preventDefault();
            toggleSpecs();
            break;
        }
      }
    },
    [setViewMode, toggleFiles, toggleSpecs]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Files Sidebar */}
        <div
          className={clsx(
            'border-r border-zinc-700 transition-all duration-200',
            filesCollapsed ? 'w-10' : 'w-56'
          )}
        >
          <FileExplorer collapsed={filesCollapsed} onToggle={toggleFiles} />
        </div>

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-700 bg-zinc-800/50">
            <button
              onClick={() => setViewMode('code')}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'code'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Code
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'preview'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'split'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Split
            </button>
          </div>

          {/* Code / Preview Area */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'code' && <CodeEditor />}
            {viewMode === 'preview' && <Viewport />}
            {viewMode === 'split' && (
              <div className="flex h-full">
                <div className="w-1/2 border-r border-zinc-700">
                  <CodeEditor />
                </div>
                <div className="w-1/2">
                  <Viewport />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Specs Sidebar */}
        <div
          className={clsx(
            'border-l border-zinc-700 transition-all duration-200',
            specsCollapsed ? 'w-10' : 'w-56'
          )}
        >
          <SpecsPanel collapsed={specsCollapsed} onToggle={toggleSpecs} />
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel />
    </div>
  );
}
