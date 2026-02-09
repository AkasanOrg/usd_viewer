import { useRef, useCallback } from 'react';
import { downloadAsFile, isValidUsdaFile } from '../utils/fileUtils';

interface FileToolbarProps {
  currentFilename: string;
  onImport: (files: FileList) => void;
  onExport: () => void;
  onRecordVideo: () => void;
  onResetStorage: () => void;
  hasAnimation: boolean;
  isRecording: boolean;
  recordingProgress?: { current: number; total: number };
}

export function FileToolbar({
  currentFilename,
  onImport,
  onExport,
  onRecordVideo,
  onResetStorage,
  hasAnimation,
  isRecording,
  recordingProgress,
}: FileToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      // Validate files
      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        if (isValidUsdaFile(file.name)) {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) {
        alert('Please select .usda or .usd files');
        return;
      }

      // Create a new FileList-like object with only valid files
      const dataTransfer = new DataTransfer();
      validFiles.forEach((file) => dataTransfer.items.add(file));
      onImport(dataTransfer.files);

      event.target.value = '';
    },
    [onImport]
  );

  return (
    <div className="file-toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".usda,.usd"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button className="toolbar-button" onClick={handleImportClick} title="Import USD files">
        Import
      </button>
      <button
        className="toolbar-button"
        onClick={onExport}
        title={`Export as ${currentFilename}`}
      >
        Export
      </button>
      <button
        className={`toolbar-button ${isRecording ? 'recording' : ''}`}
        onClick={onRecordVideo}
        disabled={!hasAnimation || isRecording}
        title={hasAnimation ? 'Record animation as video' : 'No animation to record'}
      >
        {isRecording ? (
          <>
            Recording...{' '}
            {recordingProgress && `${recordingProgress.current}/${recordingProgress.total}`}
          </>
        ) : (
          'Record Video'
        )}
      </button>
      <button
        className="toolbar-button reset-button"
        onClick={onResetStorage}
        title="Reset to default files (clears local storage)"
      >
        Reset
      </button>
    </div>
  );
}

export { downloadAsFile };
