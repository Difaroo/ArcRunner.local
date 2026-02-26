const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const db = new PrismaClient();

async function main() {
    const persisted = await db.clip.findMany({ where: { isPersisted: true }, select: { id: true } });
    let resetCount = 0;
    let keepCount = 0;

    for (const c of persisted) {
        const media = await db.media.findFirst({ where: { resultForClipId: c.id }, select: { localPath: true } });
        const fileExists = media?.localPath ? fs.existsSync(media.localPath) : false;

        if (!fileExists) {
            await db.clip.update({ where: { id: c.id }, data: { isPersisted: false } });
            resetCount++;
        } else {
            keepCount++;
        }
    }

    console.log(`Reset ${resetCount} stale isPersisted flags. Kept ${keepCount} valid ones.`);
    await db.$disconnect();
}

main().catch(console.error);
