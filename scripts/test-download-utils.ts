
import assert from 'assert';
import { getClipFilename, getNextStatus } from '../src/lib/download-utils';

console.log('--- Starting Unit Tests for download-utils ---');

// Mock Clip Interface
const mockClip: any = {
    title: 'Test Clip',
    scene: '1.2',
    status: 'Saved',
    resultUrl: 'http://example.com/video.mp4?token=123'
};

// 1. Test getNextStatus
try {
    assert.strictEqual(getNextStatus(''), 'Saved');
    assert.strictEqual(getNextStatus('Generating'), 'Saved');
    assert.strictEqual(getNextStatus('Saved'), 'Saved [2]');
    assert.strictEqual(getNextStatus('Saved [2]'), 'Saved [3]');
    assert.strictEqual(getNextStatus('Saved [99]'), 'Saved [100]');
    console.log('✅ getNextStatus passed');
} catch (e) {
    console.error('❌ getNextStatus failed', e);
    process.exit(1);
}

// 2. Test getClipFilename
try {
    const f1 = getClipFilename(mockClip);
    // Scene 1.2 Title Test Clip v2 (since status is Saved)
    assert.strictEqual(f1, '1.2 Test Clip 02.mp4');

    const f2 = getClipFilename({ ...mockClip, status: 'IDLE', resultUrl: 'test.png' });
    // Scene 1.2 Title Test Clip (ver 1)
    assert.strictEqual(f2, '1.2 Test Clip.png');

    const f3 = getClipFilename({ ...mockClip, title: 'Bad/Title<>', status: 'Saved [2]' });
    // Sanitized title: BadTitle
    // Ver: 3
    assert.strictEqual(f3, '1.2 BadTitle 03.mp4');

    console.log('✅ getClipFilename passed');
} catch (e) {
    console.error('❌ getClipFilename failed', e);
    console.error('Expected format: {Scene} {Title} {Ver}.{Ext}');
    process.exit(1);
}

// 3. Test Regex Logic (Simulated from downloadFile/API)
try {
    const sanitize = (fn: string) => fn.replace(/[^a-zA-Z0-9._-]/g, '_');

    assert.strictEqual(sanitize('normal.mp4'), 'normal.mp4');
    assert.strictEqual(sanitize('../../passwd'), '.._.._passwd');
    assert.strictEqual(sanitize('cool video!.mp4'), 'cool_video_.mp4');
    assert.strictEqual(sanitize('header\r\ninjection'), 'header__injection');

    console.log('✅ Sanitization Regex passed');
} catch (e) {
    console.error('❌ Sanitization Regex failed', e);
    process.exit(1);
}

console.log('--- All Unit Tests Passed ---');
