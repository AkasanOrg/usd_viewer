import type { VirtualFile } from '../../types/virtualFileSystem';
import './FileTabs.css';

interface FileTabsProps {
  openFiles: VirtualFile[];
  activeFilePath: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function FileTabs({
  openFiles,
  activeFilePath,
  onTabSelect,
  onTabClose,
}: FileTabsProps) {
  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="file-tabs">
      {openFiles.map((file) => (
        <div
          key={file.path}
          className={`file-tab ${file.path === activeFilePath ? 'active' : ''} ${file.isDirty ? 'dirty' : ''}`}
          onClick={() => onTabSelect(file.path)}
          title={file.path}
        >
          <span className="tab-name">{file.name}</span>
          {file.isDirty && <span className="dirty-indicator">●</span>}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(file.path);
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
