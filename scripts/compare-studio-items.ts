
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Comparing Studio Items ---');

    const items = await prisma.studioItem.findMany({
        where: {
            name: { in: ['Ghul', 'Wasban', 'Afsaar'] }
        }
    });

    items.forEach(item => {
        console.log(`\nName: "${item.name}"`);
        console.log(`ID: ${item.id}`);
        console.log(`SeriesID: ${item.seriesId}`);
        console.log(`RefImageUrl: "${item.refImageUrl}"`);
        // Check for weird characters
        console.log(`RefImage encoded: ${encodeURIComponent(item.refImageUrl || '')}`);
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
