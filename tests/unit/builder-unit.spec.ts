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
            publicImageUrls: []
        };
        const payloadLow = builder.build(ctxLow);
        expect(payloadLow.input.guidance).toBe(1.5);

        // Test Strength 5 -> Guidance ~5.3
        const ctxMid: GenerationContext = {
            input: { ...baseInput, styleStrength: 5 },
            publicImageUrls: []
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
                styleImageIndex: 0,
                styleStrength: 5
            },
            publicImageUrls: ['http://style.jpg', 'http://content.jpg']
        };

        const payload = builder.build(ctx);
        expect(payload.input.prompt).toContain('PRIORITY RULE:');
        expect(payload.input.prompt).toContain('Image 1 is the STYLE SOURCE');
        expect(payload.input.prompt).toContain('OUTPUT SUBJECT:');
    });

    test('Veo Builder: Dynamic Numbering N+1', async () => {
        const builder = new PayloadBuilderVeo();
        // 2 Images, Index Undefined -> Assume Last (2) is Style
        const ctx: GenerationContext = {
            input: { ...baseInput, styleName: 'TestStyle' },
            publicImageUrls: ['http://img1.jpg', 'http://img2.jpg']
        };

        const payload = builder.build(ctx);
        expect(payload.prompt).toContain('Image 2 defines the STYLE');
        expect(payload.prompt).toContain('SUBJECT IMAGES');
    });

    test('Nano Builder: Dynamic Numbering Parity', async () => {
        const builder = new PayloadBuilderNano();
        // 3 Images, Index 2 -> Image 3 is Style, Images 1-2 are Content
        const ctx: GenerationContext = {
            input: { ...baseInput, styleImageIndex: 2 },
            publicImageUrls: ['http://c1.jpg', 'http://c2.jpg', 'http://style.jpg']
        };

        const payload = builder.build(ctx);
        expect(payload.input.prompt).toContain('Image 3 defines the STYLE');
        expect(payload.input.prompt).toContain('Images 1-2');
    });

});
