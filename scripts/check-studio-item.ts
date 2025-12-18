
import { db } from '@/lib/db';

async function main() {
    const name = 'Jack_Parsons_Roswell';
    console.log(`Searching for StudioItem: ${name}`);

    const items = await db.studioItem.findMany({
        where: { name: { contains: 'Jack_Parsons' } } // loose search
    });

    if (items.length === 0) {
        console.log('No item found!');
    } else {
        items.forEach(item => {
            console.log(`Found Item: ID=${item.id}, Name='${item.name}', Type='${item.type}', RefImage='${item.refImageUrl}'`);
        });
    }
}

main();
