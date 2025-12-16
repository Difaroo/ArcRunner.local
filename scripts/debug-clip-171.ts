
import { db } from '@/lib/db';

async function main() {
    const clip = await db.clip.findUnique({
        where: { id: 171 }
    });
    console.log(JSON.stringify(clip, null, 2));
}

main().catch(console.error);
