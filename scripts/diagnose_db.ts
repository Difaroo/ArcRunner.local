import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    console.log("=== ARCRUNNER DATABASE DIAGNOSTICS ===\\n");

    const clips = await prisma.clip.findMany({
        include: {
            mediaReferences: true,
            mediaResults: true,
            episode: true
        }
    });

    const media = await prisma.media.findMany();
    const studioItems = await prisma.studioItem.findMany({
        include: { media: true }
    });

    console.log(`Analyzing ${clips.length} Clips, ${media.length} Media items, ${studioItems.length} Studio items...\\n`);

    let anomalies = [];

    // 1. Check Clip Statuses vs Results
    for (const clip of clips) {
        const hasResultMedia = clip.mediaResults.length > 0;
        const hasResultUrl = !!clip.resultUrl;

        if (clip.status === 'Done' && !hasResultUrl && !hasResultMedia) {
            anomalies.push(`[Clip ${clip.id}] Status is 'Done' but has no resultUrl or Media result.`);
        }
        if ((hasResultUrl || hasResultMedia) && clip.status !== 'Done') {
            anomalies.push(`[Clip ${clip.id}] Has resultUrl or Media result but status is '${clip.status}'.`);
        }

        // Check semantic links vs explicit media references
        const chars = clip.character ? clip.character.split(',').map(c => c.trim()) : [];
        if (chars.length > 0) {
            // See if we have mediaReferences that match these characters? Hard to link without joining StudioItems.
            // Let's at least check if there are explicit mediaReferences when characters are defined.
            // Some test cases might not have mediaReferences yet.
        }

        // Check refImageSort conflicts
        const refSorts = clip.mediaReferences.map(m => m.refImageSort).filter(s => s > 0);
        const uniqueSorts = new Set(refSorts);
        if (refSorts.length !== uniqueSorts.size) {
            anomalies.push(`[Clip ${clip.id}] Duplicate refImageSort values found in explicit Media references: ${refSorts.join(', ')}`);
        }
    }

    // 2. Check Media Orphans & Anomalies
    for (const m of media) {
        if (!m.referenceForClipId && !m.resultForClipId && !m.studioItemId && !m.episodeId) {
            anomalies.push(`[Media ${m.id}] Completely orphaned metadata. No relations attached.`);
        }
        if (m.category === 'REFERENCE' && !m.referenceForClipId && !m.episodeId) {
            anomalies.push(`[Media ${m.id}] Is 'REFERENCE' but has no clip or episode attachment.`);
        }
        if (m.category === 'RESULT' && !m.resultForClipId) {
            anomalies.push(`[Media ${m.id}] Is 'RESULT' but has no resultForClipId.`);
        }
    }

    // 3. Check Studio Items
    for (const si of studioItems) {
        if (si.status === 'DONE' && !si.refImageUrl) {
            anomalies.push(`[StudioItem ${si.id} - ${si.name}] Status is 'DONE' but no refImageUrl.`);
        }
        if (si.refImageUrl && si.status !== 'DONE') {
            anomalies.push(`[StudioItem ${si.id} - ${si.name}] Has refImageUrl but status is '${si.status}'.`);
        }
        // Check if StudioItem Media links exist
        if (si.refImageUrl && si.media.length === 0) {
            anomalies.push(`[StudioItem ${si.id} - ${si.name}] Has refImageUrl but no normalized Media record linked via studioItemId.`);
        }
    }

    if (anomalies.length > 0) {
        console.log("⚠️  ANOMALIES DETECTED:");
        anomalies.forEach(a => console.log(` - ${a}`));
    } else {
        console.log("✅ No anomalies detected in the current data structure.");
    }
}

diagnose()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
