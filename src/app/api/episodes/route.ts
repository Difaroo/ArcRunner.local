import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { seriesId, title, number } = body;

        console.log("Create Episode API received:", { seriesId, title, number });

        if (!seriesId || !title?.trim() || !number) {
            return NextResponse.json({ error: 'Series ID, Title, and Episode Number are required' }, { status: 400 });
        }

        const numberInt = parseInt(number.toString());
        if (isNaN(numberInt)) {
            return NextResponse.json({ error: 'Episode Number must be a valid number' }, { status: 400 });
        }
        console.log("Parsed episode number:", numberInt); // Added logging for parsed number

        // Check for duplicate number in series
        const existing = await db.episode.findFirst({
            where: {
                seriesId: seriesId,
                number: numberInt
            }
        });

        if (existing) {
            return NextResponse.json({ error: `Episode ${number} already exists in this series.` }, { status: 409 });
        }

        const episode = await db.episode.create({
            data: {
                seriesId,
                title: title.trim(),
                number: numberInt,
                model: ''
            }
        });

        // We assume the frontend will reload or append this episode to the store
        return NextResponse.json({ success: true, episode });

    } catch (error: any) {
        console.error('Create Episode Error:', error);
        return NextResponse.json({ error: 'Failed to create episode' }, { status: 500 });
    }
}
