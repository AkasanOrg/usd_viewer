import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { VirtualFile, WorkspaceStore, ParseError } from '../types/virtualFileSystem';
import {
  saveFileToStorage,
  loadFilesFromStorage,
  deleteFileFromStorage,
  clearStorage,
  hasStoredFiles,
} from '../utils/indexedDB';

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Default USDA content for new files
const DEFAULT_USDA_CONTENT = `#usda 1.0
(
    defaultPrim = "World"
)

def Xform "World"
{
}
`;

// Sample file definitions (paths in virtual file system -> paths in public folder)
const SAMPLE_FILES = [
  { virtualPath: '/main.usda', samplePath: '/samples/main.usda' },
  { virtualPath: '/models/cube.usda', samplePath: '/samples/models/cube.usda' },
  { virtualPath: '/models/shapes.usda', samplePath: '/samples/models/shapes.usda' },
];

// Load sample files from public folder
async function loadSampleFiles(): Promise<Map<string, VirtualFile>> {
  const map = new Map<string, VirtualFile>();

  for (const { virtualPath, samplePath } of SAMPLE_FILES) {
    try {
      const response = await fetch(samplePath);
      if (!response.ok) {
        console.warn(`Failed to load sample file: ${samplePath}`);
        continue;
      }
      const content = await response.text();
      const name = virtualPath.split('/').pop() || 'untitled.usda';

      const file: VirtualFile = {
        id: generateId(),
        path: virtualPath,
        name,
        content,
        isDirty: false,
        lastModified: Date.now(),
        active: true,
      };
      map.set(virtualPath, file);
    } catch (error) {
      console.warn(`Error loading sample file ${samplePath}:`, error);
    }
  }

  return map;
}

// Extended workspace store with storage operations
interface ExtendedWorkspaceStore extends WorkspaceStore {
  clearAllFiles: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
}

// Create context
const WorkspaceContext = createContext<ExtendedWorkspaceStore | null>(null);

