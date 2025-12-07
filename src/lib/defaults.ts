export const DEFAULT_VIDEO_PROMPT = `
**Instructions for VIDEO [Veo]**

You are helping me break an episode script into production clips. Each clip will be ingested into the ArcRunner production system via JSON.

Break the script below into shot-level CLIPS, following the schema and formatting rules below.

With your understanding of Veo 3, merge rows of dialog and complementary clips that could be rendered in a single prompt, using “Cut to…”

Note there is a character limit for Veo 3 prompts of: 500 characters.

**Episode Special Instructions:**

{{SERIES_STYLE}}

**Output Format:** Please output the final script as a **single JSON object** containing two arrays:

clips
and
library

\`\`\`json
{
  "clips": [ ... ],
  "library": [ ... ]
}
\`\`\`

## **1. CLIPS Array**

**Goal:** Convert the script into dramatic, visually rich shots. Use the "Tone of Voice" established in the example below.

**Example Row (Tone & Detail Reference):**

\`\`\`json
{
  "scene": "2.1",
  "status": "Ready",
  "title": "Heroic Jack Metal-detecting",
  "character": "Candy_Jones_Roswell, Jack_Parsons_Roswell",
  "location": "Roswell_Pasture",
  "style": "Noir_1950s_BMovie",
  "camera": "LowAngle_Heroic",
  "action": "Heroic 1950s framing: Jack in 50's hazmat suit with perspex sphere helmet, 50's metal detector, sweeping the ground with intense concentration, under lightning sky, cows watching.",
  "dialog": "Cut to closeup of Candy's face looking cheeky: \"Why are you vacuuming the desert?\"\\nZoom into close up of Jack's face inside the helmet.\\nJack says: \"Cleaning up weather balloon shit.\"",
  "refImageUrls": "",
  "refVideoUrl": "",
  "seed": "64132",
  "duration": "5",
  "quality": "quality",
  "ratio": "9:16",
  "negatives": "No subtitles. No music. No UFO or disturbance of the ground.",
  "service": "kie_api",
  "episode": "2",
  "series": "1",
  "model": "veo-quality"
}
\`\`\`

**Schema:** Each object in the clips array must use these keys:

\`\`\`json
{
  "scene": "1.1",              // Scene Number (e.g., '1.1', '1.2')
  "status": "Ready",           // Always 'Ready'
  "title": "The Arrival",      // Short descriptive label (max 8 words)
  "character": "Neo, Morpheus",// LIBRARY names (comma separated)
  "location": "Subway_Station",// LIBRARY name
  "style": "Cyberpunk_Noir",   // LIBRARY name
  "camera": "Wide_Shot",       // LIBRARY name
  "action": "Neo steps onto the platform...", // One short sentence of what happens
  "dialog": "NEO: Where are we?", // Exact dialogue. Prefix with speaker name.
  "refImageUrls": "",          // Up to 3 URLs (optional)
  "refVideoUrl": "",           // Optional Video URL
  "seed": "",                  // Optional seed for consistency
  "duration": "4",             // Duration in seconds (typically 3–5)
  "quality": "fast",           // 'fast' (default) or 'quality' for hero shots
  "ratio": "9:16",             // Always '9:16'
  "negatives": "",             // Optional negatives
  "service": "kie_api",        // Always 'kie_api'
  "episode": "1",              // Episode Number
  "series": "1",               // Series ID
  "model": "veo-fast"          // Model ID (e.g. veo-fast, veo-quality)
}
\`\`\`

## **2. LIBRARY Array**

**Goal:** The LIBRARY defines reusable prompt components referenced by **Name** in the Clips array.

**Rule:** **Only create LIBRARY assets for components that appear in more than one clip (≥ 2 uses)** within this episode or across episodes.

- If an element appears **once**, write it directly in the CLIPS row (do **not** add to LIBRARY).
- **Wardrobe variants** should be added as **character entries** when they recur.
- **Add to Negatives to every entry:** *No subtitles. No music.*

**Writing Guidance by Type:**

- **LIB_CHARACTER** (includes wardrobe variants): facial traits, hair, age band, **wardrobe/look**, demeanor.
- **LIB_LOCATION:** era, architecture, set dressing, lighting mood.
- **LIB_STYLE:** lensing/palette/texture (e.g., noir grit, film grain).
- **LIB_CAMERA:** framing + movement + lens + DoF in one sentence.

**Example Library Item:**

\`\`\`json
{
  "type": "LIB_CHARACTER",
  "name": "Candy_Jones",
  "description": "CANDY: A hauntingly beautiful woman in her mid-20s, c. 1950...",
  "refImageUrl": "https://example.com/image.jpg",
  "negatives": "no glasses, no modern clothing logos...",
  "notes": "Primary lead character",
  "episode": "1",
  "series": "1"
}
\`\`\`

**Existing Library (Reference)** Reuse these names where appropriate:
{{LIBRARY_KEYS}}

**Final Rule:** Ensure the output is valid, parseable JSON. Do not include markdown formatting or extra text.

# **Script**

[Insert script HERE >>> ]
`;

