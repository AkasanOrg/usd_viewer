import type { ParseError } from '../types/virtualFileSystem';
import './ErrorPanel.css';

interface ErrorPanelProps {
  errors: ParseError[];
  onClose: () => void;
}

const errorTypeLabels: Record<ParseError['type'], string> = {
  missing_file: 'Missing File',
  circular_reference: 'Circular Reference',
  invalid_prim_path: 'Invalid Prim Path',
  parse_error: 'Parse Error',
};

const errorTypeIcons: Record<ParseError['type'], string> = {
  missing_file: '📁',
  circular_reference: '🔄',
  invalid_prim_path: '🔍',
  parse_error: '⚠️',
};

export function ErrorPanel({ errors, onClose }: ErrorPanelProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="error-panel">
      <div className="error-panel-header">
        <span className="error-panel-title">
          Problems ({errors.length})
        </span>
        <button className="error-panel-close" onClick={onClose} title="Clear">
          ×
        </button>
      </div>
      <div className="error-panel-content">
        {errors.map((error, index) => (
          <div key={index} className={`error-item error-${error.type}`}>
            <span className="error-icon">{errorTypeIcons[error.type]}</span>
            <div className="error-details">
              <span className="error-type">{errorTypeLabels[error.type]}</span>
              <span className="error-message">{error.message}</span>
              <span className="error-file">{error.filePath}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
