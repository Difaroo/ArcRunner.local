import { resolveClipImages, ClipReferenceSource } from '@/lib/shared-resolvers';
import assert from 'assert';

console.log('Running Unit Tests for shared-resolvers (Media-only mode)...');

// Mock FindLib
const mockLibrary = {
    'hero': 'http://lib/hero.jpg',
    'villain': 'http://lib/villain.jpg',
    'home': 'http://lib/home.jpg'
};
const findLib = (name: string) => (mockLibrary as any)[name.toLowerCase()] || undefined;

// Test 1: mediaReferences provide explicit refs
{
    const clip: ClipReferenceSource = {
        mediaReferences: [
            { url: 'http://explicit.com/1.jpg', refImageSort: 1 }
        ]
    };
    const result = resolveClipImages(clip, findLib);
    assert.strictEqual(result.explicitRefs, 'http://explicit.com/1.jpg', 'Explicit refs should be preserved');
    assert.ok(result.fullRefs.includes('http://explicit.com/1.jpg'), 'Full refs should include explicit');
    console.log('Test 1 Passed: Media References as Explicit');
}

// Test 2: Character/Location Lookup
{
    const clip: ClipReferenceSource = {
        character: 'Hero',
        location: 'Home',
        mediaReferences: []
    };
    const result = resolveClipImages(clip, findLib);
    assert.ok(result.fullRefs.includes(mockLibrary['hero']), 'Should resolve Hero');
    assert.ok(result.fullRefs.includes(mockLibrary['home']), 'Should resolve Home');
    assert.ok(result.characterImageUrls.includes(mockLibrary['hero']), 'Character specific list');
    console.log('Test 2 Passed: Library Lookup');
}

// Test 3: Multiple Characters
{
    const clip: ClipReferenceSource = {
        character: 'Hero, Villain',
        mediaReferences: []
    };
    const result = resolveClipImages(clip, findLib);
    assert.ok(result.fullRefs.includes(mockLibrary['hero']), 'Should resolve Hero');
    assert.ok(result.fullRefs.includes(mockLibrary['villain']), 'Should resolve Villain');
    console.log('Test 3 Passed: Multiple Characters');
}

// Test 4: Mixing Media References and Library
{
    const clip: ClipReferenceSource = {
        character: 'Hero',
        mediaReferences: [
            { url: 'http://manual.jpg', refImageSort: 0 }
        ]
    };
    const result = resolveClipImages(clip, findLib);
    assert.ok(result.fullRefs.includes('http://manual.jpg'));
    assert.ok(result.fullRefs.includes(mockLibrary['hero']));
    console.log('Test 4 Passed: Mixed Sources');
}

// Test 5: Empty mediaReferences (zero refs edge case)
{
    const clip: ClipReferenceSource = {
        mediaReferences: []
    };
    const result = resolveClipImages(clip, findLib);
    assert.strictEqual(result.explicitRefs, '', 'No explicit refs');
    assert.strictEqual(result.fullRefs, '', 'No full refs');
    assert.deepStrictEqual(result.characterImageUrls, [], 'No character images');
    assert.deepStrictEqual(result.locationImageUrls, [], 'No location images');
    console.log('Test 5 Passed: Zero Refs Edge Case');
}

// Test 6: Undefined mediaReferences (legacy clip fallback)
{
    const clip: ClipReferenceSource = {
        character: 'Hero'
    };
    const result = resolveClipImages(clip, findLib);
    assert.ok(result.fullRefs.includes(mockLibrary['hero']), 'Should still resolve library even without mediaReferences');
    assert.strictEqual(result.explicitRefs, '', 'No explicit refs when mediaReferences undefined');
    console.log('Test 6 Passed: Undefined mediaReferences Fallback');
}

console.log('All Resolver Tests Passed!');
