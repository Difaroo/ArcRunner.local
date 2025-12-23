import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { updates } = await request.json();

        if (!Array.isArray(updates)) {
            return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
        }

        // Execute all updates in a transaction
        await db.$transaction(
            updates.map((update: { id: number | string; scene: string }) =>
                db.clip.update({
                    where: { id: update.id },
                    data: { scene: update.scene }
                })
            )
        );

        return NextResponse.json({ success: true, count: updates.length });
    } catch (error) {
        console.error('Error renumbering clips:', error);
        return NextResponse.json({ error: 'Failed to renumber clips' }, { status: 500 });
    }
}
