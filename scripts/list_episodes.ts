
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Listing all episodes:');
    const episodes = await prisma.episode.findMany();
    episodes.forEach((e: any) => {
        console.log(`- ID: "${e.id}", Number: ${e.number}, Title: ${e.title}, SeriesId: ${e.seriesId}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
