
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
        console.log('Searching in prod_v2.db...');

        // Check Series 2
        const series = await prisma.series.findMany();
        console.log('Series:', series.map(s => `${s.id}: ${s.name}`));

        // Check Episodes in Series 2
        // Assuming Series 2 has ID "2" or similar based on name "Alien Invasion"
        // Let's find series by name
        const alienSeries = series.find(s => s.name.includes('Alien') || s.name.includes('Invasion'));

        if (alienSeries) {
            const episodes = await prisma.episode.findMany({
                where: { seriesId: alienSeries.id }
            });
            console.log('Episodes:', episodes.map(e => `${e.id}: ${e.title}`));

            // Look for clips in Ep 2
            // Assuming Ep 2 has ID or number
            const ep2 = episodes.find(e => e.number === 2 || e.title?.includes('2'));

            if (ep2) {
                const clips = await prisma.clip.findMany({
                    where: { episodeId: ep2.id }
                });
                console.log(`Clips in Ep ${ep2.id}:`, clips.map(c => `${c.id}: ${c.title} [${c.scene}]`));
            } else {
                console.log('Episode 2 not found via number/title match.');
            }
        } else {
            console.log('Series "Alien Invasion" not found.');
        }

        // Global search for "Command"
        const commandClips = await prisma.clip.findMany({
            where: {
                OR: [
                    { title: { contains: 'Command' } },
                    { action: { contains: 'Command' } },
                    { dialog: { contains: 'Command' } }
                ]
            }
        });
        console.log('Clips searching "Command":', commandClips.map(c => `${c.id}: ${c.title}`));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
