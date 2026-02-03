import { useRef, useCallback } from 'react';
import { readFileAsText, downloadAsFile, isValidUsdaFile } from '../utils/fileUtils';

interface FileToolbarProps {
  currentFilename: string;
  onImport: (content: string, filename: string) => void;
  onExport: () => void;
  onRecordVideo: () => void;
  hasAnimation: boolean;
  isRecording: boolean;
  recordingProgress?: { current: number; total: number };
}

export function FileToolbar({
  currentFilename,
  onImport,
  onExport,
  onRecordVideo,
  hasAnimation,
  isRecording,
  recordingProgress,
}: FileToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isValidUsdaFile(file.name)) {
      alert('Please select a .usda or .usd file');
      return;
    }

    try {
      const content = await readFileAsText(file);
      onImport(content, file.name);
    } catch (err) {
      alert('Failed to read file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    event.target.value = '';
  }, [onImport]);

  return (
    <div className="file-toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".usda,.usd"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        className="toolbar-button"
        onClick={handleImportClick}
        title="Import USD file"
      >
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
            Recording... {recordingProgress && `${recordingProgress.current}/${recordingProgress.total}`}
          </>
        ) : (
          'Record Video'
        )}
      </button>
    </div>
  );
}

export { downloadAsFile };
