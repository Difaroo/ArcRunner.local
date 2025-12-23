import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
