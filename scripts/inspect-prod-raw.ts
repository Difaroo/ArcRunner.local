
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:./prisma/prod_v2.db'
        }
    }
});

async function main() {
    try {
        console.log('Inspecting tables in prod_v2.db...');

        const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table';`;
        console.log('Tables:', tables);

        // Try selecting from Clip table if it exists
        const clips = await prisma.$queryRaw`SELECT id, title, episodeId FROM Clip WHERE title LIKE '%Command%' OR title LIKE '%Alien%' LIMIT 10;`;
        console.log('Found Clips:', clips);

        // Check Series table
        const series = await prisma.$queryRaw`SELECT * FROM Series;`;
        console.log('Found Series:', series);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
