import fetch from 'node-fetch';

async function verify() {
    const targetUrl = 'https://tempfile.aiquickdraw.com/v/e291e92d6e22dd77a0a3d2a11c197cd3_1765851039.mp4';
    const proxyUrl = `http://localhost:3000/api/proxy-download?url=${encodeURIComponent(targetUrl)}`;

    console.log(`Testing Proxy: ${proxyUrl}`);

    try {
        const res = await fetch(proxyUrl);
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        if (!res.ok) {
            console.log('Body:', text.substring(0, 200));
        } else {
            console.log('Content-Type:', res.headers.get('content-type'));
            console.log('Content-Length:', res.headers.get('content-length')); // Proxy logic creates buffer, so length might be missing if not set explicitly, but let's see. logic sets headers from buffer? No, logic sets buffer body. NextResponse calculates length?
        }
    } catch (err) {
        console.error('Fetch failed:', err);
    }
}

verify();
