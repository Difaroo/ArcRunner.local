import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const body = await req.json();
    console.log('--- [CLIENT BEACON] ---');
    console.log(JSON.stringify(body, null, 2));
    console.log('-----------------------');
    return NextResponse.json({ ok: true });
}