export const DEFAULT_IMAGE_PROMPT = `
**Instructions for IMAGES [Flux]**

You are helping me create a storyboard / shot list for an episode. Each shot will be generated as a High-Fidelity Still Image using Flux 1.1 Pro.

Break the script below into shot-level CLIPS, following the schema and formatting rules below.

Focus on **Visual Description**, **Lighting**, and **Composition**. Ignore sound or dialog unless it implies a visual emotion.

**Episode Special Instructions:**

{{SERIES_STYLE}}

**Output Format:** Please output the final script as a **single JSON object** containing two arrays:

clips
and
library

\`\`\`json
{
  "clips": [ ... ],
  "library": [ ... ]
}
\`\`\`

## **1. CLIPS Array**

**Goal:** Create distinct, high-quality still image prompts.

**Example Row (Tone & Detail Reference):**

\`\`\`json
{
  "scene": "2.1",
  "status": "Ready",
  "title": "Heroic Jack Portrait",
  "character": "Candy_Jones_Roswell, Jack_Parsons_Roswell",
  "location": "Roswell_Pasture",
  "style": "Photo_Real_1950s",
  "camera": "Portrait_Length_85mm",
  "action": "A striking portrait of Jack in a 50's hazmat suit with perspex sphere helmet. The helmet reflects the lightning sky above. He looks determined. Cows are visible in the soft-focus background.",
  "dialog": "",
  "refImageUrls": "",
  "refVideoUrl": "",
  "seed": "12345",
  "duration": "0",
  "quality": "quality",
  "ratio": "3:2",
  "negatives": "blur, distortion, low quality, illustration, 3d render",
  "service": "kie_api",
  "episode": "2",
  "series": "1",
  "model": "flux-pro"
}
\`\`\`

**Schema:** Each object in the clips array must use these keys:

\`\`\`json
{
  "scene": "1.1",              // Scene Number
  "status": "Ready",           // Always 'Ready'
  "title": "The Arrival",      // Short descriptive label
  "character": "Neo, Morpheus",// LIBRARY names
  "location": "Subway_Station",// LIBRARY name
  "style": "Cyberpunk_Noir",   // LIBRARY name
  "camera": "Wide_Shot",       // LIBRARY name
  "action": "Neo steps onto the platform...", // Detailed visual description
  "dialog": "",                // Leave empty for Stills
  "refImageUrls": "",          // Up to 3 URLs (optional)
  "refVideoUrl": "",           // Leave empty
  "seed": "",                  // Optional
  "duration": "0",             // 0 for Stills
  "quality": "quality",        // 'quality' preferred for main shots
  "ratio": "16:9",             // e.g. '16:9', '3:2', '4:3'
  "negatives": "text, watermark, blur", // Negatives for image gen
  "service": "kie_api",        // Always 'kie_api'
  "episode": "1",              // Episode Number
  "series": "1",               // Series ID
  "model": "flux-pro"          // Model ID (e.g. flux-pro, flux-flex)
}
\`\`\`

## **2. LIBRARY Array**

**Goal:** The LIBRARY defines reusable prompt components referenced by **Name**.

**Rule:** **Only create LIBRARY assets for components that appear in more than one clip.**

**Writing Guidance:**
- **LIB_CHARACTER**: Facial traits, skin texture, wardrobe details.
- **LIB_LOCATION**: Lighting, atmosphere, set details.
- **LIB_STYLE**: Photography style (e.g., 'Cinestill 800T', 'Kodak Portra', 'Noir B&W').
- **LIB_CAMERA**: Lens focal length (e.g. 35mm, 85mm), aperture (f/1.8), camera angle.

**Existing Library (Reference):**
{{LIBRARY_KEYS}}

**Final Rule:** Ensure the output is valid, parseable JSON.

# **Script**

[Insert script HERE >>> ]
`;

// Export the OLD name for backward compatibility if needed, but we will update files.
export const DEFAULT_EPISODE_PROMPT = DEFAULT_VIDEO_PROMPT;
