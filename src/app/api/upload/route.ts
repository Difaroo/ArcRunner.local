import { NextRequest, NextResponse } from 'next/server';
import { saveFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        // Episode param not strictly needed for flat local structure, but could use for subfolders later
        // const episode = formData.get('episode') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Clean filename to remove weird chars (but keep dot)
        // Note: storage.ts now handles smart renaming if file exists
        const finalName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        // Save to local storage (explicitly do not overwrite uploads)
        const url = await saveFile(buffer, finalName, 'upload', { overwrite: false });

        return NextResponse.json({ url });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
