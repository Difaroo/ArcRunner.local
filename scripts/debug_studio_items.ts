
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching Studio Items (Characters/Locations)...');

    // Simulating what endpoints like /api/library do
    const studioItems = await prisma.studioItem.findMany({
        where: {
            OR: [
                { type: 'CHARACTER' },
                { type: 'LOCATION' },
                { type: 'LIB_CHARACTER' }, // VibesMenu check
                { type: 'LIB_LOCATION' }
            ]
        }
    });

    console.log(`Found ${studioItems.length} Studio Items.`);
    studioItems.slice(0, 5).forEach(item => {
        console.log(`- [${item.id}] ${item.name} (${item.type}) | Thumb: ${item.thumbnailPath ? 'YES' : 'NO'}`);
    });

    // Check if we can map these to "Media" shape for the frontend
    /*
    Frontend expects:
    interface Media {
        id: string;
        url: string;
        thumbnailPath?: string;
        type: 'IMAGE' | 'VIDEO';
        category: string;
    }
    */
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
