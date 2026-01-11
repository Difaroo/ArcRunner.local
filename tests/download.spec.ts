
import { test, expect } from '@playwright/test';

test.describe('Download API Architecture', () => {

    // 1. Verify Proxy Download Headers (Happy Path)
    test.skip('Proxy should return attachment headers for valid file', async ({ request }) => {
        // Use external stable URL
        const targetUrl = 'https://www.google.com/favicon.ico';
        const filename = 'test-download.ico';

        const response = await request.get(`/api/proxy-download?url=${encodeURIComponent(targetUrl)}&filename=${filename}`);

        if (!response.ok()) {
            console.log('Proxy Failed Status:', response.status());
            console.log('Proxy Failed Body:', await response.text());
        }
        expect(response.ok()).toBeTruthy();

        const headers = response.headers();
        expect(headers['content-disposition']).toContain('attachment');
        expect(headers['content-disposition']).toContain('filename="test-download.ico"');
    });

    // 2. Verify Sanitization (Security)
    test('Proxy should sanitize malicious filenames', async ({ request }) => {
        const targetUrl = 'https://www.google.com/favicon.ico';
        // Attempt path traversal
        const maliciousFilename = '../../etc/passwd.txt';

        const response = await request.get(`/api/proxy-download?url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(maliciousFilename)}`);
        if (!response.ok()) {
            console.log('Sanitization Test Failed Status:', response.status());
            console.log('Sanitization Test Failed Body:', await response.text());
        }
        expect(response.ok()).toBeTruthy();

        const headers = response.headers();
        // Expect sanitized version: .._.._etc_passwd.txt or similar depending on regex
        // Our regex is /[^a-zA-Z0-9._-]/g -> '_'
        // AND we use path.basename() now, so directory traversal is stripped.
        // ../../etc/passwd.txt -> passwd.txt
        expect(headers['content-disposition']).not.toContain('/'); // No slashes
        expect(headers['content-disposition']).toContain('passwd.txt');
    });

    // 3. Verify Error Handling
    test('Proxy should return 400 if url missing', async ({ request }) => {
        const response = await request.get('/api/proxy-download');
        expect(response.status()).toBe(400);
    });

});
