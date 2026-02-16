import type { VirtualFile } from '../types/virtualFileSystem';

/**
 * OPFS (Origin Private File System) utilities for managing USD files
 *
 * This provides a file system-like interface for storing USDA files,
 * which allows USD's Reference and Payload features to work naturally
 * as if files are stored on disk.
 */

/**
 * Check if OPFS is supported in the current browser
 */
export function isOPFSSupported(): boolean {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
}

// Get root directory handle
async function getRootDirectory(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

// Ensure directory path exists, creating intermediate directories as needed
async function ensureDirectory(path: string): Promise<FileSystemDirectoryHandle> {
  const root = await getRootDirectory();
  const segments = path.split('/').filter(Boolean);

  let currentDir = root;
  for (const segment of segments) {
    currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
  }

  return currentDir;
}

// Get directory path and filename from full path
function parsePath(path: string): { dirPath: string; filename: string } {
  const normalized = path.startsWith('/') ? path.substring(1) : path;
  const lastSlash = normalized.lastIndexOf('/');

  if (lastSlash === -1) {
    return { dirPath: '', filename: normalized };
  }

  return {
    dirPath: normalized.substring(0, lastSlash),
    filename: normalized.substring(lastSlash + 1),
  };
}

/**
 * Save a file to OPFS
 */
export async function saveFileToOPFS(file: VirtualFile): Promise<void> {
  const { dirPath, filename } = parsePath(file.path);

  const dir = dirPath ? await ensureDirectory(dirPath) : await getRootDirectory();
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  // Write file metadata and content
  const metadata = {
    id: file.id,
    path: file.path,
    name: file.name,
    isDirty: file.isDirty,
    lastModified: file.lastModified,
    active: file.active,
  };

  // Store metadata in a separate .meta file
  const metaHandle = await dir.getFileHandle(`${filename}.meta`, { create: true });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify(metadata));
  await metaWritable.close();

  // Write actual content
  await writable.write(file.content);
  await writable.close();
}

/**
 * Load a file from OPFS
 */
export async function loadFileFromOPFS(path: string): Promise<VirtualFile | null> {
  try {
    const { dirPath, filename } = parsePath(path);
    const dir = dirPath ? await ensureDirectory(dirPath) : await getRootDirectory();

    // Read content
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Read metadata
    let metadata: Partial<VirtualFile> = {};
    try {
      const metaHandle = await dir.getFileHandle(`${filename}.meta`);
      const metaFile = await metaHandle.getFile();
      const metaText = await metaFile.text();
      metadata = JSON.parse(metaText);
    } catch {
      // If metadata doesn't exist, create default metadata
      metadata = {
        id: Math.random().toString(36).substring(2, 15),
        isDirty: false,
        lastModified: Date.now(),
        active: true,
      };
    }

    return {
      id: metadata.id ?? Math.random().toString(36).substring(2, 15),
      path,
      name: filename,
      content,
      isDirty: metadata.isDirty ?? false,
      lastModified: metadata.lastModified ?? Date.now(),
      active: metadata.active ?? true,
    };
  } catch (error) {
    console.warn(`Failed to load file from OPFS: ${path}`, error);
    return null;
  }
}

/**
 * Load all files from OPFS recursively
 */
export async function loadAllFilesFromOPFS(): Promise<VirtualFile[]> {
  const files: VirtualFile[] = [];

  async function traverseDirectory(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string = ''
  ) {
    for await (const entry of dirHandle.values()) {
      const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        await traverseDirectory(entry as FileSystemDirectoryHandle, fullPath);
      } else if (entry.kind === 'file' && !entry.name.endsWith('.meta')) {
        // Skip .meta files, only load actual content files
        const file = await loadFileFromOPFS(`/${fullPath}`);
        if (file) {
          files.push(file);
        }
      }
    }
  }

  const root = await getRootDirectory();
  await traverseDirectory(root);

  return files;
}

/**
 * Delete a file from OPFS
 */
export async function deleteFileFromOPFS(path: string): Promise<void> {
  const { dirPath, filename } = parsePath(path);
  const dir = dirPath ? await ensureDirectory(dirPath) : await getRootDirectory();

  try {
    // Delete content file
    await dir.removeEntry(filename);
  } catch (error) {
    console.warn(`Failed to delete file: ${path}`, error);
  }

  try {
    // Delete metadata file
    await dir.removeEntry(`${filename}.meta`);
  } catch {
    // Ignore if metadata doesn't exist
  }
}

/**
 * Clear all files from OPFS
 */
export async function clearOPFS(): Promise<void> {
  const root = await getRootDirectory();

  // Remove all entries in root directory
  for await (const entry of root.values()) {
    await root.removeEntry(entry.name, { recursive: entry.kind === 'directory' });
  }
}

/**
 * Check if OPFS has any files
 */
export async function hasOPFSFiles(): Promise<boolean> {
  const root = await getRootDirectory();

  // Check if root directory has any entries (excluding .meta files)
  for await (const entry of root.values()) {
    if (entry.kind === 'file' && !entry.name.endsWith('.meta')) {
      return true;
    }
    if (entry.kind === 'directory') {
      return true; // Assume directories contain files
    }
  }

  return false;
}

/**
 * Rename/move a file in OPFS
 */
export async function renameFileInOPFS(oldPath: string, newPath: string): Promise<void> {
  // Load the file
  const file = await loadFileFromOPFS(oldPath);
  if (!file) {
    throw new Error(`File not found: ${oldPath}`);
  }

  // Update the path
  file.path = newPath;
  file.name = newPath.split('/').pop() || file.name;

  // Save to new location
  await saveFileToOPFS(file);

  // Delete old file
  await deleteFileFromOPFS(oldPath);
}

/**
 * Check if a file exists in OPFS
 */
export async function fileExistsInOPFS(path: string): Promise<boolean> {
  try {
    const { dirPath, filename } = parsePath(path);
    const dir = dirPath ? await ensureDirectory(dirPath) : await getRootDirectory();
    await dir.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content directly (without metadata)
 * Useful for USD reference resolution
 */
export async function readFileContent(path: string): Promise<string | null> {
  try {
    const { dirPath, filename } = parsePath(path);
    const dir = dirPath ? await ensureDirectory(dirPath) : await getRootDirectory();
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}
