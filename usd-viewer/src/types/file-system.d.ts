/**
 * Extended type definitions for File System Access API
 * This adds missing async iterator methods to FileSystemDirectoryHandle
 */

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}
