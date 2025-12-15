import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
        const validFields = ['type', 'name', 'description', 'refImageUrl', 'negatives', 'notes', 'episode'];
        const prismaData: any = {};

        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                prismaData[key] = value;
            }
        }

        // If no valid updates, just return success or error?
        if (Object.keys(prismaData).length > 0) {
            await db.studioItem.update({
                where: { id },
                data: prismaData
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Library Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

