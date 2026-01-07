# Scope

**Zero-Latency Screen Capture for Professionals.**

Scope is a high-performance screen capture tool designed for speed, precision, and uninterrupted workflows. Built on a modernized Electron architecture, it eliminates "overlay lag" and "focus stealing," ensuring you can capture exactly what you see—even fleeting menus and popups.

![Scope Banner](./build/icon.png)

## Why Scope?

### ⚡️ Zero-Latency Engine

Traditional tools pause your screen to load an overlay, often causing menus to close. Scope uses a **Live Overlay** architecture that appears instantly (< 16ms), allowing you to capture the moment without disrupting the state of your desktop.

### 📜 Smart Scroll Capture (New)

Capture full web pages or long documents effortlessly. Scope's **Smart Stitching** algorithm automatically detects overlapping content and stitches them into a seamless, pixel-perfect long screenshot.

### 🎯 Intelligent Window Snapping

Hover over any application—even in multi-monitor setups—and Scope instantly highlights window boundaries.

- **Privacy-First**: Uses native macOS APIs to detect frames without recording screen content.
- **Retina-Ready**: Pixel-perfect scaling for high-DPI displays.

### 💧 Seamless Workflow

- **Dropdown Safe**: Designed to capture menus, tooltips, and popups. Scope won't steal focus when activated.
- **Instant Dashboard**: Review, copy to clipboard, or save your captures immediately.
- **Local Storage**: All data lives on your machine. No cloud uploads.

## Quick Start

### Global Shortcuts

| Action             | Shortcut               | Description                                                 |
| :----------------- | :--------------------- | :---------------------------------------------------------- |
| **Region Capture** | `Ctrl` + `Shift` + `A` | Drag to select any area. Precision pixel-perfect selection. |
| **Window Capture** | `Ctrl` + `Shift` + `W` | Auto-detects windows under your cursor. Click to snap.      |
| **Scroll Capture** | `Ctrl` + `Shift` + `S` | Select a region and watch it auto-scroll and stitch.        |
| **Cancel**         | `Esc`                  | Instantly dismiss the overlay or stop scrolling.            |

### Installation (macOS)

1. Download the latest `.dmg` release.
2. Drag **Scope** to your Applications folder.
3. On first launch, you will be prompted to grant **Screen Recording** and **Accessibility** permissions. This is required for window detection and simulation.

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

> **Note for Contributors:** Please read `DEVELOPMENT.md` before submitting changes. This project enforces strict type safety and linting rules (checked via Husky).

### Tech Stack

- **Core**: Electron, Node.js
- **Renderer**: React 18, TypeScript, TailwindCSS
- **Storage**: SQLite (Local Database)
- **Engine**: Native `screencapture` CLI integration with custom swift window detection.
