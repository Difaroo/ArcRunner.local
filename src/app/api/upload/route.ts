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

        // Clean filename to remove weird chars
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const finalName = `${timestamp}_${cleanName}`;

        // Save to local storage
        const url = await saveFile(buffer, finalName, 'upload');

        return NextResponse.json({ url });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
