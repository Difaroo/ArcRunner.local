
// @ts-nocheck
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Listing Studio Items (LIB_OTHER)...');

    const items = await prisma.studioItem.findMany({
        where: { type: 'LIB_OTHER' }
    });

    console.log(`Found ${items.length} items with type LIB_OTHER.`);

    items.forEach(item => {
        console.log(`[${item.id}] ${item.name} (Series: ${item.seriesId})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
