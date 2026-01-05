# ArcRunner Golden Master Specifications

## 🍌 Nano Banana Pro API
**Endpoints**
- **Create**: `POST /api/v1/jobs/createTask`
- **Query**: `GET /api/v1/jobs/recordInfo?taskId={id}`

**Payload Structure**
```json
{
  "model": "nano-banana-pro",
  "callBackUrl": "string (optional)",
  "input": {
    "prompt": "string (Required, max 20k chars)",
    "image_input": ["url1", "url2"], // Up to 8
    "aspect_ratio": "1:1", // Options: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, auto
    "resolution": "1K", // Options: 1K, 2K, 4K
    "output_format": "png" // Options: png, jpg
  }
}
```

**Status Response (Success)**
```json
{
  "code": 200,
  "data": {
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://imageUrl...\"]}"
  }
}
```
**Status Response (Fail)**
```json
{
  "code": 501,
  "data": {
    "state": "fail",
    "failMsg": "Internal server error"
  }
}
```

## 🌊 Flux API (Reference)
*Ref: Uses same `createTask` endpoint but different input schema (e.g. `t5_prompt` vs `prompt`).*

## 🎥 Veo API (Reference)
*Ref: `POST /veo/generate`, distinct schema.*

### Veo S2E (Start-to-End)
New in **v0.16.0 (Griffin)**.
- **Frontend Model**: `veo-s2e` (Maps to backend `veo3_fast`)
- **Generation Type**: `IMAGE_TO_VIDEO`
- **Logic**:
    - **2 Images** (Strict): Uses Image 1 as Start Frame, Image 2 as End Frame.
    - **1 Image**: Fallback to `REFERENCE_2_VIDEO` (Start Frame).
    - **0 Images**: Fallback to `TEXT_2_VIDEO`.
