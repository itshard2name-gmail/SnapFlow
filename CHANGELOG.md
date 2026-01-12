# Changelog

All notable changes to this project will be documented in this file.

## [2.1.1] - 2026-01-12

### ✨ New Features & Enhancements

- **Skitch-style Annotation Tools**:
  - **Improved Arrow Tool**: Now features a tapered tail, sharper arrowhead, and a high-contrast white outer glow for better visibility.
  - **Arrow Sensitivity**: Optimized to only trigger on drag actions (> 5px), preventing accidental arrow creation from single clicks.
  - **Box & Text Refinements**: Reduced default stroke width and font size for more professional and balanced proportions.
- **Enhanced Navigation Experience**:
  - **ESC Key Remapping**: Pressing `ESC` during annotation now switches the active tool to "Select" mode instead of closing the view, preventing data loss from accidental keystrokes.
  - **Toolbar UI Polish**: Renamed the "CANCEL (ESC)" button to "CANCEL" for clarity.

### 🐞 Bug Fixes

- **State Synchronization**: Fixed an issue where the sidebar trash count did not update immediately after deleting, restoring, or emptying the trash.

## [2.1.0] - 2026-01-07

### ✨ New Features & Enhancements

- **Robust Scroll Capture Engine (v2)**:
  - Upgraded the stitching algorithm with **Block Matching** and **Inertia Prediction**.
  - Significantly reduced footer duplication and stitching artifacts during dynamic scrolling.
- **Dashboard UX Polish**:
  - **Copy to Clipboard**: Added a "Copy" quick action to capture cards with visual feedback.
  - **Tooltips**: Added descriptive tooltips for Preview, Copy, and Delete actions.

### 🐞 Bug Fixes

- **Window Mode Precision**: Fixed issue where the highlight box was misaligned on multi-monitor setups.
- **Scroll Stitching Artifacts**: Resolved issues causing content duplication in long screenshots.

### 🛠 Developer Experience

- **Strict Type Safety & Linting**:
  - Implemented **Husky** and **lint-staged** pre-commit hooks.
  - Added `DEVELOPMENT.md` with strict coding guidelines for AI agents and contributors.
  - Resolved all outstanding ESLint errors.
- **Infrastructure**: Updated dependencies to better support ARM64 architecture.
