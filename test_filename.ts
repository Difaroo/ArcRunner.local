
import { getClipFilename, getNextStatus } from './src/lib/download-utils';
import { Clip } from './src/types';

// Mock Clip
const mockClip = (status: string, title = "Test Clip", scene = "1.1") => ({
    title,
    scene,
    status,
    resultUrl: "http://example.com/file.mp4"
} as Clip);

console.log("--- Testing Filename Generation ---");

// Case 1: Base Status
console.log("Status: 'Done' ->", getClipFilename(mockClip('Done')));
console.log("Status: 'Saved' ->", getClipFilename(mockClip('Saved')));

// Case 2: Versioned Status (Square Brackets)
console.log("Status: 'Saved [2]' ->", getClipFilename(mockClip('Saved [2]')));
console.log("Status: 'Saved [3]' ->", getClipFilename(mockClip('Saved [3]')));

// Case 3: Hypothetical Parens (Legacy?)
console.log("Status: 'Saved (2)' ->", getClipFilename(mockClip('Saved (2)')));

console.log("\n--- Testing Next Status Generation ---");
console.log("Current: 'Saved' ->", getNextStatus('Saved'));
console.log("Current: 'Saved [2]' ->", getNextStatus('Saved [2]'));
