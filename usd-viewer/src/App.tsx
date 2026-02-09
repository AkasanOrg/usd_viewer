import { useCallback, useState, useRef, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { UsdaEditor } from './components/UsdaEditor';
import { UsdViewer } from './components/UsdViewer';
import { FileToolbar, downloadAsFile } from './components/FileToolbar';
import { FileTree } from './components/FileTree/FileTree';
import { FileTabs } from './components/FileTabs/FileTabs';
import { ErrorPanel } from './components/ErrorPanel';
import { NewFileDialog } from './components/NewFileDialog';
import { StageHierarchy } from './components/StageHierarchy/StageHierarchy';
import { useWorkspace } from './stores/workspaceStore';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import type { ParseError } from './types/virtualFileSystem';
import type { ParsedPrim } from './parsers/usdaParser';
import './App.css';

function App() {
  const {
    files,
    activeFilePath,
    openFilePaths,
    createFile,
    updateFileContent,
    deleteFile,
    toggleFileActive,
    openFile,
    closeFile,
    setActiveFile,
    importFiles,
    resetToDefaults,
    isLoading,
  } = useWorkspace();

  const [isRecording, setIsRecording] = useState(false);
  const [animationInfo, setAnimationInfo] = useState({
    hasAnimation: false,
    startFrame: 0,
    endFrame: 0,
    currentFrame: 0,
  });
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [stagePrims, setStagePrims] = useState<ParsedPrim[]>([]);
  const [selectedPrimPath, setSelectedPrimPath] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Get active file
  const activeFile = activeFilePath ? files.get(activeFilePath) : null;
  const activeContent = activeFile?.content ?? '';
  const activeFilename = activeFile?.name ?? 'scene.usda';

  // Get open files for tabs
  const openFiles = useMemo(() => {
    return openFilePaths
      .map((path) => files.get(path))
      .filter((f): f is NonNullable<typeof f> => f !== undefined);
  }, [openFilePaths, files]);

  const { startRecording, stopRecording } = useVideoRecorder({
    fps: 24,
    filename: activeFilename.replace(/\.(usda?|usd)$/i, '.webm'),
  });

  const handleSave = useCallback(
    (content: string) => {
      if (activeFilePath) {
        updateFileContent(activeFilePath, content);
      }
    },
    [activeFilePath, updateFileContent]
  );

  const handleChange = useCallback(
    (content: string | undefined) => {
      if (content !== undefined && activeFilePath) {
        updateFileContent(activeFilePath, content);
      }
    },
    [activeFilePath, updateFileContent]
  );

  const handleImport = useCallback(
    async (fileList: FileList) => {
      await importFiles(fileList);
    },
    [importFiles]
  );

  const handleExport = useCallback(() => {
    if (activeFile) {
      downloadAsFile(activeFile.content, activeFile.name);
    }
  }, [activeFile]);

  const handleResetStorage = useCallback(async () => {
    if (window.confirm('Reset to default files? All changes will be lost.')) {
      await resetToDefaults();
    }
  }, [resetToDefaults]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleRecordVideo = useCallback(() => {
    if (canvasRef.current && animationInfo.hasAnimation) {
      setIsRecording(true);
      startRecording(canvasRef.current);
    }
  }, [animationInfo.hasAnimation, startRecording]);

  const handleRecordingComplete = useCallback(() => {
    stopRecording();
    setIsRecording(false);
  }, [stopRecording]);

  const handleAnimationInfo = useCallback((info: typeof animationInfo) => {
    setAnimationInfo(info);
  }, []);

  const handleErrors = useCallback((errors: ParseError[]) => {
    setParseErrors(errors);
  }, []);

  const handleClearErrors = useCallback(() => {
    setParseErrors([]);
  }, []);

  const handlePrimsChange = useCallback((prims: ParsedPrim[]) => {
    setStagePrims(prims);
  }, []);

  const handlePrimSelect = useCallback((path: string) => {
    setSelectedPrimPath(path);
  }, []);

  const handleCreateFile = useCallback(() => {
    setShowNewFileDialog(true);
  }, []);

  const handleNewFileCreate = useCallback(
    (path: string) => {
      createFile(path);
    },
    [createFile]
  );

  const existingPaths = useMemo(() => Array.from(files.keys()), [files]);

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-message">Loading files from storage...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>USD Viewer</h1>
        <FileToolbar
          currentFilename={activeFilename}
          onImport={handleImport}
          onExport={handleExport}
          onRecordVideo={handleRecordVideo}
          onResetStorage={handleResetStorage}
          hasAnimation={animationInfo.hasAnimation}
          isRecording={isRecording}
          recordingProgress={
            isRecording
              ? {
                  current: Math.round(animationInfo.currentFrame),
                  total: animationInfo.endFrame,
                }
              : undefined
          }
        />
      </header>
      <main className="main-container">
        <aside className="sidebar">
          <FileTree
            files={files}
            activeFilePath={activeFilePath}
            onFileSelect={openFile}
            onFileCreate={handleCreateFile}
            onFileDelete={deleteFile}
            onToggleFileActive={toggleFileActive}
          />
        </aside>
        <div className="workspace">
          <FileTabs
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onTabSelect={setActiveFile}
            onTabClose={closeFile}
          />
          <div className="workspace-content">
            <div className="editor-panel">
              {activeFile ? (
                <UsdaEditor
                  key={activeFilePath}
                  initialValue={activeContent}
                  onSave={handleSave}
                  onChange={handleChange}
                />
              ) : (
                <div className="no-file-message">
                  No file selected. Create a new file or select one from the file tree.
                </div>
              )}
            </div>
            <div className="viewer-panel">
              <div className="viewer-content">
                <UsdViewer
                  usdaContent={activeContent}
                  currentFilePath={activeFilePath ?? '/'}
                  files={files}
                  onCanvasReady={handleCanvasReady}
                  isRecording={isRecording}
                  onRecordingComplete={handleRecordingComplete}
                  onAnimationInfo={handleAnimationInfo}
                  onErrors={handleErrors}
                  onPrimsChange={handlePrimsChange}
                />
                {parseErrors.length > 0 && (
                  <ErrorPanel errors={parseErrors} onClose={handleClearErrors} />
                )}
              </div>
              <StageHierarchy
                prims={stagePrims}
                selectedPrim={selectedPrimPath}
                onPrimSelect={handlePrimSelect}
              />
            </div>
          </div>
        </div>
      </main>
      <NewFileDialog
        isOpen={showNewFileDialog}
        onClose={() => setShowNewFileDialog(false)}
        onCreate={handleNewFileCreate}
        existingPaths={existingPaths}
      />
      <Analytics />
    </div>
  );
}

export default App;
