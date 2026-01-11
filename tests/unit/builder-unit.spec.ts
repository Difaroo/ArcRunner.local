import { test, expect } from '@playwright/test';
import { PayloadBuilderFlux } from '@/lib/builders/PayloadBuilderFlux';
import { PayloadBuilderVeo } from '@/lib/builders/PayloadBuilderVeo';
import { PayloadBuilderNano } from '@/lib/builders/PayloadBuilderNano';
import { GenerationContext } from '@/lib/builders/PayloadBuilder';
import { GenerateTaskInput } from '@/lib/generate-manager';

test.describe('Payload Builders Unit Tests', () => {

    const baseClip: any = {
        id: 1,
        character: 'Hero',
        action: 'Running',
        style: 'Anime',
        camera: 'Wide'
    };

    const baseInput: GenerateTaskInput = {
        clipId: '1',
        seriesId: '1',
        model: 'test-model',
        clip: baseClip
    };

    test('Flux Builder: Should calculate guidance correctly', async () => {
        const builder = new PayloadBuilderFlux();

        // Test Strength 1 -> Guidance 1.5
        const ctxLow: GenerationContext = {
            input: { ...baseInput, styleStrength: 1 },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: [], styleImage: null
        };
        const payloadLow = builder.build(ctxLow);
        expect(payloadLow.input.guidance).toBe(1.5);

        // Test Strength 5 -> Guidance ~5.3
        const ctxMid: GenerationContext = {
            input: { ...baseInput, styleStrength: 5 },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: [], styleImage: null
        };
        const payloadMid = builder.build(ctxMid);
        expect(payloadMid.input.guidance).toBeGreaterThan(5);
        expect(payloadMid.input.guidance).toBeLessThan(6);
    });

    test('Flux Builder: Sandwich Prompt Logic', async () => {
        const builder = new PayloadBuilderFlux();
        const ctx: GenerationContext = {
            input: {
                ...baseInput,
                subjectDescription: 'A Hero',
                styleName: 'TestStyle', // Required for Header
                styleImageIndex: 0,
                styleStrength: 5
            },
            publicImageUrls: [], // Deprecated
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: ['http://content.jpg'],
            styleImage: 'http://style.jpg'
        };

        const payload = builder.build(ctx);
        expect(payload.input.prompt).toContain('PRIORITY RULE:');
        expect(payload.input.prompt).toContain('Image 2 defines the STYLE'); // Matched StandardSchema
        expect(payload.input.prompt).toContain('OUTPUT SUBJECT:');
    });

    test('Veo Builder: Dynamic Numbering N+1', async () => {
        const builder = new PayloadBuilderVeo();
        // 2 Images, Index Undefined -> Assume Last (2) is Style
        const ctx: GenerationContext = {
            input: { ...baseInput, styleName: 'TestStyle' },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: ['http://img1.jpg'],
            styleImage: 'http://img2.jpg'
        };

        const payload = builder.build(ctx);
        expect(payload.prompt).toContain('Image 2 defines the STYLE');
        expect(payload.prompt).toContain('SUBJECT IMAGES');
    });

    test('Nano Builder: Dynamic Numbering Parity', async () => {
        const builder = new PayloadBuilderNano();
        // 3 Images, Index 2 -> Image 3 is Style, Images 1-2 are Content
        const ctx: GenerationContext = {
            input: { ...baseInput, styleImageIndex: 2, styleName: 'TestStyle' },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: ['http://c1.jpg', 'http://c2.jpg'], // 2 content images
            styleImage: 'http://style.jpg'
        };

        const payload = builder.build(ctx);
        expect(payload.input.prompt).toContain('Image 3 defines the STYLE');
        expect(payload.input.prompt).toContain('IMAGE 1, IMAGE 2');
    });

    test('Veo S2E: Generation Type Handover', async () => {
        const builder = new PayloadBuilderVeo();

        // Case 1: 2 Images (Start & End) -> IMAGE_TO_VIDEO
        const ctxS2E: GenerationContext = {
            input: { ...baseInput, model: 'veo-s2e' },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: ['http://start.jpg', 'http://end.jpg'],
            styleImage: null
        };
        const payloadS2E = builder.build(ctxS2E);
        expect(payloadS2E.generationType).toBe('IMAGE_TO_VIDEO');
        expect(payloadS2E.imageUrls).toHaveLength(2);

        // Case 2: 1 Image -> Validation Fallback (Ref 2 Video)
        const ctxRef: GenerationContext = {
            input: { ...baseInput, model: 'veo-s2e' },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: ['http://start.jpg'],
            styleImage: null
        };
        const payloadRef = builder.build(ctxRef);
        expect(payloadRef.generationType).toBe('REFERENCE_2_VIDEO');

        // Case 3: 0 Images -> Text 2 Video
        const ctxText: GenerationContext = {
            input: { ...baseInput, model: 'veo-s2e' },
            publicImageUrls: [],
            characterImages: [], characterAssets: [],
            locationImages: [], locationAsset: undefined,
            explicitImages: [], styleImage: null
        };
        const payloadText = builder.build(ctxText);
        expect(payloadText.generationType).toBe('TEXT_2_VIDEO');
    });

});
