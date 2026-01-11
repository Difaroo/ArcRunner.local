# REF_LOG: Media Table Refactor (Falcon)

## Phase 1: Foundation (Schema)
- [x] Add `Media` model to `schema.prisma`.
- [x] Run `prisma migrate dev` (Used `db push` to avoid drift reset).
- [x] Run `prisma generate`.

## Phase 2: The Service Shim
- [x] Create `src/lib/services/media-service.ts`.
- [x] Implement `createMedia`.
- [x] Implement `addClipResult` (Dual Write).
- [x] Implement `getClipResults`.
- [x] Verified via `tests/test_media_service.ts`.

## Phase 3: Consumer Migration
- [x] Refactor `api/poll/route.ts` (The Input).
- [ ] Refactor `MediaPreviewModal` (The Output).

## Phase 4: Media Gallery UI
- [x] Create `src/components/media/MediaGrid.tsx`.
- [x] Create `src/app/media/page.tsx`.
- [x] Create `src/app/media/client.tsx` (Filters + Client State).
- [x] Add Main Header to `page.tsx`.

## Phase 5: Testing
- [ ] Write `tests/media-service.test.ts`.
- [ ] Write `tests/media-gallery.spec.ts`.
