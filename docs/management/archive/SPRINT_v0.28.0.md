# SPRINT v0.28.0 - Legacy CSV Removal (Completed)

## Architecture Refactor
- [x] **Backend**: Stop writing to `refImageUrls` and `resultUrl` CSV columns.
- [x] **Frontend**: Switch `ClipRow` to read from `mediaReferences` relations (via explicit Mappers & AddRef API).
- [x] **Unlink**: Ensure unlinking only targets `Media` table.
- [x] **Sorting**: Implement sorting for Media records (Done via MediaService / DB Sync).
- [x] **Verification**: Automated Browser Test (Ghost Test) & Write Persistence Verified. "Ghost URL" is strictly invisible.
