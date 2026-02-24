/**
 * scripts/fix_generating_clips.ts
 * 
 * Automatically corrects the UI states for legacy generated clips that were
 * manually synced outside of ArcRunner. These clips carry a `tempfile.aiquickdraw.com` URL 
 * and a `status` of 'Done', triggering green traffic lights. The script flips them to `isPersisted = true`
 * and clears the status so they display as dormant (Complete/Black).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Offline Assets Mop-Up Protocol...\n');

    // Fetch all clips that might have issues
    const allClips = await prisma.clip.findMany({
        where: {
            resultUrl: { contains: 'tempfile.aiquickdraw.com' },
            isPersisted: false,
            status: 'Done'
        }
    });

    let updatedCount = 0;

    for (const clip of allClips) {

        await prisma.clip.update({
            where: { id: clip.id },
            data: {
                isPersisted: true,
                status: ''
            }
        });
        updatedCount++;
        console.log(`[FIX-OFFLINE] Clip ID: ${clip.id}, Scene: ${clip.scene} -> Forcing isPersisted=true, status=''`);
    }

    // Now let's handle cases where Witches/Alien Invasion might have `isPersisted: false` but `status: 'Complete'` or Empty
    const otherClips = await prisma.clip.findMany({
        where: {
            resultUrl: { not: null },
            resultUrl: { not: '' },
            isPersisted: false,
            status: ''
        }
    });

    let otherCount = 0;

    for (const clip of otherClips) {
        if (clip.resultUrl?.includes('tempfile.aiquickdraw.com')) {
            await prisma.clip.update({
                where: { id: clip.id },
                data: {
                    isPersisted: true
                }
            });
            otherCount++;
            console.log(`[FIX-ORPHAN] Clip ID: ${clip.id}, Scene: ${clip.scene} -> Forcing isPersisted=true`);
        }
    }

    console.log(`\n========================================`);
    console.log(`[SUMMARY] Finished Offline Mop-Up`);
    console.log(`========================================`);
    console.log(`Forced "Dormant" status on expired links: ${updatedCount}`);
    console.log(`Forced 'isPersisted' on orphaned links:   ${otherCount}`);
    console.log(`========================================\n`);
}

main()
    .catch(e => {
        console.error('[FATAL ERROR]', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
