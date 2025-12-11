
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Target Drive Folder ID (Provided by User)
const DRIVE_ROOT_FOLDER_ID = '1rDr_GPXJuZfFG_fpAnfZGFyYzrXWtmZw';

async function main() {
    console.log('--- Debugging Google Drive Upload ---');
    console.log(`Target Folder ID: ${DRIVE_ROOT_FOLDER_ID}`);
    console.log(`Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // 1. Check if we can LIST the folder
        console.log('\nStep 1: Checking access to folder...');
        try {
            const res = await drive.files.get({
                fileId: DRIVE_ROOT_FOLDER_ID,
                fields: 'id, name, capabilities'
            });
            console.log('✅ Access Confirmed!');
            console.log(`Folder Name: "${res.data.name}"`);
            console.log(`Capabilities: Can Add Children? ${res.data.capabilities.canAddChildren}`);

            if (!res.data.capabilities.canAddChildren) {
                console.error('❌ ERROR: Service account has READ access but cannot WRITE (Add Children). Check "Editor" permission.');
                return;
            }

        } catch (e) {
            console.error('❌ ERROR Accessing Folder:', e.message);
            if (e.code === 404) console.log('   (404 likely means the service account cannot see the folder at all)');
            return;
        }

        // 2. Try Creating a Test Folder
        console.log('\nStep 2: Attempting to create "Debug_Test_Folder"...');
        const folderMetadata = {
            name: 'Debug_Test_Folder',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [DRIVE_ROOT_FOLDER_ID],
        };
        const folderRes = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });
        console.log(`✅ Folder Created! ID: ${folderRes.data.id}`);

        // 3. Try Uploading a Test File
        console.log('\nStep 3: Attempting to upload "test.txt"...');
        const fileMetadata = {
            name: 'test.txt',
            parents: [folderRes.data.id],
        };
        const media = {
            mimeType: 'text/plain',
            body: 'Hello World',
        };
        const fileRes = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });
        console.log(`✅ File Uploaded! ID: ${fileRes.data.id}`);
        console.log(`Link: ${fileRes.data.webViewLink}`);

        // Cleanup
        console.log('Cleaning up test folder...');
        await drive.files.delete({ fileId: folderRes.data.id });
        console.log('Cleanup Done.');

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error);
    }
}

main();
