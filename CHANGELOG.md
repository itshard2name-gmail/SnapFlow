# Changelog

All notable changes to this project will be documented in this file.

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
