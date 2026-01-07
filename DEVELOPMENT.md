# Development Guidelines & Rules

> **Note to AI Agents:** You MUST read and follow these rules strictly when implementing changes in this codebase. This project enforces strict ESLint rules that will block commits if violated.

## 1. Strict Type Safety

- **Explicit Return Types:** ALL functions (including arrow functions, hooks, and component renders) MUST have an explicit return type.
  - ✅ `const MyComponent = (): ReactElement => { ... }`
  - ✅ `useEffect((): void => { ... }, [])`
  - ✅ `const handleClick = async (): Promise<void> => { ... }`
  - ❌ `const MyComponent = () => { ... }`
- **No `any`:** Do not use `any`. Define proper interfaces or types.
  - If unsure, use `unknown` and narrow it, or check shared types.
- **Imports:**
  - Use `ReactElement` from `react` for component return types, NOT `JSX.Element`.

## 2. React Best Practices

- **Hooks Dependencies:** `useEffect`, `useCallback`, and `useMemo` dependency arrays must be exhaustive.
  - If you think a dependency should be omitted, you are likely doing it wrong. Use `useRef` or refactor the logic.
- **State in Effect:** Do not call `setState` inside `useEffect` without proper guards or memoization to prevent infinite loops.

## 3. Main Process (Electron)

- **ES6 Imports:** Use `import ... from ...` syntax.
  - ❌ `const path = require('path')`
  - ✅ `import path from 'path'`
- **Type Safety in IPC:** When handling IPC events, explicitly type the arguments and return values.

## 4. Verification Protocol (The "Lint-First" Rule)

Before you claim a task is complete or try to commit code, you MUST run:

```bash
npm run typecheck && npm run lint
```

- If this fails, **STOP**. Fix the errors immediately.
- Do not disable ESLint rules (e.g., `eslint-disable`) unless absolutely necessary and providing a valid reason.

## 5. Artifacts & Documentation

- Update `system_design.md` if architectural changes are made.
- Keep `task.md` updated with your progress.

## 6. Handling Static Assets

- **Implicit Dependencies:** Files not imported in JS (e.g., Swift scripts, binaries) are NOT bundled by default.
- **Rule:** If you add a new external script:
  1. Add it to `src/main/scripts/` (or appropriate dir).
  2. **MUST** update `electron-builder.yml` -> `extraResources` to ensure it's copied to the production bundle.
  3. Update `capture.ts` (or consumer) to correctly resolve the path in both Dev (`__dirname`) and Prod (`process.resourcesPath`).
