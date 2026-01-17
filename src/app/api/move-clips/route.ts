
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { clipIds, targetEpisodeNumber, currentSeriesId } = await req.json();

        // 1. Validation
        if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
            return NextResponse.json({ error: "No clips selected" }, { status: 400 });
        }
        if (!targetEpisodeNumber || !currentSeriesId) {
            return NextResponse.json({ error: "Missing Target Episode or Series Context" }, { status: 400 });
        }

        // 2. Resolve Target Episode
        const targetEpisode = await db.episode.findFirst({
            where: {
                seriesId: currentSeriesId,
                number: parseInt(targetEpisodeNumber.toString())
            }
        });

        if (!targetEpisode) {
            return NextResponse.json({ error: `Episode ${targetEpisodeNumber} not found in this series.` }, { status: 404 });
        }

        // 3. Perform Move
        // We use updateMany for bulk efficiency
        const clipIdNums = clipIds.map((id: string | number) => parseInt(id.toString()));

        const result = await db.clip.updateMany({
            where: {
                id: { in: clipIdNums }
            },
            data: {
                episodeId: targetEpisode.id
            }
        });

        // 4. Update Media records to match new episode
        // All media attached to these clips should also move to the new episode
        await db.media.updateMany({
            where: {
                OR: [
                    { referenceForClipId: { in: clipIdNums } },
                    { resultForClipId: { in: clipIdNums } }
                ]
            },
            data: {
                episodeId: targetEpisode.id
            }
        });

        return NextResponse.json({ success: true, moved: result.count });

    } catch (error) {
        console.error("Move Clips Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
