const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clip = await prisma.clip.findFirst({
        where: { NOT: { title: null } },
        select: { id: true, title: true }
    });
    console.log("Found clip:", clip);
}

main()
  .catch(e => console.error(e))
  .finally(async () => { await prisma.$disconnect(); });
