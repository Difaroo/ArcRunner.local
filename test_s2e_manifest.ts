import { resolveManifest } from './src/lib/structural-manifest';

const mockExplicitRefs = [
    {
        id: 'ref-db-123',
        url: 'http://example.com/start.png',
        type: 'IMAGE',
        category: 'REF',
        refImageSort: 2 // Highest sort = End Frame (or Start Frame based on logic)
    },
    {
        id: 'ref-db-456',
        url: 'http://example.com/end.png',
        type: 'IMAGE',
        category: 'REF',
        refImageSort: 1 // Lower sort
    }
] as any[];

const result = resolveManifest(
    { id: 'clip-1', model: 'veo-s2e' } as any,
    'veo-s2e',
    {
        styleImage: 'http://example.com/style.png',
        locationImages: ['http://example.com/loc.png'],
        characterImages: ['http://example.com/char.png']
    },
    mockExplicitRefs
);

console.log(JSON.stringify(result, null, 2));
