
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Comparing Clips ---');

    // 1. Find Clip 3.3 in Series 5 
    // We'll search by Scene name "3.3" and "2.3" roughly
    const clips = await prisma.clip.findMany({
        where: {
            OR: [
                { scene: '3.3' },
                { scene: '2.3' }
            ]
        },
        include: {
            episode: {
                include: { series: true }
            }
        }
    });

    clips.forEach(c => {
        console.log(`\n--------------------------------------------------`);
        console.log(`Clip ID: ${c.id} | Scene: ${c.scene} | Series: "${c.episode.series.name}" (Ep ${c.episode.number})`);
        console.log(`Character Field:  "${c.character}"`);
        console.log(`RefImageUrls (All): "${c.refImageUrls}"`);
        console.log(`ExplicitRefUrls:  "${c.refImageUrls}"`); // Note: DB schema might not have explicitRefUrls column? It was virtual in API?
        // Let's check schema. virtual fields are checked in API logic.
        // We check native fields.
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
