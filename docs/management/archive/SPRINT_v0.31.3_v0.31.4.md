# Sprint Archive v0.31.3 - Peregrine (Global Catalogue Polish & Media Fixes)

## Release v0.31.3 (Global Catalogue & Recovery)
- [x] Global Catalogue: Settings tabs for Cameras and Movement management
- [x] Data Recovery: Restored user data after schema drift incident
- [x] Polish: Removed redundant globe icon from Vibe items

## Release v0.31.4 (Media Persistence & Display)
- [x] Fix: Thumbnail path resolution — `getFilePath` fallback to `storage/media/` when `public/media/` fails
- [x] Fix: `episodeId` (UUID) now returned from both GET and PUT clip API responses
- [x] Fix: Prisma persistence route uses parsed `clipIdInt` (integer) instead of raw string `clipId`
- [x] Feature: Universal Viewer persistence integration — Clapperboard icon for video persistence, green state feedback
- [x] Feature: ClipRow video download now triggers persistence (symlinking) instead of raw download
- [x] Feature: BatchEditModal media items now use `MediaDisplay` component with persistence overlay
- [x] Hardening: Proxy-download route adds Strategy 1 (Internal Storage direct disk access) to avoid loopback fetch 404s
- [x] Refactor: Universal Viewer icon cleanup — consistent `ImagePlus` for Add-as-Ref, custom video controls
- [x] Refactor: Download utilities simplified and consolidated

## Status
- **Date**: 2026-02-16
- **Outcome**: Success. Media display fully functional (0 broken icons). Persistence infrastructure wired end-to-end.
