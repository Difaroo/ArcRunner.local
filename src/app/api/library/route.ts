import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/library?seriesId=xxx&type=LIB_CHARACTER (optional type filter)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const seriesId = searchParams.get('seriesId');
        const type = searchParams.get('type');

        if (!seriesId) {
            return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
        }

        const items = await db.studioItem.findMany({
            where: {
                seriesId,
                ...(type && { type })
            },
            orderBy: { name: 'asc' }
        });

        // Map to standardized format - use refImageUrl as thumbnail fallback
        return NextResponse.json(items.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            thumbnailPath: item.thumbnailPath || item.refImageUrl || null,
            refImageUrl: item.refImageUrl,
            description: item.description
        })));
    } catch (error: any) {
        console.error('Library GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Library Items (StudioItems) use numeric IDs in DB
        const intId = parseInt(id);
        if (isNaN(intId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        await db.studioItem.delete({
            where: { id: intId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Library DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Support two modes: 'duplicate' action or direct create
        // Simplest: just accept the object fields and create
        const { type, name, description, refImageUrl, negatives, notes, episode, series, model } = body;

        if (!type || !name || !series) {
            return NextResponse.json({ error: 'Missing required fields (type, name, series)' }, { status: 400 });
        }

        const newItem = await db.studioItem.create({
            data: {
                type,
                name,
                description: description || '',
                refImageUrl: refImageUrl || '',
                negatives: negatives || '',
                notes: notes || '',
                episode: episode || '1',
                seriesId: series,
                model: model || null
            }
        });

        // Return standardized LibraryItem
        return NextResponse.json({
            success: true,
            item: {
                id: newItem.id.toString(),
                type: newItem.type,
                name: newItem.name,
                description: newItem.description,
                refImageUrl: newItem.refImageUrl,
                negatives: newItem.negatives,
                notes: newItem.notes,
                episode: newItem.episode,
                series: newItem.seriesId,
                model: newItem.model
            }
        });

    } catch (error: any) {
        console.error('Library POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
