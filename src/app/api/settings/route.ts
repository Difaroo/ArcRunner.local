import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROMPT_FILE = path.join(process.cwd(), 'mega_prompt.txt');

export async function GET() {
    try {
        if (!fs.existsSync(PROMPT_FILE)) {
            return NextResponse.json({ prompt: '' });
        }
        const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8');
        return NextResponse.json({ prompt });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { prompt } = await request.json();
        fs.writeFileSync(PROMPT_FILE, prompt || '');
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
