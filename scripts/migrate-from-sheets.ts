
// --- Types mapping to Sheet Columns ---
// (Simplified for script usage)

async function main() {
    console.log('🚀 Starting Migration: Google Sheets -> SQLite');

    // 0. Load Environment Variables (Dynamic)
    // We use dynamic imports for everything to ensure Env is loaded first.
    const path = await import('path');
    const fs = await import('fs');
    const dotenv = await import('dotenv');

    const loadEnv = (file: string) => {
        const p = path.default.resolve(process.cwd(), file);
        if (fs.default.existsSync(p)) {
            console.log(`Loading ${file}...`);
            dotenv.default.config({ path: p });
        }
    };
    loadEnv('.env.local');
    loadEnv('.env');

    console.log('Env Check:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'OK' : 'MISSING');

    // Dynamic Imports to respect Env Loading
    const { db } = await import('../src/lib/db.ts');
    const { getSheetData, parseHeaders } = await import('../src/lib/sheets.ts');

    // 1. SAFETY: Dump Sheets to JSON
    console.log('Phase 1: Fetching ALL Data from Sheets...');
    const [clipsData, libraryData, episodesData, seriesData] = await Promise.all([
        getSheetData('CLIPS!A1:ZZ'),
        getSheetData('LIBRARY!A1:ZZ'),
        getSheetData('EPISODES!A1:ZZ'),
        getSheetData('SERIES!A1:ZZ')
    ]);

    const backupDir = path.default.join(process.cwd(), 'backups');
    if (!fs.default.existsSync(backupDir)) fs.default.mkdirSync(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.default.join(backupDir, `migration-dump-${timestamp}.json`);

    const dump = {
        clips: clipsData,
        library: libraryData,
        episodes: episodesData,
        series: seriesData
    };

    fs.default.writeFileSync(backupFile, JSON.stringify(dump, null, 2));
    console.log(`✅ Backup saved to ${backupFile}`);

    // Helper to parse
    const parseSheet = (data: any[][] | null | undefined) => {
        if (!data || data.length === 0) return { headers: new Map<string, number>(), rows: [] };
        const headers = parseHeaders(data);
        const rows = data.slice(1);
        return { headers, rows };
    };

    const getVal = (row: any[], map: Map<string, number>, col: string) => {
        const idx = map.get(col);
        if (idx === undefined) return undefined;
        const val = row[idx];
        return val ? String(val).trim() : undefined;
    };

    const extractTaskId = (val: string | undefined): string | undefined => {
        if (!val) return undefined;
        // If it looks like a task ID
        if (val.startsWith('TASK:')) return val.replace('TASK:', '');
        return undefined;
    }

    const sSheet = parseSheet(seriesData);
    const eSheet = parseSheet(episodesData);
    const cSheet = parseSheet(clipsData);
    const lSheet = parseSheet(libraryData);

    console.log(`Found: ${sSheet.rows.length} Series, ${eSheet.rows.length} Episodes, ${cSheet.rows.length} Clips, ${lSheet.rows.length} Library Items.`);

    // 2. Clear Existing DB (Reset)
    console.log('Phase 2: Cleaning DB...');
    try {
        await db.clip.deleteMany({});
        await db.studioItem.deleteMany({});
        await db.episode.deleteMany({});
        await db.series.deleteMany({});
    } catch (err: any) {
        console.warn('Warning during cleanup (tables might be non-existent or empty):', err.message);
    }


    // 3. Migrate Series
    console.log('Phase 3: Migrating Series...');
    const seriesMap = new Map<string, string>(); // Sheet ID -> DB UUID

    for (const row of sSheet.rows) {
        const sid = getVal(row, sSheet.headers, 'Series #');
        const title = getVal(row, sSheet.headers, 'Title');
        const status = getVal(row, sSheet.headers, 'Status');

        if (!sid || !title) continue;

        const created = await db.series.create({
            data: {
                id: sid, // Force ID to match Sheet ID
                name: title,
                status: status,
            }
        });
        seriesMap.set(sid, created.id);
        console.log(`  Included Series: ${title} (${sid}) -> ${created.id}`);
    }

    // Default Series if missing
    if (seriesMap.size === 0) {
        console.log('  No Series found. Creating Default.');
        const def = await db.series.create({ data: { id: '1', name: 'Default Series' } });
        seriesMap.set('1', def.id);
    }

    // 4. Migrate Episodes
    console.log('Phase 4: Migrating Episodes...');
    const episodeMap = new Map<string, string>(); // "SeriesID-EpNum" -> DB UUID

    // From EPISODES Sheet
    for (const row of eSheet.rows) {
        const sid = getVal(row, eSheet.headers, 'Series') || '1';
        const epNumStr = getVal(row, eSheet.headers, 'Episode Number') || getVal(row, eSheet.headers, 'Episode');
        const title = getVal(row, eSheet.headers, 'Title');
        const model = getVal(row, eSheet.headers, 'Model');

        if (!epNumStr) continue;

        const dbSeriesId = seriesMap.get(sid) || seriesMap.get('1');
        if (!dbSeriesId) continue;

        const created = await db.episode.create({
            data: {
                number: parseInt(epNumStr) || 0,
                title: title,
                model: model,
                seriesId: dbSeriesId
            }
        });
        episodeMap.set(`${sid}-${epNumStr}`, created.id);
    }

    // Infer missing episodes from Clips
    for (const row of cSheet.rows) {
        const sid = getVal(row, cSheet.headers, 'Series') || '1';
        const epNum = getVal(row, cSheet.headers, 'Episode') || '1';
        const key = `${sid}-${epNum}`;

        if (!episodeMap.has(key)) {
            console.log(`  Inferring missing Episode ${epNum} for Series ${sid}...`);
            const dbSeriesId = seriesMap.get(sid) || seriesMap.get('1');
            if (dbSeriesId) {
                const created = await db.episode.create({
                    data: {
                        number: parseInt(epNum) || 0,
                        title: `Episode ${epNum}`,
                        seriesId: dbSeriesId
                    }
                });
                episodeMap.set(key, created.id);
            }
        }
    }


    // 5. Migrate Studio Items (Library)
    console.log('Phase 5: Migrating Studio Items...');
    let studioCount = 0;
    for (const row of lSheet.rows) {
        const type = getVal(row, lSheet.headers, 'Type');
        const name = getVal(row, lSheet.headers, 'Name');
        if (!name || name === 'Name') continue; // Skip header helper

        const sid = getVal(row, lSheet.headers, 'Series') || '1';
        const dbSeriesId = seriesMap.get(sid) || seriesMap.get('1');
        if (!dbSeriesId) continue;

        // Type mapping
        let dbType = 'LIB_OTHER';
        if (type?.includes('Character')) dbType = 'LIB_CHARACTER';
        if (type?.includes('Location')) dbType = 'LIB_LOCATION';
        if (type?.includes('Style')) dbType = 'LIB_STYLE';
        if (type?.includes('Camera')) dbType = 'LIB_CAMERA';

        await db.studioItem.create({
            data: {
                type: dbType,
                name: name,
                description: getVal(row, lSheet.headers, 'Description'),
                refImageUrl: getVal(row, lSheet.headers, 'Ref Image URLs'),
                negatives: getVal(row, lSheet.headers, 'Negatives'),
                notes: getVal(row, lSheet.headers, 'Notes'),
                episode: getVal(row, lSheet.headers, 'Episode'),
                seriesId: dbSeriesId
            }
        });
        studioCount++;
    }
    console.log(`  Migrated ${studioCount} Studio Items.`);


    // 6. Migrate Clips
    console.log('Phase 6: Migrating Clips...');
    let clipCount = 0;
    for (const [index, row] of cSheet.rows.entries()) {
        const scene = getVal(row, cSheet.headers, 'Scene #');
        if (!scene || scene === 'Scene #') continue;

        const sid = getVal(row, cSheet.headers, 'Series') || '1';
        const epNum = getVal(row, cSheet.headers, 'Episode') || '1';
        const epKey = `${sid}-${epNum}`;
        const dbEpisodeId = episodeMap.get(epKey);

        if (!dbEpisodeId) {
            console.warn(`  SKIPPING Clip ${scene}: Episode ${epNum} (Series ${sid}) not found in DB.`);
            continue;
        }

        const resultUrl = getVal(row, cSheet.headers, 'Result URL');

        await db.clip.create({
            data: {
                scene: scene,
                status: getVal(row, cSheet.headers, 'Status') || 'Pending',
                title: getVal(row, cSheet.headers, 'Title'),
                action: getVal(row, cSheet.headers, 'Action'),
                dialog: getVal(row, cSheet.headers, 'Dialog'),
                character: getVal(row, cSheet.headers, 'Character') || getVal(row, cSheet.headers, 'Characters'),
                location: getVal(row, cSheet.headers, 'Location'),
                style: getVal(row, cSheet.headers, 'Style'),
                camera: getVal(row, cSheet.headers, 'Camera'),
                model: getVal(row, cSheet.headers, 'Model'),
                seed: getVal(row, cSheet.headers, 'Seed'),
                sortOrder: parseInt(getVal(row, cSheet.headers, 'Sort Order') || '0'),
                refImageUrls: getVal(row, cSheet.headers, 'Ref Image URLs'),
                resultUrl: resultUrl,
                taskId: getVal(row, cSheet.headers, 'Task ID') || extractTaskId(resultUrl),
                episodeId: dbEpisodeId
            }
        });
        clipCount++;
    }
    console.log(`  Migrated ${clipCount} Clips.`);

    console.log('✅ Migration Complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        // We can't easily disconnect db here because it's imported dynamically and db is a singleton export.
        // Process exit will handle it.
    });
