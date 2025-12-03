export const DEFAULT_EPISODE_PROMPT = `
**Instructions**

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
  "title": "Heroic Jack Metal-detecting",
  "character": "Candy_Jones_Roswell, Jack_Parsons_Roswell",
  "location": "Roswell_Pasture",
  "style": "Noir_1950s_BMovie",
  "camera": "LowAngle_Heroic",
  "action": "Heroic 1950s framing: Jack in 50's hazmat suit with perspex sphere helmet, 50's metal detector, sweeping the ground with intense concentration, under lightning sky, cows watching.",
  "dialog": "Cut to closeup of Candy's face looking cheeky: \"Why are you vacuuming the desert?\"\\nZoom into close up of Jack's face inside the helmet.\\nJack says: \"Cleaning up weather balloon shit.\"",
  "refImageUrls": "",
  "seed": "64132",
  "duration": "5",
  "quality": "quality",
  "ratio": "9:16",
  "negatives": "No subtitles. No music. No UFO or disturbance of the ground.",
  "service": "kie_api",
  "episode": "2",
  "series": "1"
}
\`\`\`

**Schema:** Each object in the clips array must use these keys:

\`\`\`json
{
  "scene": "1.1",              // Scene Number (e.g., '1.1', '1.2')
  "title": "The Arrival",      // Short descriptive label (max 8 words)
  "character": "Neo, Morpheus",// LIBRARY names (comma separated)
  "location": "Subway_Station",// LIBRARY name
  "style": "Cyberpunk_Noir",   // LIBRARY name
  "camera": "Wide_Shot",       // LIBRARY name
  "action": "Neo steps onto the platform...", // One short sentence of what happens
  "dialog": "NEO: Where are we?", // Exact dialogue. Prefix with speaker name.
  "refImageUrls": "",          // Up to 3 URLs (optional)
  "seed": "",                  // Optional seed for consistency
  "duration": "4",             // Duration in seconds (typically 3–5)
  "quality": "fast",           // 'fast' (default) or 'quality' for hero shots
  "ratio": "9:16",             // Always '9:16'
  "negatives": "",             // Optional negatives
  "service": "kie_api",        // Always 'kie_api'
  "episode": "1",              // Episode Number
  "series": "1"                // Series ID
}
\`\`\`

## **2. LIBRARY Array**

**Goal:** The LIBRARY defines reusable prompt components referenced by **Name** in the Clips array.

**Rule:** **Only create LIBRARY assets for components that appear in more than one clip (≥ 2 uses)** within this episode or across episodes.

- If an element appears **once**, write it directly in the CLIPS row (do **not** add to LIBRARY).
- **Wardrobe variants** should be added as **character entries** when they recur (e.g., Candy_Rocketman for Candy’s E5 look) so you can reuse them across multiple shots.
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
  "description": "CANDY: A hauntingly beautiful woman in her mid-20s, c. 1950.\\nFace: Green eyes, shoulder length wavy 50's styled auburn hair, high cheekbones, straight long nose, strong Cupid’s bow; lips medium‑full.\\nYoung, gorgeous, smart, with non-classical aristocratic features. Poised, camera‑aware, cool.\\nVoice: American educated 50's Pennsylvania accent and theatrical delivery.",
  "refImageUrl": "https://drive.google.com/file/d/1uD4FZ_9C5QzqYUN34ImKwfabPTRmlbWp/view?usp=sharing",
  "negatives": "no glasses, no modern clothing logos, no tattoos, no deformed hands",
  "notes": "Primary lead character",
  "episode": "1",
  "series": "1"
}
\`\`\`

**Existing Library (Reference)** The following assets already exist. **Reuse them** where appropriate. Do not create duplicates.

{{LIBRARY_KEYS}}

**Schema:** Each object in the library array must use these keys:

\`\`\`json
{
  "type": "LIB_CHARACTER",     // LIB_CHARACTER, LIB_LOCATION, LIB_STYLE, LIB_CAMERA, LIB_ACTION
  "name": "Candy_Rocketman",   // Canonical handle (stable, unique), Title_Case_With_Underscores
  "description": "Mid-20s...", // Self-contained text injected into prompts. Precise, period-correct.
  "refImageUrl": "",           // One URL (optional)
  "negatives": "no modern logos", // Short 'avoid' list
  "notes": "",                 // Optional notes
  "episode": "1",              // Episode Number
  "series": "1"                // Series ID
}
\`\`\`

**Final Rule:** Ensure the output is valid, parseable JSON. Do not include markdown formatting or extra text.

# **Script**

[Insert script HERE >>> ]
`;
