
import { persistLibraryImage } from '../src/lib/media-persistence';
import fs from 'fs/promises';
import path from 'path';

async function testPersistence() {
    console.log('[Test] Starting Persistence Verification...');

    // 1. Mock a Remote URL (using a reliable dummy image)
    // Using a placeholder image service
    const remoteUrl = 'https://via.placeholder.com/150.png';
    const itemId = 'test-999';

    try {
        const result = await persistLibraryImage(remoteUrl, itemId);
        console.log('[Test] Persistence Result:', result);

        // 2. Verify File Exists on Disk
        // Result localPath is /media/library/..., we need to map validity relative to CWD
        // The implementation assumes process.cwd()/public
        const diskPath = path.join(process.cwd(), 'public', result.localPath);

        try {
            const stat = await fs.stat(diskPath);
            console.log(`[Test] File verified on disk: ${diskPath} (Size: ${stat.size} bytes)`);
            if (stat.size === 0) throw new Error('File is empty!');
        } catch (e) {
            console.error(`[Test] File Missing on disk: ${diskPath}`);
            process.exit(1);
        }

        console.log('[Test] ✅ Persistence Verified.');

    } catch (error) {
        console.error('[Test] ❌ Persistence Failed:', error);
        process.exit(1);
    }
}

testPersistence();
