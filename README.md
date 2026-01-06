# Scope

**Zero-Latency Screen Capture for Professionals.**

Scope is a high-performance screen capture tool designed for speed and precision. Built on a modernized Electron architecture, it eliminates the traditional "overlay lag," ensuring that your flow detects windows and regions instantenously.

![Scope Banner](./build/icon.png)

## Why Scope?

### ⚡️ Zero-Latency Engine
Traditional capture tools pause your screen to load a static image, creating a 2-3 second delay. Scope uses a **Live Overlay** architecture that appears instantly (< 50ms), allowing you to capture fleeting moments without hesitation.

### 🎯 Intelligent Window Snapping
Hover over any application—even in multi-monitor setups—and Scope will instantly highlight the window boundaries. 
- **Privacy-First**: We use macOS Accessibility APIs to detect window frames without recording screen contents until you click.
- **Smart Handling**: Correctly handles high-DPI (Retina) scaling and multi-display offsets.

### 💧 Seamless UX
- **Dropdown Support**: Designed to capture menus, popups, and dropdowns. Scope's non-intruding overlay won't steal focus, keeping your detailed UI interactions open while you capture.
- **Instant Dashboard**: Your captures are saved to a gallery immediately. Closing the dashboard simply hides it, so it's ready instantly when you need it again.

## Quick Start

### Global Shortcuts

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Region Capture** | `Ctrl` + `Shift` + `A` | Drag to select any area. Precision pixel-perfect selection. |
| **Window Capture** | `Ctrl` + `Shift` + `W` | Auto-detects windows under your cursor. Click to snap. |
| **Cancel** | `Esc` |  Instantly dismiss the overlay. |

### Installation (macOS)
1. Download the latest `.dmg` release.
2. Drag **Scope** to your Applications folder.
3. On first launch, you will be prompted to grant **Screen Recording** and **Accessibility** permissions. This is required for the zero-latency engine to detect windows.

---

## For Developers

Scope is built with **Electron**, **React**, and **TypeScript**.

### Build from Source
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for macOS
npm run build:mac
```

### Tech Stack
- **Core**: Electron, Node.js
- **Renderer**: React 18, TypeScript, TailwindCSS
- **Storage**: SQLite (Local Database)
- **Engine**: Native `screencapture` CLI integration with custom swift window detection.
