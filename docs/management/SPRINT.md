# Sprint v0.15.0: The Big Architecture Refactor

## Goal
Execute the "Grok/Antigravity" refactor plan. Deconstruct the `page.tsx` monolith into modular Views, centralize the Type system, and adopt proper State Management (Zustand) to improve maintainability and performance.

## Specs
- **Reference**: `docs/management/specs/Architecture_Refactor_Report.md`

## Active Tasks

### 🏗️ Architecture & Core
- [ ] **Centralize Types**: 
    - [ ] Create `src/types/index.ts`.
    - [ ] Move `Clip`, `Series`, `Episode`, `StudioItem` interfaces.
    - [ ] Remove circular dependencies from API routes (`api/clips/route.ts`, etc.).
- [ ] **State Management**:
    - [ ] Install `zustand`.
    - [ ] Migrate `useAppStore` hook to a singleton Zustand store.
    - [ ] Remove excessive prop drilling (connect components directly to store).

### 🧩 Component Refactor (De-Monolith)
- [ ] **Service Layer**:
    - [ ] Create `src/services/api.ts` to centralize `fetch` calls.
- [ ] **View Extraction**:
    - [ ] Extract `SeriesView` to `src/components/views/SeriesView.tsx`.
    - [ ] Extract `ClipsView` to `src/components/views/ClipsView.tsx`.
    - [ ] Extract `StudioView` to `src/components/views/StudioView.tsx`.
- [ ] **Main Page**:
    - [ ] Simplify `page.tsx` to a router/view-switcher.

### 🧹 Cleanup
- [ ] **Fix**: `npm run build` (Validate strict strictness).
- [ ] **Performance**: Verify re-render reduction (editing a clip should not re-render Series list).

## Verification
- [ ] **Regression Testing**:
    - [ ] Verify Series creation/editing still works.
    - [ ] Verify Clip generation flows.
    - [ ] Verify Studio item management.
