import { useState } from 'react';
import './NewFileDialog.css';

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (path: string) => void;
  existingPaths: string[];
}

export function NewFileDialog({
  isOpen,
  onClose,
  onCreate,
  existingPaths,
}: NewFileDialogProps) {
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = filename.trim();
    if (!trimmed) {
      setError('Filename is required');
      return;
    }

    // Add .usda extension if not present
    let finalName = trimmed;
    if (!finalName.endsWith('.usda') && !finalName.endsWith('.usd')) {
      finalName += '.usda';
    }

    // Normalize path
    const path = finalName.startsWith('/') ? finalName : `/${finalName}`;

    // Check for duplicates
    if (existingPaths.includes(path)) {
      setError('A file with this name already exists');
      return;
    }

    onCreate(path);
    setFilename('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setFilename('');
    setError('');
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>New File</h3>
          <button className="dialog-close" onClick={handleClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="dialog-content">
            <label htmlFor="filename">Filename:</label>
            <input
              id="filename"
              type="text"
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                setError('');
              }}
              placeholder="e.g., models/cube.usda"
              autoFocus
            />
            {error && <span className="dialog-error">{error}</span>}
            <span className="dialog-hint">
              Use "/" for subdirectories (e.g., models/cube.usda)
            </span>
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-create">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
