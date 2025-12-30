import { db } from '@/lib/db';
import { createFluxTask, createVeoTask, FluxPayload, VeoPayload, uploadFileBase64 } from '@/lib/kie';
import { resolveClipImages } from '@/lib/shared-resolvers';
import { getLibraryItems } from '@/lib/library';
import fs from 'fs';
import path from 'path';
import { BuilderFactory } from '@/lib/builders/BuilderFactory';

// Input payload for a generation task
export interface GenerateTaskInput {
    clipId: string; // DB ID string
    seriesId: string;
    model?: string;
    aspectRatio?: string;

    // Provided overrides
    prompt?: string; // If we build prompt here, or pass it in? 
    // Usually prompt is built from clip fields.

    // Or we accept the full Clip object?
    clip: any; // Using 'any' for now to match flexible API usage, strictly typed in implementation

    // Diagnosis
    dryRun?: boolean;
}

export class GenerateManager {
    // Singleton or Static? Class is fine.

    constructor() {
        console.log('[GenerateManager] Initialized');
    }

    /**
     * Main entry point to start a generation task.
     */
    async startTask(input: GenerateTaskInput): Promise<{ taskId?: string, resultUrl?: string, debugPayload?: any }> {
        console.log(`[GenerateManager] >>> Starting Task <<<`);
        console.log(`[GenerateManager] Input: Clip=${input.clipId}, Series=${input.seriesId}, Prompt='${input.prompt || input.clip.prompt?.substring(0, 50)}...'`);
        console.log(`[GenerateManager] Full Input Payload:`, JSON.stringify(input, null, 2));

        // 1. Resolve Library References (Server-Side)
        const libraryItems = await db.studioItem.findMany({
            where: { seriesId: input.seriesId }
        });

        const seriesLib: Record<string, string> = {};
        libraryItems.forEach(item => {
            if (item.name && item.refImageUrl) {
                seriesLib[item.name.toLowerCase()] = item.refImageUrl;
            }
        });

        const findLib = (name: string) => seriesLib[name.toLowerCase()];

        // Resolve!
        const { fullRefs, characterImageUrls, locationImageUrls } = resolveClipImages(input.clip, findLib);
        console.log(`[GenerateManager] Resolved References:`, { fullRefs, charCount: characterImageUrls.length, locCount: locationImageUrls.length });

        // 2. Select Strategy & Execute

        // --- RESOLVE MODEL HIERARCHY ---
        // DESIGN RULE: Clip.model is LEGACY. 
        // Source of Truth is the Episode (Menu/Toolbar) or the explicit input from that menu.

        let effectiveModel = input.model; // 1. From UI Toolbar (ideal)
        console.log(`[GenerateManager Debug] Input Model: '${input.model}'`);

        if (!effectiveModel && input.clip.episodeId) {
            // 2. From DB Episode (Backstop)
            try {
                const ep = await db.episode.findUnique({
                    where: { id: input.clip.episodeId },
                    select: { model: true }
                });
                if (ep?.model) {
                    console.log(`[GenerateManager] Using Episode Model: '${ep.model}'`);
                    effectiveModel = ep.model;
                }
            } catch (err) {
                console.warn('[GenerateManager] Failed to fetch episode model:', err);
            }
        }

        // Final Fallback & Normalization
        let rawModel = effectiveModel || 'veo'; // Downgrade default to 'veo' (veo-2 might be invalid)

        // NORMALIZE LEGACY MODELS
        if (rawModel === 'flux' || rawModel === 'flux-pro') rawModel = 'flux-2/flex-image-to-image';

        // RESTORE LEGACY VEO ID
        // 'veo-2' and 'veo' and 'veo-fast' all failed (422). 
        // The old code forced 'veo3_fast', which reportedly worked.
        if (rawModel.startsWith('veo')) rawModel = 'veo3_fast';

        const model = rawModel;

        const isVideo = model.startsWith('veo');

        // Update DB status to 'Generating' (Skip if Dry Run)
        if (!input.dryRun) {
            await this.updateStatus(input.clipId, 'Generating');
        }

        try {
            let result;

            // --- UNIFIED BUILDER PATTERN ---
            // Works for both Veo (Video) and Flux (Image)
            const builder = BuilderFactory.getBuilder(model);
            if (!builder) throw new Error(`Model not supported: ${model}`);

            let publicImageUrls: string[] = [];
            if (fullRefs) {
                const rawUrls = fullRefs.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);

                // Robustness: Use allSettled to ensure one bad link doesn't kill usage of others
                const results = await Promise.allSettled(rawUrls.map(url => this.ensurePublicUrl(url)));

                publicImageUrls = results
                    .filter(r => r.status === 'fulfilled')
                    .map(r => (r as PromiseFulfilledResult<string>).value);

                // Log failures for visibility
                results.forEach((r, i) => {
                    if (r.status === 'rejected') {
                        console.warn(`[GenerateManager] Failed to resolve ref image '${rawUrls[i]}':`, r.reason);
                    }
                });
            }

            // --- FLUX T2I PATCH ---
            // 'flux-2/flex-image-to-image' requires input_urls to be non-empty.
            // If we have no images (Text-to-Image), we must inject a dummy placeholder.
            if (!isVideo && publicImageUrls.length === 0) {
                console.log('[GenerateManager] No input images found for Flux. Injecting dummy placeholder for T2I.');
                try {
                    const dummyPath = '/api/media/defaults/empty.png';
                    // We need to resolve this local path to a public URL via upload
                    // ensurePublicUrl handles /api/ paths nicely?
                    // Wait, ensurePublicUrl handles /api/media/uploads/ or /api/images/
                    // I need to make sure ensurePublicUrl can handle this path or just manually do it.

                    // Let's modify ensurePublicUrl logic slightly or just duplicate the logic here for safety
                    const filePath = path.join(process.cwd(), 'storage/media/defaults/empty.png');
                    if (fs.existsSync(filePath)) {
                        const fileBuffer = await fs.promises.readFile(filePath);
                        const base64 = fileBuffer.toString('base64');
                        const uploadRes = await uploadFileBase64(base64, "empty.png");
                        const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;
                        if (publicUrl) {
                            publicImageUrls.push(publicUrl);
                            console.log('[GenerateManager] Dummy injected:', publicUrl);
                        }
                    } else {
                        console.error('[GenerateManager] CRITICAL: Dummy image missing at', filePath);
                    }
                } catch (e) {
                    console.error('[GenerateManager] Failed to inject dummy image:', e);
                }
            }

            const payload = builder.build({ input, publicImageUrls });

            if (input.dryRun) {
                // @ts-ignore
                return { taskId: 'DRY-RUN', debugPayload: payload };
            }

            if (isVideo) {
                console.log(`[GenerateManager] Sending to Kie (Veo)...`, JSON.stringify(payload, null, 2));
                result = await createVeoTask(payload as VeoPayload);
            } else {
                console.log(`[GenerateManager] Sending to Kie (Flux)...`, JSON.stringify(payload, null, 2));
                result = await createFluxTask(payload as FluxPayload);
            }


            // 3. Handle Response
            // Result is { taskId: string, rawData: any }
            // If rawData has 'output' or 'resultUrl', use it.
            // Flux usually returns output array if sync.
            const output = result.rawData?.output;
            const directUrl = (Array.isArray(output) && output.length > 0) ? output[0] : (typeof output === 'string' ? output : null);

            console.log('[GenerateManager] Raw Result:', JSON.stringify(result, null, 2));

            if (result.taskId) {
                if (directUrl) {
                    await this.updateResult(input.clipId, directUrl, 'Done');
                    return { resultUrl: directUrl };
                } else {
                    // Async or waiting - Save Task ID but KEEP previous resultUrl
                    await this.updateTaskId(input.clipId, result.taskId, 'Generating');
                    return { taskId: result.taskId };
                }
            } else if (directUrl) {
                await this.updateResult(input.clipId, directUrl, 'Done');
                return { resultUrl: directUrl };
            }

            throw new Error(`Kie failed to return TaskId or URL. Raw: ${JSON.stringify(result)}`);

        } catch (error: any) {
            console.error(`[GenerateManager] Fatal Error:`, error);

            // Robust Error Parsing
            let statusMsg = 'Error';
            const msg = error.message || String(error);

            if (msg.includes('500')) statusMsg = 'Error 500';
            else if (msg.includes('400')) statusMsg = 'Error 400';
            else if (msg.includes('Upload Failed')) statusMsg = 'Upload Err';
            else if (msg.includes('File Not Found')) statusMsg = 'File 404';
            else if (msg.includes('fetch')) statusMsg = 'Net Err';

            // Ensure we update status even if it fails
            try {
                await this.updateStatus(input.clipId, statusMsg);
            } catch (dbErr) {
                console.error('[GenerateManager] Failed to update error status in DB:', dbErr);
            }

            throw error;
        }
    }

    // Helper: Build basic prompt if not provided
    private buildPrompt(clip: any, model?: string): string {
        return `Cinematic shot. ${clip.action || ''} ${clip.dialog ? `Character says: "${clip.dialog}"` : ''}. ${clip.style || ''}. ${clip.camera || ''}. High quality.`;
    }

    private async updateStatus(clipId: string, status: string) {
        await db.clip.update({
            where: { id: parseInt(clipId) },
            data: { status }
        });
    }

    private async updateTaskId(clipId: string, taskId: string, status: string) {
        // Save Task ID separately, preserving previous resultUrl
        await db.clip.update({
            where: { id: parseInt(clipId) },
            data: { taskId, status }
        });
    }

    private async updateResult(clipId: string, result: string, status: string) {
        await db.clip.update({
            where: { id: parseInt(clipId) },
            data: { resultUrl: result, status } // Now we update resultUrl only on success
        });
    }

    /**
     * Resolves local URLs (starting with /api/) to public URLs by uploading to Kie.
     */
    private async ensurePublicUrl(url: string): Promise<string> {
        if (url.startsWith('http')) return url;

        // Detect Local Path
        let filePath = '';
        if (url.startsWith('/api/media/uploads/')) {
            const filename = url.replace('/api/media/uploads/', '');
            filePath = path.join(process.cwd(), 'storage/media/uploads', filename);
        } else if (url.startsWith('/api/images/')) {
            const filename = url.replace('/api/images/', '');
            filePath = path.join(process.cwd(), 'storage/media/uploads', filename);
        }

        if (filePath && fs.existsSync(filePath)) {
            try {
                console.log(`[GenerateManager] Uploading local file to Kie: ${filePath}`);
                const fileBuffer = await fs.promises.readFile(filePath);
                const base64 = fileBuffer.toString('base64');
                const filename = path.basename(filePath);

                const uploadRes = await uploadFileBase64(base64, filename);
                console.log(`[GenerateManager Debug] Upload Res:`, JSON.stringify(uploadRes));

                // Handle diverse response shapes (Flat, Nested URL, Nested DownloadUrl)
                const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;

                if (publicUrl) {
                    console.log(`[GenerateManager] Uploaded! Public URL: ${publicUrl}`);
                    return publicUrl;
                }

                throw new Error('Upload response missing URL/downloadUrl'); // Fail loudly!
            } catch (err) {
                console.error(`[GenerateManager] Failed to upload local file ${filePath}:`, err);
                throw new Error(`Upload Failed: ${path.basename(filePath)}`);
            }
        } else if (url.startsWith('/api')) {
            console.warn(`[GenerateManager] Local file not found for URL: ${url}`);
            throw new Error(`File Not Found: ${path.basename(url)}`);
        }

        return url;
    }
}
