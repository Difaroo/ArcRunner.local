# Full Stack Review & Recommendations

## Overview
Focused review of the ArcRunner frontend implementation, evaluating structure, maintainability, and best practices.

## 1. Strengths
*   **Modern Technology Stack**: Correctly utilizing Next.js App Router, Tailwind CSS, and Shadcn UI components.
*   **Responsive Foundations**: The grid layouts (especially in Storyboard and Library) are mobile-responsive using standard Tailwind breakpoints.
*   **Component Modularity (Partial)**: Newer features like `StoryboardView` and `ClipTable` demonstrate good separation of concerns, encapsulating their own logic and display.
*   **Drag-and-Drop Implementation**: The use of `@dnd-kit` in `ClipTable` is a robust modern choice for interaction.

## 2. Methodology & Findings

### Componentisation
*   **Analysis**: While leaf components (`ClipRow`, `MediaDisplay`, `StoryboardView`) are becoming well-structured, the root `src/app/page.tsx` is a **monolith** (>1600 lines). It acts as a "God Component," handling routing state, data fetching, dialog visibility, and view switching all in one place.
*   **Impact**: High. Makes the application brittle to change. Editing the "Series" logic risks breaking the "Clips" logic because they share the same massive scope.
*   **Prop Drilling**: Components like `ClipTable` receive 15+ props, indicating that data and handlers are being passed down too many levels instead of being consumed from a context or store.

### File & Folder Structure
*   **Analysis**: The `src/app` and `src/components` structure is generally standard. However, placing shared Type definitions (like `Clip`, `Series`) inside `src/app/api/clips/route.ts` is an anti-pattern.
*   **Impact**: Medium. It creates circular dependencies and makes it confusing to find where your data models are defined. Client components shouldn't be importing from API route files.

### Styling Practices
*   **Analysis**: Tailwind usage is generally good. There is extensive use of `@apply` in `globals.css` for custom scrollbars and some utilities. While valid, overuse of `@apply` fights against the "utility-first" nature of Tailwind.
*   **Consistency**: Most styling is inline (good for Tailwind), but some specialized printing styles are correctly isolated in media queries.

### State Management & Data Flow
*   **Analysis**: `useAppStore` is a misnomer. It is currently a custom React Hook returning local state, not a singleton or global store. This means every time `page.tsx` uses it, it re-initializes. Since `page.tsx` is the only consumer, it works effectively as a "Container" state, but it causes the *entire* page tree to re-render whenever *any* single piece of data changes (e.g., just one clip updating causes the Series list to reconcile).
*   **Data Fetching**: Data fetching is client-side (`useEffect` + `fetch`). This negates some benefits of Next.js Server Components, though it might be necessary for this highly interactive, local-first dashboard dashboard.

### TypeScript & Type Safety
*   **Analysis**: Types are used (~90% coverage), but `any` was observed in error handling blocks. The primary issue is the location of the type definitions (see File Structure).

## 3. Recommendations

### High Priority (Architectural Health)
1.  **Refactor `page.tsx`**: Break the monolithic "Home" component into distinct "View" components (`<SeriesView />`, `<ClipsView />`, `<LibraryView />`). `page.tsx` should effectively be a router/switcher that passes state to these views.
2.  **Centralize Types**: Move `Clip`, `Series`, `Episode`, `LibraryItem` interfaces to a dedicated `src/types/index.ts` or `src/lib/types.ts` file. Remove exports from API routes.
3.  **Adopt a True State Manager**: Migrate `useAppStore` to **Zustand**. This will allow components to subscribe only to the data they need (preventing unnecessary re-renders) and avoid prop-drilling 15 attributes into `ClipTable`.

### Medium Priority (Maintainability)
1.  **Service Layer**: Extract raw `fetch` calls scattered across components into a `src/services/api.ts` layer. This centralizes API endpoints and error handling.
2.  **Strict Component Interfaces**: Reduce the number of props passed to main components by passing composite objects or using the store within the component.

### Low Priority (Polish)
1.  **Optimize `next/image`**: Replace standard `<img>` tags with `next/image` for performance optimization, especially for thumbnails.
2.  **Reduce `@apply`**: Move some global styles to Reusable Components (e.g., a standard `<Card>` component instead of repeating standard card classes or using `@apply`).

## 4. Immediate Quick Wins
*   [ ] **Move Types**: Extract `Clip` and `Series` interfaces to `src/types/index.ts`.
*   [ ] **Extract `SeriesView`**: Move the Series-specific rendering logic from `page.tsx` into `src/components/series/SeriesView.tsx`, similar to how `StoryboardView` was done.

