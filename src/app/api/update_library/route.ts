import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MediaService } from '@/lib/services/media-service';

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

        // Filter updates to valid fields
        const validFields = ['type', 'name', 'description', 'refImageUrl', 'negatives', 'notes', 'episode', 'status', 'model'];
        const prismaData: any = {};

        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                prismaData[key] = value;
            }
        }

        // If no valid updates, just return success or error?
        if (Object.keys(prismaData).length > 0) {
            // Check if we need to sync references (Dual-Write)
            if (prismaData.refImageUrl !== undefined) {
                // If refImageUrl is changing, we use MediaService to handle the Dual-Write
                // and keeping the Media table in sync (Add/Delete).
                // MediaService.syncStudioReferences updates the StudioItem.refImageUrl internally.
                const newCsv = prismaData.refImageUrl;

                // Remove from prismaData so we don't double-write in the simple update below
                // (Though harmless, it's cleaner to let MediaService handle it if it does the full transaction).
                // Actually MediaService updates the DB. So we should NOT include it in prismaData 
                // IF we want MediaService to own it.
                // However, prismaData might have OTHER fields (name, description etc).

                // Strategy:
                // 1. Let MediaService sync the refs (and update the item refImageUrl).
                // 2. We remove refImageUrl from prismaData.
                // 3. We update the rest of the fields.

                const { refImageUrl, ...rest } = prismaData;

                await MediaService.syncStudioReferences(id, newCsv);

                if (Object.keys(rest).length > 0) {
                    await db.studioItem.update({
                        where: { id },
                        data: rest
                    });
                }
            } else {
                // Normal update without ref changes
                await db.studioItem.update({
                    where: { id },
                    data: prismaData
                });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Library Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

