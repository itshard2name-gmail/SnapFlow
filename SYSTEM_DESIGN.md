# System Design - Scope

## Overview

Scope is a high-performance screen capture tool for macOS, designed to eliminate overlay lag and capture fleeting desktop states (like dropdown menus). It features three core modes: Region, Window, and Scroll Capture, plus a professional annotation suite.

## Architecture

The application follows a standard Electron multi-process architecture:

- **Main Process**: Handles global shortcuts, native window detection (via Swift), image processing (via Sharp), and local database management (via Better-SQLite3).
- **Renderer Process**: A React-based UI providing the Dashboard, "Live Overlay", and a professional Annotation Engine with native Zoom/Pan.
- **Native Integration**: Custom Swift scripts are used for precise window detection and keycode simulation (for scrolling).

### 1. Zero-Latency Overlay

Traditional capture tools often pause the screen or steal focus when an overlay is launched. Scope uses a transparent, non-focus-stealing `BrowserWindow` that acts as a "drawing canvas" over the entire screen. This allows users to capture menus that would otherwise close upon a focus change.

### 2. Smart Scroll Capture

Scroll capture is implemented using a feedback loop:

1.  **Region Selection**: User selects the scrollable area.
2.  **Capture Loop**:
    - Take a screenshot of the region.
    - Simulate a scroll down event (Arrow Down).
    - Wait for content stabilization.
    - Check for duplicate frames (exit condition).
3.  **Smart Stitching**:
    - **Block Matching**: Compares the bottom of the previous frame with the top/middle of the current frame to find the exact overlap.
    - **Inertia**: Uses the previous scroll distance to narrow the search range for the next overlap.
    - **Sticky Header Detection**: Automatically identifies and crops fixed-position headers.

### 3. Native Bridge (Swift)

- `get-windows.swift`: Uses `CGWindowListCopyWindowInfo` to get accurate bounds of all visible windows.
- `click.swift` / `keypress.swift`: Uses `CGEventPost` to simulate user interactions.

### 4. Annotation Engine

Built on **Fabric.js**, the annotation engine supports:

- **Native Viewport Scaling**: Pixel-perfect zooming and panning for high-resolution captures.
- **Non-Destructive Tools**: Vectors-based drawing (Arrow, Box, Pen) and text.
- **Privacy Filters**: Real-time pixelation (Mosaic) for redacting sensitive information.
- **1:1 Export**: Ensures annotated images maintain original resolution and quality.

## Data Flow

```mermaid
graph TD
    UI[React Dashboard] <--> |IPC| Bridge[Preload Script]
    Bridge <--> |IPC| Main[Electron Main Process]
    Main --> |Exec| Swift[Swift Scripts]
    Main --> |Sharp| ImageProc[Image Processing]
    Main --> |SQL| DB[(SQLite)]
    KeyShortcut[Global Shortcuts] --> Main
```

## Security & Privacy

- **Local-By-Design**: All captures and database records (including Notes) are stored locally on the user's machine.
- **Permissions**: Requires "Screen Recording" and "Accessibility" permissions on macOS.
