import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('[API] Update Series Body:', JSON.stringify(body, null, 2));
        const { seriesId, title, defaultModel } = body;

        if (!seriesId) {
            return NextResponse.json({ error: 'Series ID required' }, { status: 400 });
        }

        const data: any = {};
        if (title?.trim()) data.name = title.trim();
        if (defaultModel) {
            console.log(`[API] Updating Series ${seriesId} defaultModel to: ${defaultModel}`);
            data.defaultModel = defaultModel;
        }

        const updatedSeries = await db.series.update({
            where: { id: seriesId },
            data
        });
        console.log('[API] Updated Series Result:', updatedSeries);

        return NextResponse.json({ success: true, series: updatedSeries });

    } catch (error: any) {
        console.error('Update Series Error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Series name already taken' }, { status: 409 });
        }
        return NextResponse.json({
            error: 'Failed to update series',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
