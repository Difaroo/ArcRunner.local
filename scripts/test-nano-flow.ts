
import { db } from '../src/lib/db';
import { MediaService } from '../src/lib/services/media-service';
import { NanoStrategy } from '../src/lib/kie-strategies';

// Mock Data from Golden Master / Logs
const MOCK_NANO_RESPONSE = {
    data: {
        state: "success",
        // Emulate what we saw in logs or expect from Golden Master
        resultJson: JSON.stringify({
            resultUrls: ["https://tempfile.aiquickdraw.com/sc-u78s9d7f9sd7f9sd7f.mp4"]
        })
    }
};

// Copy of findResultUrl logic for isolation testing (since it's not exported)
function testFindResultUrl(data: any): string {
    if (!data) return '';
    if (data.resultUrl) return data.resultUrl;
    if (data.result_url) return data.result_url;
    if (data.videoUrl) return data.videoUrl;
    if (data.video_url) return data.video_url;
    if (data.url) return data.url;
    if (data.output) return data.output;

    // Arrays
    if (Array.isArray(data.resultUrls) && data.resultUrls[0]) return data.resultUrls[0];

    // Recursive
    if (data.resultJson) {
        try {
            const results = JSON.parse(data.resultJson);
            return testFindResultUrl(results);
        } catch (e) { }
    }
    return '';
}

async function runTest() {
    console.log("=== STARTING NANO COMPONENT TEST ===");

    // 1. TEST URL PARSING
    console.log("\n[1] Testing URL Parsing Logic...");
    const extractedUrl = testFindResultUrl(MOCK_NANO_RESPONSE.data);
    console.log(`    Input Payload: ${JSON.stringify(MOCK_NANO_RESPONSE.data)}`);
    console.log(`    Extracted URL: ${extractedUrl}`);

    if (extractedUrl === "https://tempfile.aiquickdraw.com/sc-u78s9d7f9sd7f9sd7f.mp4") {
        console.log("    ✅ URL Extraction PASSED");
    } else {
        console.error("    ❌ URL Extraction FAILED");
    }

    // 2. TEST DATABASE PERSISTENCE
    console.log("\n[2] Testing MediaPersistence (Dual-Write)...");

    // Create Dummy Studio Item
    const series = await db.series.findFirst();
    if (!series) { console.error("No Series found to attach item to."); return; }

    const item = await db.studioItem.create({
        data: {
            name: "Test Nano Item " + Date.now(),
            type: "LIB_CHARACTER",
            seriesId: series.id,
            status: "Generating"
        }
    });
    console.log(`    Created Temp Studio Item ID: ${item.id}`);

    try {
        const testUrl = "https://example.com/test-video.mp4";
        const type = "VIDEO";

        console.log(`    Calling MediaService.addStudioResult(id=${item.id}, url=${testUrl}, type=${type})...`);
        await MediaService.addStudioResult(item.id, testUrl, type, testUrl);

        // VERIFY
        const updatedItem = await db.studioItem.findUnique({ where: { id: item.id }, include: { media: true } });
        console.log(`    Updated Item RefImageUrl: ${updatedItem?.refImageUrl}`);

        const mediaRecord = updatedItem?.media.find(m => m.url === testUrl);
        console.log(`    Media Record Found:`, mediaRecord);

        if (updatedItem?.refImageUrl?.includes(testUrl) && mediaRecord && mediaRecord.type === 'VIDEO') {
            console.log("    ✅ Persistence PASSED: CSV updated AND Media Record created with type VIDEO");
        } else {
            console.error("    ❌ Persistence FAILED");
            if (!updatedItem?.refImageUrl?.includes(testUrl)) console.error("       - CSV missing URL");
            if (!mediaRecord) console.error("       - Media record missing");
            if (mediaRecord?.type !== 'VIDEO') console.error(`       - Wrong Type: ${mediaRecord?.type}`);
        }

    } catch (e) {
        console.error("    ❌ Persistence Validtion Exception:", e);
    } finally {
        // Cleanup
        await db.studioItem.delete({ where: { id: item.id } });
        console.log("    Cleanup: Deleted temp item.");
    }

    console.log("\n=== TEST COMPLETE ===");
}

runTest()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
