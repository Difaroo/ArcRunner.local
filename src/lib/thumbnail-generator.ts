
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Set the ffmpeg path to the static binary
let ffmpegPath = ffmpegStatic;

if (ffmpegPath && !fs.existsSync(ffmpegPath)) {
    console.warn(`FFmpeg resolved path does not exist: ${ffmpegPath}`);
    // Fallback for Next.js dev environment
    const fallbackPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
    if (fs.existsSync(fallbackPath)) {
        console.log(`Using fallback path: ${fallbackPath}`);
        ffmpegPath = fallbackPath;
    } else {
        console.error(`Fallback path also missing: ${fallbackPath}`);
    }
}

if (ffmpegPath && fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
} else {
    console.error("CRITICAL ERROR: ffmpeg binary not found!");
}

const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails');

// Ensure directory exists
if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

export async function generateThumbnail(videoUrl: string, clipId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const filename = `thumb_${clipId}_${Date.now()}.jpg`;
        const publicPath = `/thumbnails/${filename}`;

        // Simple extension check (robust for standard URLs)
        const isImage = videoUrl.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i) || videoUrl.includes('flux');

        const proc = ffmpeg(videoUrl);

        if (isImage) {
            // Processing for Static Images (Resize only, no seeking)
            proc.output(path.join(THUMBNAIL_DIR, filename))
                .size('320x180')
                .on('end', () => resolve(publicPath))
                .on('error', (err) => {
                    console.error('Error generating image thumbnail:', err);
                    resolve(null);
                })
                .run();
        } else {
            // Processing for Videos (Screenshot at 1s)
            proc.screenshots({
                timestamps: ['1'], // Take shot at 1s mark
                filename: filename,
                folder: THUMBNAIL_DIR,
                size: '320x180'
            })
                .on('end', () => resolve(publicPath))
                .on('error', (err) => {
                    console.error('Error generating video thumbnail:', err);
                    resolve(null);
                });
        }
    });
}
