// Virtual file representation
export interface VirtualFile {
  id: string;
  path: string;       // e.g., "/models/cube.usda"
  name: string;       // e.g., "cube.usda"
  content: string;
  isDirty: boolean;
  lastModified: number;
  active: boolean;    // Whether this file is included in stage composition
}

// Parse error types
export type ParseErrorType =
  | 'missing_file'
  | 'circular_reference'
  | 'invalid_prim_path'
  | 'parse_error';

export interface ParseError {
  type: ParseErrorType;
  message: string;
  filePath: string;
  line?: number;
}

// Reference/Payload information
export interface UsdReference {
  assetPath: string;     // e.g., "./models/cube.usda"
  primPath?: string;     // e.g., "/Sphere" (optional target prim)
}

// Workspace state
export interface WorkspaceState {
  files: Map<string, VirtualFile>;
  activeFilePath: string | null;
  openFilePaths: string[];
  errors: ParseError[];
}

// Workspace actions
export interface WorkspaceActions {
  // File operations
  createFile: (path: string, content?: string) => VirtualFile;
  updateFileContent: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  toggleFileActive: (path: string) => void;

  // Tab operations
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;

  // Error management
  setErrors: (errors: ParseError[]) => void;
  clearErrors: () => void;

  // Bulk operations
  importFiles: (files: FileList) => Promise<void>;
  getFile: (path: string) => VirtualFile | undefined;
  getAllFiles: () => VirtualFile[];
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;
