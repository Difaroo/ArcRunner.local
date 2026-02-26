import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
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

        // STRICT WHITELIST — refImageUrls/explicitRefUrls removed (legacy CSV killed)
        const validFields = [
            'title', 'character', 'location', 'style', 'camera',
            'action', 'dialog', 'seed', 'model', 'sortOrder',
            'negativePrompt', 'isHiddenInStoryboard', 'scene', 'isSelected',
            'movement', 'status'
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

        // Handle ref image sync via Media table (if mediaRefs CSV is provided by legacy callers)
        const refUrlUpdate = updates.mediaRefUrls; // New key for any remaining sync callers
        const isRefUpdate = refUrlUpdate !== undefined;

        if (isRefUpdate) {
            console.log(`[API] Syncing References for Clip ${id}`);
            await import('@/lib/services/media-service').then(m => m.MediaService.syncReferences(id, refUrlUpdate));
        }

        // PHASE 2: Sync Studio Items (Characters/Location) -> Media Table
        if (updates.character !== undefined || updates.location !== undefined) {
            const MediaService = (await import('@/lib/services/media-service')).MediaService;

            if (updates.character !== undefined) {
                const charNames = updates.character ? (updates.character as string).split(',').map(s => s.trim()) : [];
                await MediaService.syncClipStudioItems(id, 'CHARACTER', charNames);
            }

            if (updates.location !== undefined) {
                const locName = updates.location ? [updates.location as string] : [];
                await MediaService.syncClipStudioItems(id, 'LOCATION', locName);
            }
        }

        let updatedClip;

        if (Object.keys(prismaData).length > 0) {
            updatedClip = await db.clip.update({
                where: { id },
                data: prismaData
            });
        } else {
            updatedClip = await db.clip.findUnique({ where: { id } });
        }

        // Handle ModelInputSlots (Relational Architecture v0.28+)
        // These require Prisma nested writes, not simple field updates
        if (updates.modelInputSlots && Array.isArray(updates.modelInputSlots)) {
            console.log(`[API] MIS: Received ${updates.modelInputSlots.length} slots for Clip ${id}`);
            updates.modelInputSlots.forEach((s: any, i: number) => {
                console.log(`[API] MIS[${i}]: id=${s.id} mediaId=${s.mediaId} studioItemId=${s.studioItemId} media=${!!s.media} studioItem=${s.studioItem?.name || 'null'}`);
            });

            await db.modelInputSlot.deleteMany({ where: { clipId: id } });
            for (let i = 0; i < updates.modelInputSlots.length; i++) {
                const slot = updates.modelInputSlots[i];

                // Resolve IDs: studioItemId takes priority, otherwise use mediaId
                const hasStudioItem = slot.studioItemId != null;
                const resolvedMediaId = hasStudioItem ? null : (slot.mediaId || null);
                const resolvedStudioItemId = hasStudioItem ? (typeof slot.studioItemId === 'number' ? slot.studioItemId : parseInt(slot.studioItemId)) : null;

                console.log(`[API] MIS CREATE[${i}]: mediaId=${resolvedMediaId} studioItemId=${resolvedStudioItemId}`);

                await db.modelInputSlot.create({
                    data: {
                        clipId: id,
                        mediaId: resolvedMediaId,
                        studioItemId: resolvedStudioItemId && !isNaN(resolvedStudioItemId) ? resolvedStudioItemId : null,
                        sortOrder: typeof slot.sortOrder === 'number' ? slot.sortOrder : i
                    }
                });
            }
            console.log(`[API] Persisted ${updates.modelInputSlots.length} ModelInputSlots for Clip ${id}`);
        }

        if (!updatedClip) {
            return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
        }

        console.log(`[API] Update Success:`, JSON.stringify(updatedClip));

        // Thumbnail generation
        let thumbnailFileExists = false;
        if (updatedClip.thumbnailPath) {
            const relPath = updatedClip.thumbnailPath.startsWith('/') ? updatedClip.thumbnailPath.slice(1) : updatedClip.thumbnailPath;
            const absPath = path.join(process.cwd(), 'public', relPath);
            thumbnailFileExists = fs.existsSync(absPath);
        }

        const shouldGenerate = (updates.resultUrl) || (updatedClip.resultUrl && (!updatedClip.thumbnailPath || !thumbnailFileExists));

        if (shouldGenerate && updatedClip.resultUrl) {
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

        const clipWithContext = await db.clip.findUnique({
            where: { id: updatedClip.id },
            select: {
                episode: { select: { number: true } },
                mediaReferences: { orderBy: { refImageSort: 'desc' } },
                modelInputSlots: {
                    include: {
                        media: { include: { studioItem: true } },
                        studioItem: {
                            include: {
                                media: {
                                    where: { category: 'STUDIO_UPLOAD' },
                                    orderBy: { id: 'desc' }
                                }
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        }) as any;

        const epNum = clipWithContext?.episode?.number.toString() || '1';

        // Transform to match Frontend Interface
        // Enrich modelInputSlots: resolve studioItem URLs from Media table
        const enrichedSlots = (clipWithContext?.modelInputSlots || []).map((slot: any) => {
            if (slot.studioItem) {
                const studioMedia = slot.studioItem.media;
                const resolvedUrl = (studioMedia && studioMedia.length > 0) ? studioMedia[0].url : slot.studioItem.refImageUrl;
                return {
                    ...slot,
                    studioItem: {
                        ...slot.studioItem,
                        refImageUrl: resolvedUrl || slot.studioItem.refImageUrl || '',
                        media: undefined
                    }
                };
            }
            return slot;
        });

        const formattedClip = {
            ...updatedClip,
            id: updatedClip.id.toString(),
            episode: epNum,
            mediaReferences: clipWithContext?.mediaReferences || [],
            modelInputSlots: enrichedSlots
        };

        return NextResponse.json({ success: true, clip: formattedClip });

    } catch (error: any) {
        console.error('Update Clip Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
