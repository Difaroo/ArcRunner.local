
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
    console.log('Fixing Clip 269...');

    // Clear thumbnailPath for Clip 269
    const res = await db.clip.update({
        where: { id: 269 },
        data: {
            thumbnailPath: '' // Clear stale thumb
        }
    });

    console.log('Updated Clip 269:', res.id, res.thumbnailPath);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
