import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { title } = await request.json();

        if (!title) {
            return NextResponse.json({ error: 'Missing title' }, { status: 400 });
        }

        const series = await db.series.create({
            data: {
                name: title,
                status: 'Active',
                totalEpisodes: 0
            }
        });

        // Return the UUID as 'id'. Frontend should handle string IDs (UUIDs are strings).
        return NextResponse.json({ success: true, id: series.id, title: series.name });

    } catch (error: any) {
        console.error('Add Series Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

