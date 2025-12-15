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

        // Map updates to Prisma fields
        // Frontend sends keys that mostly match Prisma, but let's be safe.
        const validFields = [
            'status', 'title', 'character', 'location', 'style', 'camera',
            'action', 'dialog', 'refImageUrls', 'seed', 'resultUrl', 'model', 'sortOrder'
        ];

        const prismaData: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                // Ensure correct types if needed (e.g. sortOrder is Int)
                if (key === 'sortOrder') {
                    prismaData[key] = parseInt(value as string) || 0;
                } else {
                    prismaData[key] = value;
                }
            }
        }

        await db.clip.update({
            where: { id },
            data: prismaData
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Clip Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

