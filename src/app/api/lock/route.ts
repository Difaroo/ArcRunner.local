import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { action, clipId, clientId } = await req.json();

        if (!clipId || !clientId) {
            return NextResponse.json({ error: 'Missing clipId or clientId' }, { status: 400 });
        }

        const id = parseInt(clipId);
        if (isNaN(id)) return NextResponse.json({ error: 'Invalid clip ID' }, { status: 400 });

        // -- LOCK ACTION --
        if (action === 'lock') {
            const clip = await db.clip.findUnique({
                where: { id },
                select: { lockedBy: true, lockedAt: true }
            });

            if (!clip) {
                return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
            }

            // Check if locked by someone else
            const isLocked = clip.lockedBy && clip.lockedBy !== clientId;

            // PERMANENT LOCK: If locked by another user, REJECT. No timeouts.
            if (isLocked) {
                return NextResponse.json({ success: false, lockedBy: clip.lockedBy }, { status: 409 });
            }

            // Grant Lock (Overwrite if stale or same user)
            const now = new Date(); // Re-add 'now' definition
            await db.clip.update({
                where: { id },
                data: {
                    lockedBy: clientId,
                    lockedAt: now
                }
            });

            return NextResponse.json({ success: true, clientId });
        }

        // -- UNLOCK ACTION --
        if (action === 'unlock') {
            // Only unlock if we own it (or force override if needed, but safe default is ownership check)
            // Actually, for robust UX, we just clear it. The client should only call this if they own it.
            // But to be safe against race conditions where lock was stolen (stale), we can check.

            // Simple unlock: Clear if lockedBy matches.
            const result = await db.clip.updateMany({
                where: {
                    id,
                    lockedBy: clientId
                },
                data: {
                    lockedBy: null,
                    lockedAt: null
                }
            });

            return NextResponse.json({ success: true, count: result.count });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Lock API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
