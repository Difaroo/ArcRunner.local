/**
 * scripts/align-clip-statuses.ts
 * 
 * Automates the cleanup of `Clip` database status fields to ensure UI 
 * consistency and accuracy. Specifically:
 * 1. Clips with an error string in resultUrl -> Set status to 'Error', clear URL.
 * 2. Clips with a local `/media/` URL -> Set isPersisted to true, status = ''.
 * 3. Clips where isPersisted is true -> Force status = ''.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Clip Status Alignment Protocol...\n');

    let fixedErrors = 0;
    let fixedPersisted = 0;
    let fixedStatus = 0;

    // Fetch all clips that might have issues
    const allClips = await prisma.clip.findMany({
        where: {
            OR: [
                { resultUrl: { contains: 'ERR' } },
                { resultUrl: { contains: 'Unknown Error' } },
                { resultUrl: { contains: '/media/' } },
                { isPersisted: true, status: { not: '' } }
            ]
        }
    });

    for (const clip of allClips) {
        let needsUpdate = false;
        const data: any = {};

        // 1. Fix Error Strings saved natively into URL
        if (clip.resultUrl && (clip.resultUrl.includes('ERR') || clip.resultUrl.includes('Unknown Error'))) {
            data.resultUrl = '';
            data.status = 'Error';
            needsUpdate = true;
            console.log(`[FIX-ERR] Clip ID: ${clip.id}, Scene: ${clip.scene} -> Setting Status to 'Error', clearing URL (${clip.resultUrl})`);
        }
        else {
            // 2. Fix Local Media not marked Persisted
            if (clip.resultUrl && clip.resultUrl.includes('/media/') && !clip.isPersisted) {
                data.isPersisted = true;
                data.status = '';
                needsUpdate = true;
                console.log(`[FIX-LOCAL] Clip ID: ${clip.id}, Scene: ${clip.scene} -> Forcing isPersisted=true, status=''`);
            }
            // 3. Fix Persisted Clips with leftover string status (e.g. 'Done')
            else if (clip.isPersisted && clip.status !== '') {
                data.status = '';
                needsUpdate = true;
                console.log(`[FIX-PERSISTED] Clip ID: ${clip.id}, Scene: ${clip.scene} -> Clearing status (was '${clip.status}')`);
            }
        }

        if (needsUpdate) {
            await prisma.clip.update({
                where: { id: clip.id },
                data: data
            });

            if (data.status === 'Error') fixedErrors++;
            if (data.isPersisted === true) fixedPersisted++;
            if (data.status === '' && data.isPersisted === undefined) fixedStatus++;
        }
    }

    console.log(`\n========================================`);
    console.log(`[SUMMARY] Finished Aligning Databases`);
    console.log(`========================================`);
    console.log(`Converted URL errors to True Errors: ${fixedErrors}`);
    console.log(`Fixed missing isPersisted flags:     ${fixedPersisted}`);
    console.log(`Cleared leftover "Done" statuses:    ${fixedStatus}`);
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
