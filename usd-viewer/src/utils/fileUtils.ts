import JSZip from 'jszip';
import type { VirtualFile } from '../types/virtualFileSystem';

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

export function isValidUsdaFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ext === 'usda' || ext === 'usd';
}

/**
 * Download all files as a ZIP archive with directory structure preserved
 */
export async function downloadAllFilesAsZip(
  files: Map<string, VirtualFile>,
  zipFilename: string = 'usd-files.zip'
): Promise<void> {
  const zip = new JSZip();

  // Add each file to the ZIP, preserving directory structure
  for (const [path, file] of files) {
    // Remove leading slash if present
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;

    // Add file to ZIP
    zip.file(normalizedPath, file.content);
  }

  // Generate ZIP file
  const blob = await zip.generateAsync({ type: 'blob' });

  // Download the ZIP file
  downloadBlob(blob, zipFilename);
}
