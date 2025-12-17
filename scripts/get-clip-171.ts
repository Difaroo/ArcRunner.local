import { db } from '@/lib/db';

async function verify() {
    const clip = await db.clip.findUnique({
        where: { id: 171 },
        select: { resultUrl: true }
    });
    console.log(clip?.resultUrl);
}

verify();
