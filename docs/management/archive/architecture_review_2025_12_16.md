
# Architecture Review: Generate Manager & Kie Payload

**Date:** 2025-12-16
**Status:** AUDITED & FIXED

## Executive Summary
The `GenerateManager` was audited following reports of Veo payload regressions. The audit revealed a disconnect between the "Golden Master" specification (simple, specific) and the `GenerateManager` implementation (legacy, complex, potentially deprecated fields).

## Findings

### 1. Veo Payload Drift
- **Issue:** The manager was constructing a `VeoPayload` with `imageUrls` (array) and `generationType` fields.
- **Spec:** The Kie.ai Golden Master (`kie_payload_spec.md`) requires `imageUrl` (singular) and `model: 'veo-2'`.
- **Impact:** Sending `imageUrls` likely caused the API to reject the request or fail silently/unexpectedly, as it contradicts the newer (or stricter) `veo-2` expectation.

### 2. Hardcoded Model Override
- **Issue:** The code contained a legacy block: `if (imageUrls.length > 0) targetModel = 'veo3_fast'`.
- **Impact:** This forced a potentially deprecated model (`veo3_fast`) whenever an image was used, overriding the user's intent to use `veo-2`.

## Corrective Actions (Applied)

1.  **Strict Typing**:
    -   Updated `src/lib/kie-types.ts` to define `VeoPayload` *strictly* according to the Golden Master.
    -   Removed permissive array types (`imageUrls?: string[]`) to prevent future usage.

2.  **Refactor**:
    -   Removed the `veo3_fast` override logic in `src/lib/generate-manager.ts`.
    -   Refactored payload construction to use `imageUrl` (singular) and map the first reference image only.

3.  **Verification**:
    -   Ran `scripts/verify-payload.ts` (Dry Run).
    -   Confirmed output JSON matches Golden Master exactly:
        ```json
        {
          "model": "veo-2",
          "prompt": "...",
          "imageUrl": "https://...",
          "aspectRatio": "16:9",
          "durationType": "5"
        }
        ```

## Recommendations
- **Maintain Strict Types**: Do not relax `FluxPayload` or `VeoPayload` types to `any` or permissive interfaces.
- **Audit Imports**: Ensure no other files bypass `GenerateManager` to call Kie API directly (Checked `api/generate-library` and confirmed clean).
- **Restart Required**: App server must be restarted to pick up type changes (Already performed).
