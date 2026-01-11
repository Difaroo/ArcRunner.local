# Kie.ai Payload Specification (Golden Master)

This document defines the **strictly required** payload structures for Kie.ai generation, based on verified working CURL requests and Official Documentation (Dec 2025).

**Ref Docs:**
- Veo3: `https://docs.kie.ai/veo3-api/generate-veo-3-video`
- Flux: `https://docs.kie.ai/flux-kontext-api/generate-or-edit-image`
- Kling: Verified Implementation

---

## 1. Flux (Image Generation & Editing)

**Endpoint:** POST `/v1/jobs/createTask` (Standard) or `/flux-kontext/generate` (New - Check BaseUrl)
*Note: Current implementation uses generic task creation. Ensure endpoint matches.*

### A. Text-to-Image (New)
```json
{
  "model": "flux-kontext-pro",
  "input": {
    "prompt": "string (required, English only)",
    "aspectRatio": "16:9",
    "enableTranslation": true
  }
}
```

### B. Image Editing (Ref + Prompt)
```json
{
  "model": "flux-kontext-pro",
  "input": {
    "prompt": "string (required)",
    "inputImage": "http://public-url.jpg",
    "aspectRatio": "16:9",
    "enableTranslation": true
  }
}
```
**Changes from Legacy:**
- Model ID: `flux-kontext-pro` (was `flux-2/...`).
- Input Field: `inputImage` (Singular) for editing. Unlike Veo's `imageUrls` (Array).

---

## 2. Veo (Video Generation)

**Endpoint:** POST `/veo/generate`
**Internal ID:** `veo3_fast`

### A. Text-to-Video
```json
{
  "model": "veo3_fast",
  "prompt": "string",
  "generationType": "TEXT_2_VIDEO",
  "aspectRatio": "16:9",
  "durationType": "5",
  "enableTranslation": true
}
```

### B. Reference-to-Video (Image-to-Video)
**Constraint:** Only supported on `veo3_fast` model.
```json
{
  "model": "veo3_fast",
  "prompt": "string",
  "generationType": "REFERENCE_2_VIDEO",
  "imageUrls": [
      "https://public-url-1.jpg",
      "https://public-url-2.jpg"
  ],
  "aspectRatio": "16:9",
  "durationType": "5",
  "enableTranslation": true
}
```

---

## 3. Kling (Video Generation)

**Endpoint:** POST `/jobs/createTask`
**Internal ID:** `kling-2.6/image-to-video`

### Parameters
```json
{
  "model": "kling-2.6/image-to-video",
  "input": {
    "prompt": "string (required)",
    "image_urls": ["https://public-url-1.jpg"], // STRICTLY 1 Image
    "sound": boolean, // true/false
    "duration": "5"   // "5" or "10"
  }
}
```
**Notes:**
- `image_urls` must be an array of string(s).
- `duration` must be a string "5" or "10".

---

## 4. Nano (Video Generation)

**Endpoint:** POST `/jobs/createTask`
**Internal ID:** `nano-banana-pro`

### Parameters
```json
{
  "model": "nano-banana-pro", // Verified UI ID
  "input": {
    "prompt": "string",
    "image_input": ["https://public-url-1.jpg"], // Optional
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "output_format": "png"
  }
}
```

---

## 5. Refactor Guidelines - DOs and DONTs
1.  **Veo Images**: Use `imageUrls` (Array).
2.  **Flux Images**: Use `inputImage` (Singular).
3.  **Veo Model**: Use `veo3_fast` for Image-to-Video (Quality model `veo3` does NOT support Ref-2-Video yet).
4.  **Flux Model**: Verify if `flux-kontext-pro` is active in your account.
5.  **Kling**: Enforce single image URL.