// Provider component
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Map<string, VirtualFile>>(() => new Map());
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFilePaths, setOpenFilePaths] = useState<string[]>([]);
  const [errors, setErrorsState] = useState<ParseError[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize: load files from IndexedDB or load samples
  useEffect(() => {
    async function initializeFiles() {
      try {
        const hasFiles = await hasStoredFiles();

        if (hasFiles) {
          // Load from IndexedDB
          const storedFiles = await loadFilesFromStorage();
          const map = new Map<string, VirtualFile>();
          for (const file of storedFiles) {
            map.set(file.path, file);
          }
          setFiles(map);

          // Set first file as active if any exist
          if (storedFiles.length > 0) {
            const mainFile = storedFiles.find(f => f.path === '/main.usda');
            const firstPath = mainFile?.path || storedFiles[0].path;
            setActiveFilePath(firstPath);
            setOpenFilePaths([firstPath]);
          }
        } else {
          // Load sample files from public folder and save to IndexedDB
          const sampleFiles = await loadSampleFiles();
          setFiles(sampleFiles);
          setActiveFilePath('/main.usda');
          setOpenFilePaths(['/main.usda']);

          // Save sample files to IndexedDB
          for (const file of sampleFiles.values()) {
            await saveFileToStorage(file);
          }
        }
      } catch (error) {
        console.error('Failed to initialize files from storage:', error);
        // Fallback to loading samples on error
        try {
          const sampleFiles = await loadSampleFiles();
          setFiles(sampleFiles);
          setActiveFilePath('/main.usda');
          setOpenFilePaths(['/main.usda']);
        } catch (sampleError) {
          console.error('Failed to load sample files:', sampleError);
        }
      } finally {
        setIsLoading(false);
      }
    }

    initializeFiles();
  }, []);

  // Create a new file
  const createFile = useCallback((path: string, content?: string): VirtualFile => {
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const name = normalizedPath.split('/').pop() || 'untitled.usda';

    const newFile: VirtualFile = {
      id: generateId(),
      path: normalizedPath,
      name,
      content: content ?? DEFAULT_USDA_CONTENT,
      isDirty: false,
      lastModified: Date.now(),
      active: true,
    };

    setFiles((prev) => {
      const next = new Map(prev);
      next.set(normalizedPath, newFile);
      return next;
    });

    // Save to IndexedDB
    saveFileToStorage(newFile).catch(console.error);

    // Auto-open the new file
    setOpenFilePaths((prev) => {
      if (!prev.includes(normalizedPath)) {
        return [...prev, normalizedPath];
      }
      return prev;
    });
    setActiveFilePath(normalizedPath);

    return newFile;
  }, []);

  // Update file content
  const updateFileContent = useCallback((path: string, content: string) => {
    setFiles((prev) => {
      const file = prev.get(path);
      if (!file) return prev;

      const updatedFile = {
        ...file,
        content,
        isDirty: true,
        lastModified: Date.now(),
      };

      // Save to IndexedDB
      saveFileToStorage(updatedFile).catch(console.error);

      const next = new Map(prev);
      next.set(path, updatedFile);
      return next;
    });
  }, []);

  // Delete a file
  const deleteFile = useCallback((path: string) => {
    setFiles((prev) => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });

    // Delete from IndexedDB
    deleteFileFromStorage(path).catch(console.error);

    // Remove from open files
    setOpenFilePaths((prev) => prev.filter((p) => p !== path));

    // Update active file if deleted
    setActiveFilePath((prev) => {
      if (prev === path) {
        const remaining = openFilePaths.filter((p) => p !== path);
        return remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
      return prev;
    });
  }, [openFilePaths]);

  // Rename a file
  const renameFile = useCallback((oldPath: string, newPath: string) => {
    setFiles((prev) => {
      const file = prev.get(oldPath);
      if (!file) return prev;

      const normalizedNewPath = newPath.startsWith('/') ? newPath : `/${newPath}`;
      const newName = normalizedNewPath.split('/').pop() || file.name;

      const renamedFile = {
        ...file,
        path: normalizedNewPath,
        name: newName,
        lastModified: Date.now(),
      };

      // Delete old file from IndexedDB and save new one
      deleteFileFromStorage(oldPath).catch(console.error);
      saveFileToStorage(renamedFile).catch(console.error);

      const next = new Map(prev);
      next.delete(oldPath);
      next.set(normalizedNewPath, renamedFile);
      return next;
    });

    // Update open files
    setOpenFilePaths((prev) =>
      prev.map((p) => (p === oldPath ? newPath : p))
    );

    // Update active file
    setActiveFilePath((prev) => (prev === oldPath ? newPath : prev));
  }, []);

  // Open a file in tabs
  const openFile = useCallback((path: string) => {
    setOpenFilePaths((prev) => {
      if (!prev.includes(path)) {
        return [...prev, path];
      }
      return prev;
    });
    setActiveFilePath(path);
  }, []);

  // Close a file tab
  const closeFile = useCallback((path: string) => {
    setOpenFilePaths((prev) => {
      const next = prev.filter((p) => p !== path);
      return next;
    });

    setActiveFilePath((prev) => {
      if (prev === path) {
        const remaining = openFilePaths.filter((p) => p !== path);
        return remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
      return prev;
    });
  }, [openFilePaths]);

  // Set active file
  const setActiveFile = useCallback((path: string | null) => {
    setActiveFilePath(path);
  }, []);

  // Toggle file active state (whether it's included in stage composition)
  const toggleFileActive = useCallback((path: string) => {
    setFiles((prev) => {
      const file = prev.get(path);
      if (!file) return prev;

      const updatedFile = {
        ...file,
        active: !file.active,
      };

      // Save to IndexedDB
      saveFileToStorage(updatedFile).catch(console.error);

      const next = new Map(prev);
      next.set(path, updatedFile);
      return next;
    });
  }, []);

  // Error management
  const setErrors = useCallback((newErrors: ParseError[]) => {
    setErrorsState(newErrors);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState([]);
  }, []);

  // Import files
  const importFiles = useCallback(async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      if (file.name.endsWith('.usda') || file.name.endsWith('.usd')) {
        const content = await file.text();
        createFile(`/${file.name}`, content);
      }
    }
  }, [createFile]);

  // Get a single file
  const getFile = useCallback((path: string): VirtualFile | undefined => {
    return files.get(path);
  }, [files]);

  // Get all files
  const getAllFiles = useCallback((): VirtualFile[] => {
    return Array.from(files.values());
  }, [files]);

  // Clear all files from storage
  const clearAllFiles = useCallback(async () => {
    await clearStorage();
    setFiles(new Map());
    setActiveFilePath(null);
    setOpenFilePaths([]);
    setErrorsState([]);
  }, []);

  // Reset to default files (load from sample files)
  const resetToDefaults = useCallback(async () => {
    await clearStorage();
    const sampleFiles = await loadSampleFiles();
    setFiles(sampleFiles);
    setActiveFilePath('/main.usda');
    setOpenFilePaths(['/main.usda']);
    setErrorsState([]);

    // Save sample files to IndexedDB
    for (const file of sampleFiles.values()) {
      await saveFileToStorage(file);
    }
  }, []);

  const store: ExtendedWorkspaceStore = {
    files,
    activeFilePath,
    openFilePaths,
    errors,
    createFile,
    updateFileContent,
    deleteFile,
    renameFile,
    toggleFileActive,
    openFile,
    closeFile,
    setActiveFile,
    setErrors,
    clearErrors,
    importFiles,
    getFile,
    getAllFiles,
    clearAllFiles,
    resetToDefaults,
    isLoading,
  };

  return (
    <WorkspaceContext.Provider value={store}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// Hook to use workspace
export function useWorkspace(): ExtendedWorkspaceStore {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
