# SnapFlow

An Electron application with React and TypeScript for advanced screen capturing.

## Features

- **Region Capture**: Drag and select any area of your screen to capture.
- **Window Capture**: Automatically detects and detects windows for clean, precise captures.
- **High-DPI Support**: optimized for Retina displays.
- **Gallery**: Built-in simple gallery to view captures.

## Shortcuts

| Action          | Shortcut                  | Description                                                |
| --------------- | ------------------------- | ---------------------------------------------------------- |
| **Region Mode** | `Control` + `Shift` + `A` | Manually select a region to capture.                       |
| **Window Mode** | `Control` + `Shift` + `W` | Hover to highlight and click to capture a specific window. |
| **Cancel**      | `Esc`                     | Exit capture mode without saving.                          |

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
