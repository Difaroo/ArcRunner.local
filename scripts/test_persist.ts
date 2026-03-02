import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("Fetching clip 338...");
    const clip = await prisma.clip.findUnique({
        where: { id: 338 },
        include: { episode: true }
    });
    console.log("Clip:", clip ? "Found" : "Not Found");
    if (clip) {
        console.log("Result URL:", clip.resultUrl);
        console.log("Episode localMediaPath:", clip.episode.localMediaPath);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
