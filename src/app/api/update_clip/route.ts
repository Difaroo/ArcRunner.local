import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateThumbnail } from '@/lib/thumbnail-generator';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { rowIndex, updates } = await request.json();

        if (rowIndex === undefined || !updates) {
            return NextResponse.json({ error: 'Missing rowIndex or updates' }, { status: 400 });
        }

        const id = parseInt(rowIndex);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        // Map updates to Prisma fields
        // Frontend sends keys that mostly match Prisma, but let's be safe.
        const validFields = [
            'status', 'title', 'character', 'location', 'style', 'camera',
            'action', 'dialog', 'refImageUrls', 'seed', 'resultUrl', 'model', 'sortOrder'
        ];

        const prismaData: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                // ... (existing logic)
                if (key === 'sortOrder') {
                    prismaData[key] = parseInt(value as string) || 0;
                } else {
                    prismaData[key] = value;
                }
            }
        }

        const updatedClip = await db.clip.update({
            where: { id },
            data: prismaData
        });

        // Robustness Check: Does the thumbnail actually exist on disk?
        let thumbnailFileExists = false;
        if (updatedClip.thumbnailPath) {
            // Remove leading slash if present to join correctly with public dir
            const relPath = updatedClip.thumbnailPath.startsWith('/') ? updatedClip.thumbnailPath.slice(1) : updatedClip.thumbnailPath;
            const absPath = path.join(process.cwd(), 'public', relPath);
            thumbnailFileExists = fs.existsSync(absPath);
        }

        // Trigger Thumbnail Generation if:
        // 1. resultUrl explicitly changed (updates.resultUrl)
        // 2. OR resultUrl exists AND (thumbnail is missing in DB OR missing on Disk)
        const shouldGenerate = (updates.resultUrl) || (updatedClip.resultUrl && (!updatedClip.thumbnailPath || !thumbnailFileExists));

        if (shouldGenerate && updatedClip.resultUrl) {
            // Run in background
            generateThumbnail(updatedClip.resultUrl, id.toString())
                .then(async (thumbnailPath) => {
                    if (thumbnailPath) {
                        await db.clip.update({
                            where: { id },
                            data: { thumbnailPath }
                        });
                        console.log(`Thumbnail generated/repaired for clip ${id}: ${thumbnailPath}`);
                    }
                })
                .catch(err => console.error('Thumbnail generation failed:', err));
        }

        return NextResponse.json({ success: true, clip: updatedClip });

    } catch (error: any) {
        console.error('Update Clip Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
