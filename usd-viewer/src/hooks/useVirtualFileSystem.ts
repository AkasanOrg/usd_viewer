import { useCallback } from 'react';

// Resolve relative path from base path
export function resolveRelativePath(basePath: string, relativePath: string): string {
  // Handle absolute paths
  if (relativePath.startsWith('/')) {
    return relativePath;
  }

  // Get the directory of the base path
  const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1) || '/';

  // Combine and normalize
  const combined = baseDir + relativePath;
  const segments = combined.split('/').filter(Boolean);
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      resolved.pop();
    } else if (segment !== '.') {
      resolved.push(segment);
    }
  }

  return '/' + resolved.join('/');
}

// Extract directory from path
export function getDirectory(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return path.substring(0, lastSlash);
}

// Extract filename from path
export function getFilename(path: string): string {
  return path.split('/').pop() || '';
}

// Check if path is a USDA file
export function isUsdaFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.usda') || lower.endsWith('.usd');
}

// Build file tree structure from flat file list
export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
}

export function buildFileTree(files: Map<string, { path: string; name: string }>): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const dirMap = new Map<string, FileTreeNode>();

  // Sort files by path for consistent ordering
  const sortedFiles = Array.from(files.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  for (const file of sortedFiles) {
    const parts = file.path.split('/').filter(Boolean);
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += '/' + part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        // This is a file
        currentLevel.push({
          name: file.name,
          path: file.path,
          isDirectory: false,
          children: [],
        });
      } else {
        // This is a directory
        let dir = dirMap.get(currentPath);
        if (!dir) {
          dir = {
            name: part,
            path: currentPath,
            isDirectory: true,
            children: [],
          };
          dirMap.set(currentPath, dir);
          currentLevel.push(dir);
        }
        currentLevel = dir.children;
      }
    }
  }

  return root;
}

// Hook for file system utilities
export function useVirtualFileSystem() {
  const resolvePath = useCallback((basePath: string, relativePath: string) => {
    return resolveRelativePath(basePath, relativePath);
  }, []);

  const getDir = useCallback((path: string) => {
    return getDirectory(path);
  }, []);

  const getName = useCallback((path: string) => {
    return getFilename(path);
  }, []);

  return {
    resolvePath,
    getDir,
    getName,
    isUsdaFile,
  };
}
