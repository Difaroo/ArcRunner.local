
import { db } from '../src/lib/db';

async function main() {
    const id = 244;
    const item = await db.studioItem.findUnique({
        where: { id },
        include: { media: true }
    });
    console.log(JSON.stringify(item, null, 2));
}

main().catch(console.error);
