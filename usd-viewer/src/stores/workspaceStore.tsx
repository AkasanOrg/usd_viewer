import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { VirtualFile, WorkspaceStore, ParseError } from '../types/virtualFileSystem';

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

// Default main.usda with reference example
const DEFAULT_MAIN_USDA = `#usda 1.0
(
    defaultPrim = "World"
    startTimeCode = 0
    endTimeCode = 48
)

def Xform "World"
{
    # Direct sphere with animation
    def Sphere "AnimatedSphere"
    {
        double radius.timeSamples = {
            0: 0.5,
            24: 1.5,
            48: 0.5,
        }
        double3 xformOp:translate.timeSamples = {
            0: (0, 0, 0),
            24: (2, 1, 0),
            48: (0, 0, 0),
        }
        color3f[] primvars:displayColor = [(1.0, 0.3, 0.2)]
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }

    # Referenced cube from another file
    # Create /models/cube.usda to see this reference work!
    def "RefCube" (
        references = @./models/cube.usda@
    ) {
        double3 xformOp:translate = (-3, 0, 0)
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }

    # Referenced sphere from another file with prim path
    # Create /models/shapes.usda to see this reference work!
    def "RefSphere" (
        references = @./models/shapes.usda@</Shapes/GreenSphere>
    ) {
        double3 xformOp:translate = (3, 0, 0)
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }
}
`;

// Sample cube file for references
const SAMPLE_CUBE_USDA = `#usda 1.0
(
    defaultPrim = "MyCube"
)

def Cube "MyCube"
{
    double size = 0.8
    color3f[] primvars:displayColor = [(0.2, 0.6, 1.0)]
}
`;

// Sample shapes file for references
const SAMPLE_SHAPES_USDA = `#usda 1.0
(
    defaultPrim = "Shapes"
)

def Xform "Shapes"
{
    def Sphere "GreenSphere"
    {
        double radius = 0.5
        color3f[] primvars:displayColor = [(0.2, 0.8, 0.3)]
    }

    def Sphere "YellowSphere"
    {
        double radius = 0.3
        double3 xformOp:translate = (0, 1, 0)
        color3f[] primvars:displayColor = [(1.0, 0.9, 0.2)]
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }
}
`;

// Create context
const WorkspaceContext = createContext<WorkspaceStore | null>(null);

// Provider component
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Map<string, VirtualFile>>(() => {
    // Initialize with default files including sample references
    const map = new Map<string, VirtualFile>();

    // Main file
    const mainFile: VirtualFile = {
      id: generateId(),
      path: '/main.usda',
      name: 'main.usda',
      content: DEFAULT_MAIN_USDA,
      isDirty: false,
      lastModified: Date.now(),
      active: true,
    };
    map.set(mainFile.path, mainFile);

    // Sample cube file (referenced by main.usda)
    const cubeFile: VirtualFile = {
      id: generateId(),
      path: '/models/cube.usda',
      name: 'cube.usda',
      content: SAMPLE_CUBE_USDA,
      isDirty: false,
      lastModified: Date.now(),
      active: true,
    };
    map.set(cubeFile.path, cubeFile);

    // Sample shapes file (referenced by main.usda)
    const shapesFile: VirtualFile = {
      id: generateId(),
      path: '/models/shapes.usda',
      name: 'shapes.usda',
      content: SAMPLE_SHAPES_USDA,
      isDirty: false,
      lastModified: Date.now(),
      active: true,
    };
    map.set(shapesFile.path, shapesFile);

    return map;
  });

  const [activeFilePath, setActiveFilePath] = useState<string | null>('/main.usda');
  const [openFilePaths, setOpenFilePaths] = useState<string[]>(['/main.usda']);
  const [errors, setErrorsState] = useState<ParseError[]>([]);

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

      const next = new Map(prev);
      next.set(path, {
        ...file,
        content,
        isDirty: true,
        lastModified: Date.now(),
      });
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

      const next = new Map(prev);
      next.delete(oldPath);
      next.set(normalizedNewPath, {
        ...file,
        path: normalizedNewPath,
        name: newName,
        lastModified: Date.now(),
      });
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

      const next = new Map(prev);
      next.set(path, {
        ...file,
        active: !file.active,
      });
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

  const store: WorkspaceStore = {
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
  };

  return (
    <WorkspaceContext.Provider value={store}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// Hook to use workspace
export function useWorkspace(): WorkspaceStore {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
