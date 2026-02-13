'use server';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/vibes?seriesId=xxx&type=ACTION (optional type filter)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const seriesId = searchParams.get('seriesId');
        const type = searchParams.get('type');

        console.log(`[API] GET /vibes Request: seriesId=${seriesId}, type=${type}`);

        // Use $queryRaw to bypass potential stale Prisma Client definition (missing sortOrder)
        // safely handle optional params
        let vibes: any[];

        if (seriesId) {
            if (type) {
                vibes = await prisma.$queryRaw`
                    SELECT * FROM Vibe 
                    WHERE (seriesId = ${seriesId} OR seriesId IS NULL) 
                    AND type = ${type}
                    ORDER BY sortOrder ASC, createdAt DESC
                `;
            } else {
                vibes = await prisma.$queryRaw`
                    SELECT * FROM Vibe 
                    WHERE (seriesId = ${seriesId} OR seriesId IS NULL)
                    ORDER BY sortOrder ASC, createdAt DESC
                `;
            }
        } else {
            if (type) {
                vibes = await prisma.$queryRaw`
                    SELECT * FROM Vibe 
                    WHERE seriesId IS NULL 
                    AND type = ${type}
                    ORDER BY sortOrder ASC, createdAt DESC
                `;
            } else {
                vibes = await prisma.$queryRaw`
                    SELECT * FROM Vibe 
                    WHERE seriesId IS NULL
                    ORDER BY sortOrder ASC, createdAt DESC
                `;
            }
        }

        console.log(`[API] Results found: ${vibes.length}`);
        return NextResponse.json(vibes);
    } catch (error) {
        console.error('GET /api/vibes error:', error);
        return NextResponse.json({ error: 'Failed to fetch vibes' }, { status: 500 });
    }
}

// POST /api/vibes - Create new vibe
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, prompt, type, seriesId } = body;

        if (!title || !prompt || !seriesId) {
            return NextResponse.json(
                { error: 'title, prompt, and seriesId are required' },
                { status: 400 }
            );
        }

        const vibe = await prisma.vibe.create({
            data: {
                title,
                prompt,
                type: type || 'ACTION',
                seriesId
            }
        });

        return NextResponse.json(vibe, { status: 201 });
    } catch (error) {
        console.error('POST /api/vibes error:', error);
        return NextResponse.json({ error: 'Failed to create vibe' }, { status: 500 });
    }
}

// PATCH /api/vibes - Update existing vibe (by id in body)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, prompt, title } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const vibe = await prisma.vibe.update({
            where: { id },
            data: {
                ...(prompt !== undefined && { prompt }),
                ...(title !== undefined && { title })
            }
        });

        return NextResponse.json(vibe);
    } catch (error) {
        console.error('PATCH /api/vibes error:', error);
        return NextResponse.json({ error: 'Failed to update vibe' }, { status: 500 });
    }
}

// DELETE /api/vibes - Delete vibe (by id in body)
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await prisma.vibe.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/vibes error:', error);
        return NextResponse.json({ error: 'Failed to delete vibe' }, { status: 500 });
    }
}
