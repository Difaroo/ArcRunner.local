import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

console.log('--- ENV DEBUG START ---');

const files = ['.env.local', '.env'];
const cwd = process.cwd();

files.forEach(file => {
    const p = path.resolve(cwd, file);
    if (fs.existsSync(p)) {
        console.log(`Loading ${file}...`);
        const res = dotenv.config({ path: p });
        if (res.error) {
            console.log(`  ERROR: ${res.error.message}`);
        } else {
            const keys = Object.keys(res.parsed || {});
            console.log(`  Loaded ${keys.length} keys.`);
            if (keys.includes('GOOGLE_SERVICE_ACCOUNT_EMAIL')) console.log('  -> Found Google Email!');
        }
    } else {
        console.log(`Skipping ${file} (Not found)`);
    }
});

console.log('--- FINAL PROCESS.ENV ---');
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'FOUND' : 'MISSING');
console.log('--- DEBUG END ---');
