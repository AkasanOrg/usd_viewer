import { useState, useMemo } from 'react';
import type { VirtualFile } from '../../types/virtualFileSystem';
import { buildFileTree, type FileTreeNode } from '../../hooks/useVirtualFileSystem';
import './FileTree.css';

interface FileTreeItemProps {
  node: FileTreeNode;
  activeFilePath: string | null;
  files: Map<string, VirtualFile>;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
  onToggleActive: (path: string) => void;
  depth: number;
}

function FileTreeItem({
  node,
  activeFilePath,
  files,
  onSelect,
  onDelete,
  onToggleActive,
  depth,
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const file = !node.isDirectory ? files.get(node.path) : null;
  const isFileActive = file?.active ?? true;

  const handleClick = () => {
    if (node.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node.path);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.isDirectory && confirm(`Delete ${node.name}?`)) {
      onDelete(node.path);
    }
  };

  const handleToggleActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.isDirectory) {
      onToggleActive(node.path);
    }
  };

  return (
    <div className="file-tree-item-container">
      <div
        className={`file-tree-item ${!node.isDirectory && node.path === activeFilePath ? 'active' : ''} ${!node.isDirectory && !isFileActive ? 'inactive' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {!node.isDirectory && (
          <input
            type="checkbox"
            className="file-tree-active-checkbox"
            checked={isFileActive}
            onClick={handleToggleActive}
            onChange={() => {}}
            title={isFileActive ? 'Click to exclude from stage' : 'Click to include in stage'}
          />
        )}
        <span className="file-tree-icon">
          {node.isDirectory ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-tree-name">{node.name}</span>
        {!node.isDirectory && (
          <button
            className="file-tree-delete"
            onClick={handleDelete}
            title="Delete file"
          >
            ×
          </button>
        )}
      </div>
      {node.isDirectory && isExpanded && node.children.length > 0 && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              activeFilePath={activeFilePath}
              files={files}
              onSelect={onSelect}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  files: Map<string, VirtualFile>;
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileCreate: () => void;
  onFileDelete: (path: string) => void;
  onToggleFileActive: (path: string) => void;
}

export function FileTree({
  files,
  activeFilePath,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onToggleFileActive,
}: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">WORKSPACE</span>
        <button
          className="file-tree-add"
          onClick={onFileCreate}
          title="New File"
        >
          +
        </button>
      </div>
      <div className="file-tree-content">
        {tree.length === 0 ? (
          <div className="file-tree-empty">No files</div>
        ) : (
          tree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              activeFilePath={activeFilePath}
              files={files}
              onSelect={onFileSelect}
              onDelete={onFileDelete}
              onToggleActive={onToggleFileActive}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
}
