# Architectural Review Report v2.0
**Date:** 2026-01-04
**Scope:** Frontend Architecture & Best Practices

## Executive Summary
The `arcrunner-local` application has a solid functional foundation but suffers from a centralized monolithic architecture in `page.tsx` (>1900 lines) and an inefficient state management strategy. This makes the application brittle to change and perform poorly (excessive re-renders). A phased refactor is strongly recommended to decouple views, centralize types, and adopt a true state manager.

---

## 1. Componentisation & Composition
### Findings
- **The "God Component"**: `src/app/page.tsx` is 1990 lines long. It handles everything:
    - **Routing**: Manages `currentView` state ('series', 'clips', 'library').
    - **Data Fetching**: Contains the primary `refreshData` and API calls.
    - **UI Orchestration**: Directly renders Dialogs, Tables, and Headers.
- **Prop Drilling**: Components like `<ClipTable />` receive **16 props**, many of which are pass-through callbacks (`onSelect`, `onEdit`, `onSave`).
- **Good News**: Leaf components like `ClipRow`, `StoryboardView`, and `LibraryTable` are relatively well-isolated, making them easy to move once the parent is broken up.

### Recommendations
- **Split `page.tsx`**: Deconstruct into three high-level View Components:
    - `<SeriesView />`: Managing the Series list and selection.
    - `<EpisodeView />` (or `ClipsView`): Managing the active Episode's content.
    - `<LibraryView />`: Managing Studio Assets.
- **Composition**: Use a Layout component for the common Header/Sidebar, and let the Views handle their specific content.

## 2. File & Folder Structure
### Findings
- **Circular Dependencies**: Key domain types (`Clip`, `Series`) are defined in **API Route files** (`src/app/api/clips/route.ts`) and imported by Client Components. This is an architectural anti-pattern.
- **Co-location**: Components are generally well-grouped in `src/components/{feature}`.

### Recommendations
- **Centralize Types**: Create `src/types/index.ts` (or `src/lib/types.ts`) to house shared interfaces (`Clip`, `Series`, `LibraryItem`).
- **Service Layer**: Extract raw `fetch` calls from components into `src/services/api.ts` to modularize data access.

## 3. Styling Practices
### Findings
- **Overuse of `@apply`**: `globals.css` contains extensive `@apply` rules for basic text and layout. This fights against Tailwind's utility-first nature and increases CSS bundle size.
- **Inconsistent Images**: Build logs flag multiple uses of standard `<img>` tags instead of `next/image`, causing performance warnings.
- **Print Styles**: Print styling is well-handled via `@media print` blocks, but is scattered.

### Recommendations
- **Adopt `next/image`**: Systematically replace `<img>` with optimized `<Image />` components.
- **Reduce `@apply`**: Move repeated styles into Reusable UI Components (e.g., `<Card />`, `<Badge />`) rather than CSS classes.

## 4. State Management & Data Flow
### Findings
- **Pseudo-Store**: `useAppStore.ts` is named like a store but is actually a **Custom React Hook**.
    - **Impact**: Every time `page.tsx` renders, the hook re-runs. It holds local state, not global state.
    - **Prop Drilling**: Because state is local to `page.tsx`, it must be passed down manually to every child component.
- **Performance**: Editing a single Clip currently triggers a re-render of the entire Screen because the state lives at the root.

### Recommendations
- **Adopt Zustand**: Migrate `useAppStore` to a true singleton store using **Zustand**.
    - **Benefit**: Components can subscribe *only* to the data they need (e.g., `ClipTable` subscribes to `clips`, `SeriesList` subscribes to `seriesList`).
    - **Benefit**: Eliminates 16+ props from `ClipTable`.

## 5. TypeScript & Type Safety
### Findings
- **API Response Typing**: usage of `any` in error handling blocks (`catch (e: any)`).
- **Loose Props**: Some components have loosely typed `uniqueValues` arrays.

### Recommendations
- **Strict Mode**: Ensure `strict: true` is enabled in `tsconfig.json`.
- **Error Typing**: Use unknown and type guards for error handling instead of `any`.

## 6. Performance & Optimisation
### Findings
- **Client-Side Heavy**: The entire app runs in `use client` mode. While necessary for a local dashboard, we should push "leaf" components (like simple displays) to be server components if possible, though low priority here.
- **Image Optimization**: Missing `next/image` is the biggest specialized finding.

## Summary Checklist
1.  [ ] **Type Extraction**: Move Types to `src/types`.
2.  [ ] **State Migration**: Implement Zustand Store.
3.  [ ] **Service Extraction**: Move API calls to `src/services`.
4.  [ ] **De-Monolith**: Split `page.tsx` into Views.
5.  [ ] **Image Fix**: Implement `next/image`.
