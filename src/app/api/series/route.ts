import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const title = body.title?.trim();

        if (!title) {
            return NextResponse.json({ error: 'Series title is required' }, { status: 400 });
        }

        if (title.length < 2) {
            return NextResponse.json({ error: 'Title must be at least 2 characters' }, { status: 400 });
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

        // Prisma Unique Constraint Violation
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'A series with this name already exists' }, { status: 409 });
        }

        return NextResponse.json({ error: 'Failed to create series' }, { status: 500 });
    }
}

