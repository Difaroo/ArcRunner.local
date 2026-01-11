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
        // CRITICAL SECURITY FIX: STRICT WHITELIST
        // We REMOVE 'resultUrl', 'status', 'taskId' from this list.
        // These fields MUST ONLY be updated by the System (Polling/Generation), not by User Edits.
        const validFields = [
            'title', 'character', 'location', 'style', 'camera',
            'action', 'dialog', 'refImageUrls', 'seed', 'model', 'sortOrder',
            'negativePrompt', 'isHiddenInStoryboard', 'explicitRefUrls' // Added explicitRefUrls
        ];

        const prismaData: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                if (key === 'sortOrder') {
                    prismaData[key] = parseInt(value as string) || 0;
                } else {
                    prismaData[key] = value;
                }
            }
        }

        console.log(`[API] Update Clip ${id} Payload:`, JSON.stringify(prismaData));

        // Helper to separate Media updates from Clip updates
        // If refImageUrls or explicitRefUrls is provided, we use the Service to SYNC Media Table.
        // We remove it from the Prisma Payload so it doesn't get double-written blindly.
        const refUrlUpdate = updates.refImageUrls ?? updates.explicitRefUrls;

        // Ensure "undefined" specifically means "no update present"
        // But "" (empty string) means "clear references"
        const isRefUpdate = refUrlUpdate !== undefined;

        if (isRefUpdate) {
            // Remove from direct DB payload
            delete prismaData.refImageUrls;
            delete prismaData.explicitRefUrls;
        }

        let updatedClip;

        // Transactional update if Media Sync is needed
        if (isRefUpdate) {
            console.log(`[API] Syncing References for Clip ${id}`);
            // Use MediaService to sync (which also updates Clip.refImageUrls inside its transaction)
            await import('@/lib/services/media-service').then(m => m.MediaService.syncReferences(id, refUrlUpdate));

            // Now apply OTHER updates if any
            if (Object.keys(prismaData).length > 0) {
                updatedClip = await db.clip.update({
                    where: { id },
                    data: prismaData
                });
            } else {
                // If only refs were updated, fetch the clip to return it
                updatedClip = await db.clip.findUnique({ where: { id } });
            }
        } else {
            // Standard Path
            updatedClip = await db.clip.update({
                where: { id },
                data: prismaData
            });
        }

        if (!updatedClip) {
            return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
        }

        console.log(`[API] Update Success:`, JSON.stringify(updatedClip));

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

        // Fetch Episode Number for the response to match Frontend 'Clip' type
        const clipWithEpisode = await db.clip.findUnique({
            where: { id: updatedClip.id },
            select: { episode: { select: { number: true } } }
        });

        const epNum = clipWithEpisode?.episode?.number.toString() || '1';

        // Transform to match Frontend Interface
        const formattedClip = {
            ...updatedClip,
            id: updatedClip.id.toString(), // CRITICAL: Frontend expects String ID
            episode: epNum,                // CRITICAL: Frontend expects Episode Number
            // Ensure explicitRefUrls is passed back so UI updates immediately
            explicitRefUrls: updatedClip.refImageUrls
        };

        return NextResponse.json({ success: true, clip: formattedClip });

    } catch (error: any) {
        console.error('Update Clip Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
