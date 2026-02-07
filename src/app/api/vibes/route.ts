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

        if (!seriesId) {
            return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
        }

        const vibes = await prisma.vibe.findMany({
            where: {
                seriesId,
                ...(type && { type })
            },
            orderBy: { createdAt: 'desc' }
        });

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
