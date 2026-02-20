
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for malformed URLs...');
    const badUrl = await prisma.media.findMany({
        where: {
            url: {
                contains: '`'
            }
        }
    });
    console.log(`Found ${badUrl.length} records with backtick in URL`);
    if (badUrl.length > 0) {
        console.log('Deleting bad records...');
        const deleted = await prisma.media.deleteMany({
            where: {
                url: {
                    contains: '`'
                }
            }
        });
        console.log(`Deleted ${deleted.count} records.`);
    }

    const badThumb = await prisma.media.findMany({
        where: {
            thumbnailPath: {
                contains: '`'
            }
        }
    });
    console.log(`Found ${badThumb.length} records with backtick in thumbnailPath`);
    badThumb.forEach(m => console.log(m.id, m.thumbnailPath));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
