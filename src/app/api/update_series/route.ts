import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { seriesId, title } = body;

        if (!seriesId || !title?.trim()) {
            return NextResponse.json({ error: 'Series ID and Title are required' }, { status: 400 });
        }

        const updatedSeries = await db.series.update({
            where: { id: seriesId },
            data: { name: title.trim() }
        });

        return NextResponse.json({ success: true, series: updatedSeries });

    } catch (error: any) {
        console.error('Update Series Error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Series name already taken' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to update series' }, { status: 500 });
    }
}
