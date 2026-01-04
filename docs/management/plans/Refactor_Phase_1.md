# Refactor Phase 1: Foundation & Safety Protocols

## Strategy: "Lift and Shift"
To prevent regression and "spaghetti code," we will adhere to a strict **Lift and Shift** protocol:
1.  **Extract, Don't Rewrite**: When moving logic (e.g., from `page.tsx` to a View), copy the code *verbatim* first. Only refactor *after* the move is verified.
2.  **Phase Isolation**: Each phase is a complete unit of work. The app must be buildable and runnable between phases.
3.  **No Logic Changes**: Do not change *how* `resolveClipImages` works or how `generate-library` behaves. Only change *where* they are called from.

## Phase 1: Type System Centralization
**Goal**: Move Types to `src/types/index.ts` without changing any runtime code.

#### [NEW] [src/types/index.ts](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/src/types/index.ts)
- **Action**: Copy interfaces `Clip`, `Series`, `Episode`, `StudioItem` from `src/app/api/clips/route.ts` and `src/lib/library.ts`.
- **Safety Check**: Verify types match exactly.

#### [MODIFY] [src/app/api/clips/route.ts](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/src/app/api/clips/route.ts)
- **Action**: Delete local interfaces. Import from `@/types`.

#### [MODIFY] **Consumers** (`page.tsx`, `ClipTable.tsx`)
- **Action**: Update imports only.

### 🛡️ Phase 1 Regression Tests
- [ ] **Build Verification**: `npm run build` must pass (validates all type references).
- [ ] **Runtime Check**: Load the app. Series List and Clips List must display correctly (validates data shapes didn't break).

---

## Phase 2: State Management (Zustand)
**Goal**: Replace `useAppStore` hook with `useStore` (Zustand) singleton.

#### [NEW] [src/store/useStore.ts](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/src/store/useStore.ts)
- **Protocol**: Copy the *exact* state shape and `refreshData` logic from `src/hooks/useAppStore.ts`.
- **Change**: Wrap it in `create<AppState>()`.

#### [MODIFY] [src/app/page.tsx](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/src/app/page.tsx)
- **Protocol**: Replace `const { x } = useAppStore()` with `const { x } = useStore()`.
- **Critical**: Do NOT refactor the `useEffect` logic yet. Keep the existing side-effects.

### 🛡️ Phase 2 Regression Tests
- [ ] **Reactivity Test**:
    1.  Go to Library.
    2.  Change a Character Image.
    3.  Go to Clips. Verify the thumbnail updated? (Tests Store subscription).
- [ ] **Persistence Test**: Reload page. Does `currentSeriesId` persist?

---

## Phase 3: Component De-Monolith
**Goal**: Split `page.tsx` layouts into `<SeriesView>`, `<ClipsView>`, `<LibraryView>`.

- **Protocol**: Copy the entire JSX block for each view into the new component. Pass necessary data/callbacks via props (or connect to Store).

### 🛡️ Phase 3 Regression Tests
- [ ] **Navigation Test**: Switch between Series/Clips/Library views.
- [ ] **Action Test**: "Add Series" and "New Episode" buttons must work.
- [ ] **Generation Test**:
    1.  Select a clip.
    2.  Click Generate.
    3.  Verify the "Generating..." (or Confirmation) dialog appears.
    4.  **Why**: usage of `setShowClipConfirm` was local state in `page.tsx`. Moving the view requires moving that state or passing it correctly.

