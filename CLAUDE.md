# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

USD Viewer - A code editor and visualization tool for USDA (Universal Scene Description Asset) files.

## Planned Features

- Code editor for USDA with syntax highlighting
- Real-time USD asset preview that updates when USDA code is saved

## Current Status

Active development. The project now includes:

- React + Vite frontend setup
- Monaco Editor integration for USDA editing
- Three.js + React Three Fiber for USD preview
- **OPFS (Origin Private File System)** for file storage - allows USD Reference and Payload features to work as if files are stored on disk
- USD parser with Reference and Payload resolution
- Virtual file system with directory structure support

## Development Setup

```bash
cd usd-viewer
npm install
npm run dev
```

## Technical Details

### File Storage - OPFS (Origin Private File System)

The application uses OPFS for file storage, providing several advantages:

1. **File System Semantics**: Files are stored with proper directory structure, making USD Reference and Payload work naturally
2. **Performance**: Faster read/write compared to IndexedDB, especially for large files
3. **Standard API**: Uses the File System Access API standard
4. **Privacy**: Files are stored in origin-private storage, isolated from other sites

### Browser Compatibility

OPFS requires modern browsers:
- Chrome/Edge 86+
- Safari 15.2+
- Firefox 111+

The application checks for OPFS support on startup.
