
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// --- CONFIGURATION ---

// FFMPEG Path (from our previous discovery)
const FFMPEG_PATH = "/Users/davidfennell/.gemini/antigravity/scratch/ffmpeg-tools/ffmpeg";

// Base Folder
const BASE_DIR = "/Users/davidfennell/Documents/~ JOBS current/Rise of the Witches/PILOT/CLIPS final";

// Subfolders
const DROP_DIR = path.join(BASE_DIR, "_DROP_BROKEN_HERE");
const OUTPUT_DIR = path.join(BASE_DIR, "_FIXED_FOR_PREMIERE");
const PROCESSED_DIR = path.join(BASE_DIR, "_ORIGINALS_PROCESSED");

// Supported Extensions
const EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm'];

// --- SETUP ---

function ensureDirs() {
    [DROP_DIR, OUTPUT_DIR, PROCESSED_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.log(`Creating directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// --- CORE ---

async function processFile(filename: string) {
    const inputPath = path.join(DROP_DIR, filename);

    // Ignore if file doesn't exist (deleted?) or is hidden
    if (!fs.existsSync(inputPath) || filename.startsWith('.')) return;

    // Check extension
    const ext = path.extname(filename).toLowerCase();
    if (!EXTENSIONS.includes(ext)) return;

    console.log(`\n🎥 Detected new file: ${filename}`);
    console.log(`⏳ Waiting for copy to complete...`);

    // Wait 2 seconds to ensure file copy is finished
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Define Output Paths
    const basename = path.basename(filename, ext);
    const outputFilename = `${basename}_Premiere_VideoOnly.mov`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    const processedPath = path.join(PROCESSED_DIR, filename);

    console.log(`⚙️  Converting to ProRes 422 HQ (Video Only)...`);

    try {
        // FFMPEG Command
        // -vf scale=1920:1080:flags=lanczos : Scale to 1080p high quality
        // -c:v prores_ks : ProRes Codec
        // -profile:v 3 : ProRes 422 HQ
        // -an : Remove Audio (Fixes black timeline bug)
        const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -vf "scale=1920:1080:flags=lanczos" -c:v prores_ks -profile:v 3 -an "${outputPath}"`;

        await execAsync(cmd);

        console.log(`✅ Success! Created: ${outputFilename}`);
        console.log(`📦 Moving original to processed folder...`);

        // Move original to processed folder
        fs.renameSync(inputPath, processedPath);

        console.log(`🎉 Done. Ready for next file.\n`);

    } catch (error: any) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        console.error(`Attempting to move broken file to processed to avoid loop...`);
        try {
            fs.renameSync(inputPath, processedPath);
        } catch (e) { }
    }
}

// --- WATCHER ---

async function start() {
    console.clear();
    console.log("================================================");
    console.log("   🎥  ARCRUNNER AUTO-FIX WATCHER STARTED      ");
    console.log("================================================");
    console.log(`\n📂 Watching: ${DROP_DIR}`);
    console.log(`✨ Output to: ${OUTPUT_DIR}`);
    console.log(`📦 Originals moved to: ${PROCESSED_DIR}`);
    console.log(`\n🚀 DROP FILES IN THE WATCH FOLDER TO FIX THEM!`);
    console.log(`(Press Ctrl+C to stop)`);

    // Ensure directories exist
    ensureDirs();

    // Process any existing files in drop folder on startup
    const existing = fs.readdirSync(DROP_DIR);
    if (existing.length > 0) {
        console.log(`\nFound ${existing.length} existing files. Processing...`);
        for (const file of existing) {
            await processFile(file);
        }
    }

    // --- QUEUE SYSTEM ---
    const queue: string[] = [];
    let isProcessing = false;

    async function processQueue() {
        if (isProcessing || queue.length === 0) return;

        isProcessing = true;

        while (queue.length > 0) {
            const filename = queue.shift();
            if (filename) await processFile(filename);
            // Small buffer between files
            await new Promise(r => setTimeout(r, 1000));
        }

        isProcessing = false;
    }

    // Start Watching
    console.log("👀 Waiting for files...");
    fs.watch(DROP_DIR, async (eventType, filename) => {
        if (!filename) return;
        // Ignore temporary/hidden files
        if (filename.startsWith('.')) return;

        // Add to queue if not already there (simple dedup)
        if (!queue.includes(filename)) {
            // Check if file actually exists (it might be a 'rename' event for moving OUT)
            if (fs.existsSync(path.join(DROP_DIR, filename))) {
                console.log(`➕ Queued: ${filename}`);
                queue.push(filename);
                processQueue();
            }
        }
    });
}

start();
