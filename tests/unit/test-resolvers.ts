import { resolveClipImages, ClipReferenceSource } from '@/lib/shared-resolvers';
import assert from 'assert';

console.log('Running Unit Tests for shared-resolvers...');

// Mock FindLib
const mockLibrary = {
    'hero': 'http://lib/hero.jpg',
    'villain': 'http://lib/villain.jpg',
    'home': 'http://lib/home.jpg'
};
const findLib = (name: string) => mockLibrary[name.toLowerCase()] || undefined;

// Test 1: explicitRefUrls takes precedence
{
    const clip: ClipReferenceSource = {
        explicitRefUrls: 'http://explicit.com/1.jpg',
        refImageUrls: 'http://old.com/1.jpg'
    };
    const result = resolveClipImages(clip, findLib);
    assert.strictEqual(result.explicitRefs, 'http://explicit.com/1.jpg', 'Explicit refs should be preserved');
    assert.ok(result.fullRefs.includes('http://explicit.com/1.jpg'), 'Full refs should include explicit');
    console.log('Test 1 Passed: Explicit Precedence');
}

// Test 2: Character/Location Lookup
{
    const clip: ClipReferenceSource = {
        character: 'Hero',
        location: 'Home',
        explicitRefUrls: ''
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
        explicitRefUrls: ''
    };
    const result = resolveClipImages(clip, findLib);
    assert.ok(result.fullRefs.includes(mockLibrary['hero']), 'Should resolve Hero');
    assert.ok(result.fullRefs.includes(mockLibrary['villain']), 'Should resolve Villain');
    console.log('Test 3 Passed: Multiple Characters');
}

// Test 4: Mixing Explicit and Implicit
{
    const clip: ClipReferenceSource = {
        character: 'Hero',
        explicitRefUrls: 'http://manual.jpg'
    };
    const result = resolveClipImages(clip, findLib);
    // Logic: Explicit + Implicit combined in fullRefs
    assert.ok(result.fullRefs.includes('http://manual.jpg'));
    assert.ok(result.fullRefs.includes(mockLibrary['hero']));
    console.log('Test 4 Passed: Mixed Sources');
}

console.log('All Resolver Tests Passed!');
