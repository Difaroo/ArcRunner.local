
// Use CJS require to bypass ESM complexity
const { PayloadBuilderVeo } = require('../src/lib/builders/PayloadBuilderVeo');

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

async function runMatrix() {
    console.log("==========================================");
    console.log("🧪  PROMPT LOGIC MATRIX TEST SUITE (ABCD ARCHITECTURE)");
    console.log("==========================================");

    const veoBuilder = new PayloadBuilderVeo();

    // --- TEST 1: VEO S2E (2 Explicit Images) ---
    console.log("\n--- TEST 1: Veo S2E (2 Explicit Images) ---");
    const ctxS2E = {
        input: {
            clip: { id: 's2e', action: "Transitions" },
            model: 'veo-s2e',
            aspectRatio: '16:9'
        },
        characterImages: [],
        characterAssets: [],
        locationImages: [],
        explicitImages: ['http://start.png', 'http://end.png'],
        publicImageUrls: ['http://start.png', 'http://end.png'],
        styleImage: null
    };
    const payS2E = veoBuilder.build(ctxS2E);
    console.log(`TaskType: ${payS2E.taskType}, Images: ${payS2E.imageUrls.length}`);
    console.log(`Prompt Preview: ${payS2E.prompt.substring(0, 50)}...`);

    assert(payS2E.taskType === 'IMAGE_TO_VIDEO', "TaskType should be IMAGE_TO_VIDEO for S2E");
    assert(payS2E.imageUrls.length === 2, "S2E must have exactly 2 images");
    assert(payS2E.prompt.includes("Transitions from Start Frame"), "Prompt should contain S2E instruction");

    // --- TEST 2: VEO STANDARD (3 Images: Loc + 2 Chars) ---
    console.log("\n--- TEST 2: Veo Standard (3 Images: ABCD Structure) ---");
    const ctxMulti = {
        input: {
            clip: { id: 'multi', model: 'veo3_fast', location: 'Desert', character: 'A, B', action: "Walking" },
            model: 'veo-quality', // Request Quality
            subjectName: "Subject",
            styleName: "Cinematic"
        },
        characterImages: ['http://c1.png', 'http://c2.png'],
        characterAssets: [
            { name: "CharA", description: "A warrior", negatives: "blurry" },
            { name: "CharB", description: "A mage", negatives: "dark" }
        ],
        locationImages: ['http://loc.png'],
        locationAsset: { name: "Desert", description: "Sandy dunes", negatives: "rain" },
        explicitImages: [],
        publicImageUrls: ['http://loc.png', 'http://c1.png', 'http://c2.png'],
        styleImage: null
    };
    const payMulti = veoBuilder.build(ctxMulti);

    console.log(`Model: ${payMulti.model}, Images: ${payMulti.imageUrls.length}`);
    console.log(`Prompt Preview:\n${payMulti.prompt.substring(0, 150)}...`);

    // 1. API Constraint Check
    assert(payMulti.model === 'veo3_fast', "Must downgrade to 'veo3_fast' because images are present");
    assert(payMulti.imageUrls.length === 3, "Must have 3 images");

    // 2. ABCD Structure Check
    assert(payMulti.prompt.includes("SETUP / REFERENCE:"), "Must contain Setup Block header");
    assert(payMulti.prompt.includes("LOCATION: Desert: IMAGE 1:"), "Must link Location to Image 1");
    // Note: PromptSelector logic: Loc=1, CharA=2, CharB=3
    assert(payMulti.prompt.includes("CHARACTER: CharA: IMAGE 2:"), "Must link CharA to Image 2");
    assert(payMulti.prompt.includes("CHARACTER: CharB: IMAGE 3:"), "Must link CharB to Image 3");

    assert(payMulti.prompt.includes("ACTION: [Walking]"), "Must contain Action Block");
    assert(payMulti.prompt.includes("PRIORITY RULE"), "Must contain Style System Header (due to text style)");

    // --- TEST 3: VEO TEXT ONLY (Quality Allowed) ---
    console.log("\n--- TEST 3: Veo Text Only (Quality Check) ---");
    const ctxText = {
        input: {
            clip: { id: 'txt', model: 'veo-quality' },
            model: 'veo-quality',
        },
        characterImages: [], characterAssets: [],
        locationImages: [],
        explicitImages: [],
        publicImageUrls: [],
        styleImage: null
    };
    const payText = veoBuilder.build(ctxText);
    console.log(`Model: ${payText.model}`);
    assert(payText.model === 'veo3', "Text Only mode should ALLOW 'veo3' (Quality)");
    assert(payText.imageUrls.length === 0, "No images");


    // --- TEST 6: SMART LINKAGE (Explicit Image Claims Character Slot) ---
    console.log("\n--- TEST 6: Smart Linkage (Explicit Image Claims Character) ---");
    const ctxSmart = {
        input: {
            clip: { id: 'smart', model: 'veo3_fast', character: 'Qiren' },
            model: 'veo3_fast'
        },
        characterImages: [], // Legacy resolver missed it
        characterAssets: [
            { name: "Qiren", description: "Jinn", negatives: "", refImageUrl: "http://qiren_master.png" }
        ],
        locationImages: [],
        explicitImages: ['http://misc.png', 'http://qiren_master.png'], // User added it manually here
        publicImageUrls: ['http://misc.png', 'http://qiren_master.png'],
        styleImage: null
    };
    const paySmart = veoBuilder.build(ctxSmart);
    console.log(`Smart Linkage Prompt:\n${paySmart.prompt.substring(0, 200)}...`);

    // Logic: 
    // Qiren Asset URL matches 2nd explicit image.
    // 1. Location -> Empty
    // 2. Character Qiren -> Should claim Image 2 (Index 2 in final array?)
    //    Actually: explicitImages processing order:
    //    Smart Loop runs first. Finds Qiren matches http://qiren_master.png. Adds it.
    //    Then Explicit loop runs. 
    //    Final Array Order: [QirenImage, MiscImage] (because char loop runs before explicit loop)
    //    So Qiren = Image 1. Misc = Image 2.
    //    Let's verify prompt tags.

    assert(paySmart.prompt.includes("CHARACTER: Qiren: IMAGE 1:"), "Qiren should claim Image 1 (Priority over explicit)");
    assert(paySmart.prompt.includes("REF IMAGE 1: IMAGE 2:"), "Misc image should be pushed to ref");

    console.log("\n✅ ALL MATRIX TESTS PASSED.");
}

runMatrix();
