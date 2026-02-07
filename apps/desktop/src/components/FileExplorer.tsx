import { useCallback, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useFilesStore, useEditorStore } from '../store';
import { useSession } from '../hooks/useSession';
import type { FileNode } from '@talkcad/shared';

interface FileExplorerProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface PendingFile {
  node: FileNode;
  content: string;
}

interface SessionAsset {
  name: string;
  path: string;
  type: 'image' | 'svg' | 'pdf' | 'other';
}

export function FileExplorer({ collapsed, onToggle }: FileExplorerProps) {
  const { rootPath, files, activeFile, setRootPath, setFiles, openFile } = useFilesStore();
  const { code, isDirty, setSavedCode } = useEditorStore();
  const { currentSessionId } = useSession();
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [sessionAssets, setSessionAssets] = useState<SessionAsset[]>([]);
  const [projectsDir, setProjectsDir] = useState<string | null>(null);

  // Load session assets when session changes
  useEffect(() => {
    const loadSessionAssets = async () => {
      if (!currentSessionId) {
        setSessionAssets([]);
        return;
      }

      // Get projects directory and list assets
      const dir = await window.api.session.getProjectsDir();
      setProjectsDir(dir);

      const result = await window.api.session.listAssets(currentSessionId);
      if (result.success && result.assets) {
        setSessionAssets(result.assets);
      } else {
        setSessionAssets([]);
      }
    };

    loadSessionAssets();
  }, [currentSessionId]);

  // Cmd+S to save current file
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && isDirty) {
          await window.api.fs.writeFile(activeFile, code);
          setSavedCode(code);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, isDirty, code, setSavedCode]);

  const handleOpenFolder = useCallback(async () => {
    const path = await window.api.fs.openFolder();
    if (path) {
      setRootPath(path);
      const entries = await window.api.fs.readDirectory(path);
      setFiles(entries);
    }
  }, [setRootPath, setFiles]);

  const openNewFile = useCallback((node: FileNode, content: string) => {
    setSavedCode(content);
    openFile(node.path);
  }, [openFile, setSavedCode]);

  const handleFileClick = useCallback(
    async (node: FileNode) => {
      if (node.type === 'file' && node.name.endsWith('.scad')) {
        // Don't reload if clicking the same file
        if (node.path === activeFile) return;

        const content = await window.api.fs.readFile(node.path);

        // Check for unsaved changes
        if (isDirty && activeFile) {
          setPendingFile({ node, content });
          return;
        }

        openNewFile(node, content);
      }
    },
    [activeFile, isDirty, openNewFile]
  );

  const handleSaveAndSwitch = useCallback(async () => {
    if (!pendingFile || !activeFile) return;
    // Save current file
    await window.api.fs.writeFile(activeFile, code);
    // Open the new file
    openNewFile(pendingFile.node, pendingFile.content);
    setPendingFile(null);
  }, [activeFile, code, pendingFile, openNewFile]);

  const handleDiscardAndSwitch = useCallback(() => {
    if (!pendingFile) return;
    // Open the new file without saving
    openNewFile(pendingFile.node, pendingFile.content);
    setPendingFile(null);
  }, [pendingFile, openNewFile]);

  const handleCancelSwitch = useCallback(() => {
    setPendingFile(null);
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="w-full h-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
        title="Show files (⌘B)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-zinc-700">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Files</span>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
          title="Hide files (⌘B)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Session Assets Section */}
      {sessionAssets.length > 0 && (
        <div className="p-2 border-b border-zinc-700">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium text-zinc-400">Session Assets</span>
          </div>
          <div className="space-y-0.5">
            {sessionAssets.map((asset) => (
              <button
                key={asset.path}
                onClick={() => {
                  // Open in system viewer or preview
                  if (projectsDir && currentSessionId) {
                    const fullPath = `${projectsDir}/${currentSessionId}/${asset.path}`;
                    window.api.fs.readFile(fullPath).then((_content) => {
                      // For text/svg files, could open in editor
                      console.log('Asset path:', fullPath, 'Type:', asset.type);
                    }).catch(console.error);
                  }
                }}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 text-sm rounded text-left text-zinc-300 hover:bg-zinc-700/50"
              >
                {asset.type === 'image' ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : asset.type === 'svg' ? (
                  <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                <span className="truncate text-xs">{asset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {!rootPath ? (
          <button
            onClick={handleOpenFolder}
            className="w-full p-3 text-sm text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-600 rounded hover:border-zinc-500 transition-colors"
          >
            Open Folder
          </button>
        ) : (
          <FileTree
            nodes={files}
            activeFile={activeFile}
            isDirty={isDirty}
            onFileClick={handleFileClick}
          />
        )}
      </div>

      {/* Save Prompt Dialog */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-4 max-w-sm w-full mx-4 shadow-xl border border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Unsaved Changes</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Save changes to <span className="text-zinc-200">{activeFile?.split('/').pop()}</span> before switching?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelSwitch}
                className="px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardAndSwitch}
                className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-700 rounded transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAndSwitch}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-500 rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  nodes: FileNode[];
  activeFile: string | null;
  isDirty: boolean;
  onFileClick: (node: FileNode) => void;
  depth?: number;
}

function FileTree({ nodes, activeFile, isDirty, onFileClick, depth = 0 }: FileTreeProps) {
  return (
    <div className="space-y-0.5">
      {nodes
        .sort((a, b) => {
          // Directories first, then files
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            activeFile={activeFile}
            isDirty={isDirty}
            onFileClick={onFileClick}
            depth={depth}
          />
        ))}
    </div>
  );
}

interface FileTreeItemProps {
  node: FileNode;
  activeFile: string | null;
  isDirty: boolean;
  onFileClick: (node: FileNode) => void;
  depth: number;
}

function FileTreeItem({ node, activeFile, isDirty, onFileClick, depth }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);

  const handleClick = useCallback(async () => {
    if (node.type === 'directory') {
      if (!expanded) {
        const entries = await window.api.fs.readDirectory(node.path);
        setChildren(entries);
      }
      setExpanded(!expanded);
    } else {
      onFileClick(node);
    }
  }, [node, expanded, onFileClick]);

  const isActive = node.path === activeFile;
  const isScadFile = node.name.endsWith('.scad');

  return (
    <div>
      <button
        onClick={handleClick}
        className={clsx(
          'w-full flex items-center gap-1.5 px-1.5 py-1 text-sm rounded transition-colors text-left',
          isActive
            ? 'bg-blue-500/20 text-blue-400'
            : 'text-zinc-300 hover:bg-zinc-700/50'
        )}
        style={{ paddingLeft: depth * 12 + 6 }}
      >
        {node.type === 'directory' ? (
          <>
            <svg
              className={clsx('w-3 h-3 text-zinc-500 transition-transform', expanded && 'rotate-90')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
            </svg>
          </>
        ) : (
          <>
            <span className="w-3" />
            <svg
              className={clsx('w-4 h-4', isScadFile ? 'text-blue-400' : 'text-zinc-500')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </>
        )}
        <span className="truncate">
          {node.name}
          {isActive && isDirty && <span className="text-yellow-400 ml-1">•</span>}
        </span>
      </button>
      {expanded && children.length > 0 && (
        <FileTree
          nodes={children}
          activeFile={activeFile}
          isDirty={isDirty}
          onFileClick={onFileClick}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
