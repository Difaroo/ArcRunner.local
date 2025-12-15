import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { updates } = await request.json(); // updates: { id: string, sortOrder: number }[]

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
        }

        // Use transaction for atomic batch update
        const transaction = updates.map((update: any) =>
            db.clip.update({
                where: { id: parseInt(update.id) },
                data: { sortOrder: update.sortOrder }
            })
        );

        await db.$transaction(transaction);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Sort API Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

