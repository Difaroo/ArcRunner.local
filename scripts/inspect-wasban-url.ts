
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Inspecting "Wasban" Image URL ---');

    const items = await prisma.studioItem.findMany({
        where: {
            name: { contains: 'Wasban' }
        }
    });

    items.forEach(item => {
        console.log(`- Item: "${item.name}"`);
        console.log(`- RefImageUrl: "${item.refImageUrl}"`);
        console.log(`- Starts with /api/ ? ${item.refImageUrl?.startsWith('/api/')}`);
        console.log(`- Is local path (/)? ${item.refImageUrl?.startsWith('/')}`);
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
