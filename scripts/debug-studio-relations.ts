
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Studio Item Relations...');

    const seriesList = await prisma.series.findMany();

    for (const series of seriesList) {
        console.log(`\nSeries: ${series.name} (${series.id})`);

        const items = await prisma.studioItem.findMany({
            where: { seriesId: series.id }
        });

        console.log(`  Total Studio Items: ${items.length}`);

        // Breakdown by Type and Episode
        const byType = {};
        const byEp = {};

        items.forEach(item => {
            byType[item.type] = (byType[item.type] || 0) + 1;
            const ep = item.episode || 'NULL';
            byEp[ep] = (byEp[ep] || 0) + 1;
        });

        console.log('  By Type:', byType);
        console.log('  By Episode:', byEp);

        if (items.length > 0) {
            console.log('  Sample Item:', {
                name: items[0].name,
                type: items[0].type,
                params: { seriesId: items[0].seriesId, episode: items[0].episode }
            });
        }
    }

    // Check for Orphans
    const orphans = await prisma.studioItem.findMany({
        where: { seriesId: null } // Should be impossible with schema, but check if empty string or invalid
    });
    // Actually schema says seriesId is String (required?). Let's check schema/migration.
    // Schema: seriesId String. Relation.

    // Check for items with seriesId that doesn't exist? (Prisma enforces FK usually, but maybe not in SQLite if disabled?)
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
