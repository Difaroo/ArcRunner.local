interface Clip {
    character: string;
    action: string;
    location: string;
    style: string;
    camera: string;
    dialog: string;
}

interface LibraryItem {
    type: string;
    name: string;
    description: string;
}

export function buildPrompt(clip: Clip, library: LibraryItem[]): string {
    // Helper to find description by name
    const findDesc = (name: string, type: string) => {
        if (!name) return '';
        const item = library.find(
            (i) => i.name && i.name.toLowerCase() === name.toLowerCase() && i.type === type
        );
        return item ? item.description : name; // Fallback to name if not found
    };

    // 1. Resolve Descriptions
    const charNames = clip.character ? clip.character.split(',').map(s => s.trim()) : [];
    const charDescs = charNames.map(name => findDesc(name, 'LIB_CHARACTER'));
    const charDesc = charDescs.join('\n\n');

    const locDesc = findDesc(clip.location, 'LIB_LOCATION');
    const styleDesc = findDesc(clip.style, 'LIB_STYLE');
    const camDesc = findDesc(clip.camera, 'LIB_CAMERA');

    // 2. Construct the Prompt
    // User Requested Order: Character, Location, Camera, Action, Dialog.

    const parts: string[] = [];

    // Character
    if (charDesc) parts.push(charDesc);

    // Location
    if (locDesc) parts.push(`at ${locDesc}.`);

    // Camera
    if (camDesc) parts.push(`${camDesc} shot.`);

    // Action
    if (clip.action) parts.push(`Action: ${clip.action}`);

    // Dialog (if present)
    if (clip.dialog) parts.push(`Dialog: "${clip.dialog}"`);

    // Style (Usually good to keep as a wrapper or at start/end, but user didn't explicitly place it. 
    // I'll append it at the end as "Style: ..." to ensure it applies to the whole scene).
    if (styleDesc) parts.push(`Style: ${styleDesc}.`);

    return parts.join('\n\n');
}
