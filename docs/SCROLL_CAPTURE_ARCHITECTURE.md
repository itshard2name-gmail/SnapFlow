# Scroll Capture Architecture: Decisions & Trade-offs

## 1. Overview

This document outlines the architectural decisions behind SnapFlow's "Scroll Capture" implementation, explains the trade-offs made for universality versus robust precision, and details future improvement directions.

## 2. Current Architecture: "OS-Level Visual Stitching"

### The Approach

SnapFlow currently employs a **"Blind Capture + Optical Flow Stitching"** methodology:

1.  **Blind Capture**: The system has no awareness of the target application's internal state (DOM, Scroll Height). It simulates user input (Arrow Down keys) to scroll the window blindly.
2.  **Fixed Region**: It captures the exact same screen coordinates (Screen Rect) repeatedly.
3.  **Visual Stitching (Pixel Matching)**: It relies entirely on an image processing algorithm to find overlapping pixels between consecutive frames to determine how much the content moved.

### Why This Approach? (The Trade-offs)

#### A. Universality (Priority #1)

- **Goal**: To support capturing **ANY** application with a scrollbar, not just web browsers. This includes PDF readers, Slack, VS Code, native settings panels, etc.
- **Constraint**: Native desktop apps do not expose a uniform API (like the DOM in browsers) to query "Content Height" or "Scroll Position".
- **Result**: We cannot rely on code injection or state reading. We must rely on what the user _sees_.

#### B. Security & Feasibility

- **Constraint**: Directly controlling external applications (e.g., injecting JS into Chrome from an Electron app) requires invasive permissions (Accessibility API, Debug Protocol) that are often blocked by OS security policies or require complex user setup.
- **Result**: Simulating global keystrokes (`Arrow Down`) is the least invasive and most reliable method to trigger scrolling across different apps.

## 3. Current Limitations & Pain Points

Since the system lacks "Ground Truth" (exact scroll distance), it must guess. This leads to specific failures:

### A. The "Zero Overlap" Bug

- **Symptom**: Stitched images have duplicated content or "stuttered" sections.
- **Cause**: If the stitching algorithm fails to find a confident match (e.g., due to rendering noise or large scroll jumps), it defaults to **0px overlap**. This causes the system to append the new image directly to the old one without removing the duplicate processing.

### B. The "Sticky Header" Problem

- **Symptom**: Fixed headers (sticky nav bars) appear repeatedly in the final image or confuse the stitching logic.
- **Cause**: The algorithm searches for matching pixels. A sticky header _never moves_.
  - If the algorithm matches the header execution, it calculates **0 movement**, causing infinite loops or cut-off content.
  - If the capturing area includes the header, the header is stamped into every single frame.

### C. Sensitivity to Selection Height

- **Symptom**: Selection boxes that are too short fail to stitch.
- **Cause**:
  - **Too Short**: The search window (e.g., 10% of height) is smaller than the scroll distance. The overlapping content "jumps over" the search area entirely.
  - **Too Tall**: Increases the chance of false positive matches (e.g., repeating background patterns).

## 4. Alternate "Standard" Approaches (Why we didn't use them)

These approaches are industry standards for specific use cases but were rejected due to the universality requirement.

| Approach              | Mechanism                                  | Pros                                                           | Cons                                                                                               |
| :-------------------- | :----------------------------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **JS Injection**      | Inject JS into browser (Extension/Console) | **100% Perfect Stitching**. Can remove sticky headers via DOM. | **Browser Only**. Won't work for Slack, PDF, etc.                                                  |
| **Accessibility API** | Read Scrollbar UI values from OS           | Better precision than blind keys.                              | **Hard/Flaky**. Many modern apps (Flutter/Electron) draw custom scrollbars that OS APIs can't see. |

## 5. Future Improvement Directions

We aim to optimize the current "Visual Stitching" architecture to reach >95% reliability without sacrificing universality.

### Phase 1: Robust Algorithm (Software Only)

- **Bottom-Up Matching**: Instead of matching the _Top_ of the new frame (prone to headers), match the _Bottom_ of the old frame (usually unique content) against the new frame.
- **Fail-Safe Validation**: If no overlap is found, **DO NOT** default to 0. Abort or retry (undo scroll).
- **Dynamic Cropping**: Detect static rows (pixels that never change across scrolls) and auto-crop them before stitching to remove sticky headers.

### Phase 2: User-Assisted UX

- **"Traffic Light" Feedback**: Warn users if their selection region is too short specific to their screen resolution.
- **Manual Stitching Mode**: Allow users to manually adjust the stitch seam if the auto-algorithm fails.
