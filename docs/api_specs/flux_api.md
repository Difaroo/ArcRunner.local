# Flux API Specification

## Request Parameters
The API accepts a JSON payload with the following structure:

### Request Body Structure
```json
{
  "model": "string",
  "callBackUrl": "string (optional)",
  "input": {
    // Input parameters based on form configuration
  }
}
```

### Root Level Parameters
**model** (Required, string)
The model name to use for generation
Example: `"flux-2/pro-image-to-image"` or `"flux-2/flex-image-to-image"`

**callBackUrl** (Optional, string)
Callback URL for task completion notifications.

### Input Object Parameters

**input.input_urls** (Required, array(URL))
Input reference images (1-8 images).
Accepted types: image/jpeg, image/png, image/webp; Max size: 10.0MB
Example: `["https://.../img1.png", "https://.../img2.png"]`

**input.prompt** (Required, string)
Must be between 3 and 5000 characters.
Example: `"The jar in image 1 is filled..."`

**input.aspect_ratio** (Required, string)
Options: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `auto`
Example: `"1:1"`

**input.resolution** (Required, string)
Options: `1K`, `2K`
Example: `"1K"`

## Request Example
```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "flux-2/pro-image-to-image",
    "input": {
      "input_urls": [
        "https://..."
      ],
      "prompt": "Description...",
      "aspect_ratio": "1:1",
      "resolution": "1K"
    }
}'
```
