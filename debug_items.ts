
import { db } from './src/lib/db.js';

async function main() {
    const items = await db.studioItem.findMany({
        where: {
            OR: [
                { name: 'Afsaar' },
                { name: 'Qiren' }
            ]
        }
    });

    console.log('Found Items:', JSON.stringify(items, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
