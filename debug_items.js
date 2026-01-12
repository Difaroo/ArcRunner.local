
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    try {
        const items = await prisma.studioItem.findMany({
            where: {
                OR: [
                    { name: 'Afsaar' },
                    { name: 'Qiren' }
                ]
            }
        });

        console.log('Found Items:', JSON.stringify(items, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
