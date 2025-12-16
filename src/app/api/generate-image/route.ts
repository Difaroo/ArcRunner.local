import { NextResponse } from 'next/server';
import { GenerateManager } from '@/lib/generate-manager';

const manager = new GenerateManager();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clip, model, aspectRatio } = body;

        // Validate inputs
        if (!clip || !clip.id) {
            return NextResponse.json({ error: 'Invalid clip data' }, { status: 400 });
        }

        const input = {
            clipId: clip.id,
            seriesId: clip.series || '1',
            model: model || 'flux', // Default to flux if hitting this endpoint
            aspectRatio: aspectRatio,
            clip: clip
        };

        const result = await manager.startTask(input);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
