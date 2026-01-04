import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:../v0.15_RECOVERY_DATA.db'
        }
    }
})

async function main() {
    try {
        console.log("Connecting to Recovery DB...")
        const clipCount = await prisma.clip.count()
        const seriesCount = await prisma.series.count()

        console.log("-----------------------------------------")
        console.log("VERIFICATION RESULT:")
        console.log(`Clips Found: ${clipCount}`)
        console.log(`Series Found: ${seriesCount}`)
        console.log("-----------------------------------------")
    } catch (e) {
        console.error("CONNECTION FAILED:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
