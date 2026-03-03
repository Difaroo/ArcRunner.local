import fs from 'fs';
import path from 'path';
import { uploadFileBase64 } from '@/lib/kie';

export class AssetUploader {

    /**
     * Resolves local URLs (starting with /api/) to raw Base64 data strings for Veo.
     */
    public static async getBase64Data(rawUrl: string): Promise<string> {
        const url = rawUrl.trim();
        let filePath = '';

        if (path.isAbsolute(url) && fs.existsSync(url)) {
            filePath = url;
        } else if (url.startsWith('/api/media/uploads/')) {
            const filename = decodeURIComponent(url.replace('/api/media/uploads/', ''));
            filePath = path.join(process.cwd(), 'public/media/uploads', filename);
        } else if (url.startsWith('/api/images/')) {
            const filename = decodeURIComponent(url.replace('/api/images/', ''));
            filePath = path.join(process.cwd(), 'public/media/uploads', filename);
        } else if (url.startsWith('/media/library/')) {
            const filename = decodeURIComponent(url.replace('/media/library/', ''));
            filePath = path.join(process.cwd(), 'public/media/library', filename);
        } else if (url.startsWith('/media/clips/')) {
            const filename = decodeURIComponent(url.replace('/media/clips/', ''));
            filePath = path.join(process.cwd(), 'public/media/clips', filename);
        } else if (url.startsWith('/api/media/clips/')) {
            const filename = decodeURIComponent(url.replace('/api/media/clips/', ''));
            filePath = path.join(process.cwd(), 'public/media/clips', filename);
        } else if (url.startsWith('/media/uploads/')) {
            const filename = decodeURIComponent(url.replace('/media/uploads/', ''));
            filePath = path.join(process.cwd(), 'public/media/uploads', filename);
        }

        if (!filePath || !fs.existsSync(filePath)) {
            const basename = decodeURIComponent(path.basename(url));
            const candidateDirs = [
                path.join(process.cwd(), 'public/media/uploads'),
                path.join(process.cwd(), 'public/media/clips'),
                path.join(process.cwd(), 'public/media/library'),
                path.join(process.cwd(), 'storage/media/uploads'),
                path.join(process.cwd(), 'storage/media/generated')
            ];
            for (const dir of candidateDirs) {
                const candidate = path.join(dir, basename);
                if (fs.existsSync(candidate)) {
                    filePath = candidate;
                    break;
                }
            }
        }

        if (filePath && fs.existsSync(filePath)) {
            try {
                const fileBuffer = await fs.promises.readFile(filePath);
                return fileBuffer.toString('base64');
            } catch (err) {
                console.error(`[AssetUploader] Failed to read local file to base64 ${filePath}:`, err);
                throw new Error(`Base64 Conversion Failed: ${path.basename(filePath)}`);
            }
        } else if (url.startsWith('http')) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer).toString('base64');
            } catch (err) {
                console.error(`[AssetUploader] Failed to fetch and encode external URL ${url}:`, err);
                throw new Error(`Base64 Conversion Failed: External URL Fetch Error`);
            }
        }

        throw new Error(`File Not Found for Base64 Conversion: ${path.basename(url)}`);
    }

    /**
     * Resolves local URLs (starting with /api/) to public URLs by uploading to Kie.
     */
    public static async ensurePublicUrl(rawUrl: string): Promise<string> {
        const url = rawUrl.trim();
        if (url.startsWith('http')) return encodeURI(url);

        let filePath = '';
        if (path.isAbsolute(url) && fs.existsSync(url)) {
            filePath = url;
        }
        else if (url.startsWith('/api/media/uploads/')) {
            const filename = decodeURIComponent(url.replace('/api/media/uploads/', ''));
            filePath = path.join(process.cwd(), 'public/media/uploads', filename);
        } else if (url.startsWith('/api/images/')) {
            const filename = decodeURIComponent(url.replace('/api/images/', ''));
            filePath = path.join(process.cwd(), 'public/media/uploads', filename);
        } else if (url.startsWith('/media/library/')) {
            const filename = decodeURIComponent(url.replace('/media/library/', ''));
            filePath = path.join(process.cwd(), 'public/media/library', filename);
        } else if (url.startsWith('/media/clips/')) {
            const filename = decodeURIComponent(url.replace('/media/clips/', ''));
            filePath = path.join(process.cwd(), 'public/media/clips', filename);
        } else if (url.startsWith('/api/media/clips/')) {
            const filename = decodeURIComponent(url.replace('/api/media/clips/', ''));
            filePath = path.join(process.cwd(), 'public/media/clips', filename);
        } else if (url.startsWith('/media/uploads/')) {
            const filename = decodeURIComponent(url.replace('/media/uploads/', ''));
            filePath = path.join(process.cwd(), 'public/media/uploads', filename);
        }

        if (!filePath || !fs.existsSync(filePath)) {
            const basename = decodeURIComponent(path.basename(url));
            const candidateDirs = [
                path.join(process.cwd(), 'public/media/uploads'),
                path.join(process.cwd(), 'public/media/clips'),
                path.join(process.cwd(), 'public/media/library'),
                path.join(process.cwd(), 'storage/media/uploads'),
                path.join(process.cwd(), 'storage/media/generated')
            ];

            for (const dir of candidateDirs) {
                const candidate = path.join(dir, basename);
                if (fs.existsSync(candidate)) {
                    filePath = candidate;
                    break;
                }
            }
        }

        if (filePath && fs.existsSync(filePath)) {
            try {
                const fileBuffer = await fs.promises.readFile(filePath);
                const base64 = fileBuffer.toString('base64');
                const filename = path.basename(filePath);

                const uploadRes = await uploadFileBase64(base64, filename);
                const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;

                if (publicUrl) {
                    return encodeURI(publicUrl);
                }

                throw new Error('Upload response missing URL/downloadUrl');
            } catch (err) {
                console.error(`[AssetUploader] Failed to upload local file ${filePath}:`, err);
                throw new Error(`Upload Failed: ${path.basename(filePath)}`);
            }
        } else if (url.startsWith('/') && !url.startsWith('http')) {
            console.warn(`[AssetUploader] Local file not found for URL: ${url}`);
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR: File Not Found for URL: '${url}' (Path resolved to: '${filePath}')\n`);
            } catch (e) { }
            throw new Error(`File Not Found: ${path.basename(url)}`);
        }

        return url;
    }
}
