
import { test, expect } from '@playwright/test';
import { PayloadBuilderVeo } from '../../src/lib/builders/PayloadBuilderVeo';
import { PayloadBuilderFlux } from '../../src/lib/builders/PayloadBuilderFlux';
import { PayloadBuilderNano } from '../../src/lib/builders/PayloadBuilderNano';

test.describe('Prompt Logic Matrix (Unit)', () => {

    // --- CONTEXT 1: EPISODE CLIPS (Integrated Story Flow) ---
    test.describe('Context: Episode Clip', () => {
        const veoBuilder = new PayloadBuilderVeo();

        test('Veo S2E (Start-to-End) Transition', async () => {
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

            const payload = veoBuilder.build(ctxS2E as any);
            expect(payload.taskType).toBe('IMAGE_TO_VIDEO');
            expect(payload.imageUrls).toHaveLength(2);
            expect(payload.prompt).toContain('Transitions from Start Frame');
        });

        test('Veo Standard (ABCD Structure: Loc + 2 Chars)', async () => {
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

            const payload = veoBuilder.build(ctxMulti as any);

            // 1. Downgrade Logic
            expect(payload.model).toBe('veo3_fast'); // Must downgrade due to images
            expect(payload.imageUrls).toHaveLength(3);

            // 2. Structure Logic
            expect(payload.prompt).toContain('SETUP / REFERENCE:');
            expect(payload.prompt).toContain('LOCATION: Desert: IMAGE 1:');
            expect(payload.prompt).toContain('CHARACTER: CharA: IMAGE 2:');
            expect(payload.prompt).toContain('CHARACTER: CharB: IMAGE 3:');
            expect(payload.prompt).toContain('ACTION: [Walking]');
            expect(payload.prompt).toContain('PRIORITY RULE'); // Style System
        });

        test('Smart Linkage (Explicit Image Claims Character)', async () => {
            const ctxSmart = {
                input: {
                    clip: { id: 'smart', model: 'veo3_fast', character: 'Qiren' },
                    model: 'veo3_fast'
                },
                characterImages: [],
                characterAssets: [
                    { name: "Qiren", description: "Jinn", negatives: "", refImageUrl: "http://qiren_master.png" }
                ],
                locationImages: [],
                explicitImages: ['http://misc.png', 'http://qiren_master.png'],
                publicImageUrls: ['http://misc.png', 'http://qiren_master.png'],
                styleImage: null
            };

            const payload = veoBuilder.build(ctxSmart as any);

            // Qiren should match http://qiren_master.png
            // Note: Order in explicitImages extraction depends on logic.
            // Current Logic: Smart Loop runs first -> Finds Qiren -> Adds to list.
            // Then Explicit Loop runs -> Adds remaining.
            // So Qiren is usually first if it matches an asset.

            expect(payload.prompt).toContain('CHARACTER: Qiren: IMAGE 1:');
            expect(payload.prompt).toContain('REF IMAGE 1: IMAGE 2:'); // Misc image
        });
    });

    // --- CONTEXT 2: STUDIO ASSETS (Single Item Generation) ---
    test.describe('Context: Studio/Library Item', () => {
        const fluxBuilder = new PayloadBuilderFlux();

        test('Character Asset Generation (Flux)', async () => {
            // Simulate input structure from /api/generate-library/route.ts
            const ctxStudio = {
                input: {
                    clipId: 'lib-1',
                    model: 'flux-pro',

                    // Critical: Studio Generation passes Name/Desc explicitly as Subject
                    subjectName: 'Commander Shepard',
                    subjectDescription: 'A sci-fi soldier in N7 armor.',
                    styleName: 'Realism',
                    aspectRatio: '1:1',

                    clip: { id: 'lib-1', name: 'Commander Shepard', type: 'LIB_CHARACTER' } // Pseudo-clip
                },
                publicImageUrls: [],
                characterImages: [], characterAssets: [],
                locationImages: [], locationAsset: undefined,
                explicitImages: [], styleImage: undefined
            };

            const payload = fluxBuilder.build(ctxStudio as any);

            // 1. Check Model Mapping
            expect(payload.model).toBe('flux-2/flex-image-to-image');

            // 2. Check Prompt Content
            // Studio Assets via Flux use LegacySchema which is lighter: [Style]. [Description].
            expect(payload.input.prompt).toContain('Realism');
            expect(payload.input.prompt).toContain('A sci-fi soldier in N7 armor');
            expect(payload.input.prompt).not.toContain('OUTPUT SUBJECT:'); // Legacy schema doesn't use this

            // 3. Aspect Ratio
            expect(payload.input.aspect_ratio).toBe('1:1');
        });

        test('Style Asset Generation (Flux)', async () => {
            const ctxStyle = {
                input: {
                    clipId: 'lib-style-1',
                    model: 'flux-pro',
                    subjectName: 'Cyberpunk Red',
                    subjectDescription: 'Neon lights, rain, high tech low life.',
                    styleName: 'Cinematic', // Provide a style name to ensure it appears

                    clip: { id: 'lib-style-1', name: 'Cyberpunk Red', type: 'LIB_STYLE' }
                },
                publicImageUrls: [],
                characterImages: [], characterAssets: [],
                locationImages: [], locationAsset: undefined,
                explicitImages: [], styleImage: undefined
            };

            const payload = fluxBuilder.build(ctxStyle as any);

            // Verification: Does it just describe the style?
            expect(payload.input.prompt).toContain('Cinematic');
            expect(payload.input.prompt).toContain('Neon lights');
        });
    });

    // --- GENERIC: MODEL SPECIFICS ---
    test.describe('Model Specifics', () => {
        const nanoBuilder = new PayloadBuilderNano();
        const fluxBuilder = new PayloadBuilderFlux();

        test('Nano Config', async () => {
            const ctxNano = {
                input: { clip: { id: 'nano' }, model: 'nano-banana' },
                publicImageUrls: [],
                characterImages: [], characterAssets: [],
                locationImages: [], locationAsset: undefined,
                explicitImages: [], styleImage: undefined
            };
            const payload = nanoBuilder.build(ctxNano as any);
            expect(payload.input.resolution).toBe('2K');
            expect(payload.input.output_format).toBe('png');
        });

        test('Flux Guidance Calculation', async () => {
            const ctxFlux = {
                input: { clip: { id: 'flux' }, model: 'flux-pro', styleStrength: 5 },
                publicImageUrls: [],
                characterImages: [], characterAssets: [],
                locationImages: [], locationAsset: undefined,
                explicitImages: [], styleImage: undefined
            };
            const payload = fluxBuilder.build(ctxFlux as any);
            // 1.5 + ((5-1)*(8.5/9)) = ~5.27
            expect(payload.input.guidance).toBeGreaterThan(5.0);
            expect(payload.input.guidance).toBeLessThan(6.0);
        });
    });

});
