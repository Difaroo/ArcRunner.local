import { NextResponse } from 'next/server';
import { GenerateManager } from '@/lib/generate-manager';

const manager = new GenerateManager();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // page.tsx sends: { clip, library, model, aspectRatio, rowIndex, seed }
        const { clip, model, aspectRatio, seed } = body;

        // Validate inputs
        if (!clip || !clip.id) {
            return NextResponse.json({ error: 'Invalid clip data' }, { status: 400 });
        }

        const input = {
            clipId: clip.id, // Row Index / ID
            seriesId: clip.series || '1',
            model: model,
            aspectRatio: aspectRatio,
            seed: seed ? parseInt(String(seed)) : undefined,
            clip: clip
        };

        const result = await manager.startTask(input);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
