'use server';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PATCH /api/vibes/reorder
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { items } = body; // Expects { items: { id: string, sortOrder: number }[] }

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'items array is required' }, { status: 400 });
        }

        // Transactional update for all items
        await prisma.$transaction(
            items.map((item: { id: string; sortOrder: number }) =>
                prisma.vibe.update({
                    where: { id: item.id },
                    data: { sortOrder: item.sortOrder }
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/vibes/reorder error:', error);
        return NextResponse.json({ error: 'Failed to reorder vibes' }, { status: 500 });
    }
}
