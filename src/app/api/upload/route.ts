import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/drive';
import { Readable } from 'stream';

// Target Drive Folder ID (Provided by User)
const DRIVE_ROOT_FOLDER_ID = '1rDr_GPXJuZfFG_fpAnfZGFyYzrXWtmZw';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const episode = formData.get('episode') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Authenticate Google Drive
        const drive = await getDriveClient();

        let targetFolderId = DRIVE_ROOT_FOLDER_ID;

        // 1. Handle Episode Subfolder
        if (episode) {
            const folderName = `Episode ${episode}`;

            // Search for existing folder
            const q = `'${DRIVE_ROOT_FOLDER_ID}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const searchRes = await drive.files.list({
                q,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            if (searchRes.data.files && searchRes.data.files.length > 0) {
                targetFolderId = searchRes.data.files[0].id!;
            } else {
                // Create folder
                const folderMetadata = {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [DRIVE_ROOT_FOLDER_ID],
                };
                const folderRes = await drive.files.create({
                    requestBody: folderMetadata,
                    fields: 'id',
                });
                targetFolderId = folderRes.data.id!;
            }
        }

        // 2. Upload File
        const buffer = Buffer.from(await file.arrayBuffer());
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        const fileMetadata = {
            name: file.name,
            parents: [targetFolderId],
        };

        const media = {
            mimeType: file.type,
            body: stream,
        };

        const uploadRes = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
        });

        const fileId = uploadRes.data.id!;
        const webViewLink = uploadRes.data.webViewLink;

        // 3. Set Public Permission (Reader/Anyone)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // 4. Return Public Link
        // We return a direct ID link for consistency or the view link.
        // Convert to direct download link logic in frontend handles both.
        // But let's return a construct that we know works well with the sheet.
        // webViewLink is good for users. Our backend converts it.
        return NextResponse.json({ url: webViewLink });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
