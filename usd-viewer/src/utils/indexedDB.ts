import type { VirtualFile } from '../types/virtualFileSystem';

const DB_NAME = 'usd-viewer-db';
const DB_VERSION = 1;
const STORE_NAME = 'files';

// Open IndexedDB connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
  });
}

// Save a single file to IndexedDB
export async function saveFileToStorage(file: VirtualFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);

    request.onerror = () => {
      reject(new Error('Failed to save file'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Save multiple files to IndexedDB
export async function saveAllFilesToStorage(files: VirtualFile[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const file of files) {
      store.put(file);
    }

    transaction.onerror = () => {
      reject(new Error('Failed to save files'));
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

// Load all files from IndexedDB
export async function loadFilesFromStorage(): Promise<VirtualFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
      reject(new Error('Failed to load files'));
    };

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Delete a file from IndexedDB
export async function deleteFileFromStorage(path: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(path);

    request.onerror = () => {
      reject(new Error('Failed to delete file'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Clear all files from IndexedDB
export async function clearStorage(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => {
      reject(new Error('Failed to clear storage'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Check if storage has any files
export async function hasStoredFiles(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => {
      reject(new Error('Failed to check storage'));
    };

    request.onsuccess = () => {
      resolve(request.result > 0);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}
