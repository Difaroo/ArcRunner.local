import { db } from '@/lib/db';
import { createFluxTask, createVeoTask, createNanoTask, FluxPayload, VeoPayload, NanoPayload, uploadFileBase64 } from '@/lib/kie';
import { resolveClipImages } from '@/lib/shared-resolvers';
import { getLibraryItems } from '@/lib/library';
import fs from 'fs';
import path from 'path';
import { BuilderFactory } from '@/lib/builders/BuilderFactory';

// Input payload for a generation task
import { Clip } from '@/types';

// Input payload for a generation task
export interface GenerateTaskInput {
    clipId: string; // DB ID string
    seriesId: string;
    model?: string;
    aspectRatio?: string;

    // Provided overrides
    prompt?: string;

    // Strongly typed Clip (Partial to allow flexibility)
    clip: Partial<Clip> & { episodeId?: string }; // Ensure episodeId availability if needed

    // Diagnosis
    dryRun?: boolean;
    styleStrength?: number;
    refStrength?: number;
    seed?: number;

    // Structured Prompt Fields (Optional)
    subjectName?: string;
    subjectDescription?: string;
    styleName?: string;
    styleDescription?: string;
    styleImageIndex?: number;
    subjectNegatives?: string;
    styleNegatives?: string;
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
        console.log(`[GenerateManager] Input: Clip=${input.clipId}, Series=${input.seriesId}, Prompt='${input.prompt || input.clip.action?.substring(0, 50)}...'`);

        // Defensive: Check critical inputs
        if (!input.clip) throw new Error('[GenerateManager] Critical: Input clip is missing.');

        // 1. Select Strategy (Model Resolution) - Moved UP to determine Image Mode
        // DESIGN RULE: Clip.model is LEGACY. 
        // Source of Truth is the Episode (Menu/Toolbar) or the explicit input from that menu.
        let effectiveModel = input.model;
        console.log(`[GenerateManager Debug] Input Model: '${input.model}'`);

        if (!effectiveModel && input.clip.episodeId) {
            try {
                const ep = await db.episode.findUnique({
                    where: { id: input.clip.episodeId },
                    select: { model: true }
                });
                if (ep?.model) {
                    effectiveModel = ep.model;
                }
            } catch (err) {
                console.warn('[GenerateManager] Failed to fetch episode model:', err);
            }
        }

        let rawModel = effectiveModel || 'veo';
        if (rawModel === 'flux' || rawModel === 'flux-pro') rawModel = 'flux-2/flex-image-to-image';
        if (rawModel.startsWith('veo')) rawModel = 'veo3_fast';

        const model = rawModel;

        const getStrategyType = (m: string): 'flux' | 'veo' | 'nano' => {
            if (m.startsWith('veo')) return 'veo';
            if (m.startsWith('flux')) return 'flux';
            if (m.includes('nano') || m.includes('banana')) return 'nano';
            return m.includes('video') ? 'veo' : 'flux';
        };
        const apiType = getStrategyType(model);

        // 2. Resolve Library References (Server-Side)
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

        // Resolve! Nano/Veo get ALL images, others (Flux legacy?) get SINGLE
        const resolveMode = (apiType === 'nano' || apiType === 'veo') ? 'all' : 'single';
        const { fullRefs, characterImageUrls, locationImageUrls } = resolveClipImages(input.clip as any, findLib, resolveMode); // cast as any for resolver compatibility if needed
        console.log(`[GenerateManager] Resolved References (${resolveMode}):`, { fullRefs, charCount: characterImageUrls.length });

        const isVideo = apiType === 'veo';

        // Update DB status to 'Generating' (Skip if Dry Run)
        if (!input.dryRun) {
            await this.updateStatus(input.clipId, 'Generating');
        }

        try {
            let result;

            // --- RESOLVE DESCRIPTIONS & NEGATIVES (NEW) ---
            // console.log('[GenerateManager] Resolving Data. Library Count:', libraryItems.length);
            // console.log('[GenerateManager] Library Names:', libraryItems.map(i => `${i.name} (${i.type})`));

            const findItem = (name: string, type: string) => {
                if (!name) return undefined;
                const found = libraryItems.find(i => i.name?.trim().toLowerCase() === name?.trim().toLowerCase() && i.type === type);
                if (!found) {
                    // console.warn(`[GenerateManager] Failed to find '${name}' of type '${type}'`);
                } else {
                    // console.log(`[GenerateManager] Found '${name}':`, found.description?.substring(0, 20));
                }
                return found;
            }

            // -- Style --
            const styleName = input.clip.style || "";
            const styleItem = findItem(styleName, 'LIB_STYLE');
            input.styleName = styleName;
            input.styleDescription = styleItem?.description || styleName;
            input.styleNegatives = styleItem?.negatives || "";

            // -- Character / Subject --
            // Robust split: Handle undefined/null gracefully
            const charNames = input.clip.character?.split(',') || [];
            const charItems = charNames.map((n: string) => findItem(n.trim(), 'LIB_CHARACTER')).filter((i: any) => i);

            const locName = input.clip.location || "";
            const locItem = findItem(locName, 'LIB_LOCATION');

            const camName = input.clip.camera || "";
            const camItem = findItem(camName, 'LIB_CAMERA');

            // Construct Composite Subject Description
            const parts = [];
            if (charItems.length > 0) parts.push(charItems.map((i: any) => i.description || i.name).join(' and '));
            else if (input.clip.character) parts.push(input.clip.character);

            if (input.clip.action) parts.push(input.clip.action);

            if (locItem?.description) parts.push(`at ${locItem.description}`);
            else if (locName) parts.push(`at ${locName}`);

            if (camItem?.description) parts.push(`${camItem.description} shot.`);
            else if (camName) parts.push(`${camName} shot.`);

            input.subjectDescription = parts.join(' ');

            // Collect Negatives
            const subjNegs = [
                ...charItems.map((i: any) => i.negatives),
                locItem?.negatives,
                camItem?.negatives
            ].filter(Boolean).join('. ');
            input.subjectNegatives = subjNegs;

            console.log('[GenerateManager] Resolved Descriptors:', {
                style: input.styleDescription,
                styleNegs: input.styleNegatives,
                subject: input.subjectDescription,
                subjectNegs: input.subjectNegatives
            });

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
                    const filePath = path.join(process.cwd(), 'storage/media/defaults/empty.png');
                    if (fs.existsSync(filePath)) {
                        const fileBuffer = await fs.promises.readFile(filePath);
                        const base64 = fileBuffer.toString('base64');
                        const uploadRes = await uploadFileBase64(base64, "empty.png");
                        const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;
                        if (publicUrl) {
                            publicImageUrls.push(publicUrl);
                            console.log('[GenerateManager] Dummy injected:', publicUrl);
                        } else {
                            throw new Error('Upload succeeded but no URL returned for dummy.');
                        }
                    } else {
                        console.error('[GenerateManager] CRITICAL: Dummy image missing at', filePath);
                        throw new Error('Dummy placeholder missing from filesystem.');
                    }
                } catch (e) {
                    console.error('[GenerateManager] Failed to inject dummy image:', e);
                    // CRITICAL FIX: Flux fails without image URL. Fail the task.
                    throw new Error(`Flux T2I requires a placeholder image, but injection failed: ${(e as Error).message}`);
                }
            }

            const payload = builder.build({ input, publicImageUrls });

            if (input.dryRun) {
                // @ts-ignore
                return { taskId: 'DRY-RUN', debugPayload: payload };
            }

            if (apiType === 'veo') {
                console.log(`[GenerateManager] Sending to Kie (Veo)...`, JSON.stringify(payload, null, 2));
                result = await createVeoTask(payload as VeoPayload);
            } else if (apiType === 'nano') {
                console.log(`[GenerateManager] Sending to Kie (Nano)...`, JSON.stringify(payload, null, 2));
                result = await createNanoTask(payload as NanoPayload);
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

            // Enhanced Error Reporting
            if (error.response) {
                console.error('[GenerateManager] API Error Response Status:', error.response.status);
                console.error('[GenerateManager] API Error Data:', JSON.stringify(error.response.data, null, 2));
            } else if (error.cause) {
                console.error('[GenerateManager] Error Cause:', error.cause);
            }

            // Robust Error Parsing
            let statusMsg = 'Error';
            const msg = (error.message || String(error)).toLowerCase();

            if (msg.includes('500')) statusMsg = 'Error 500';
            else if (msg.includes('400')) statusMsg = 'Error 400';
            else if (msg.includes('422')) statusMsg = 'Error 422'; // Validation
            else if (msg.includes('upload failed')) statusMsg = 'Upload Err';
            else if (msg.includes('file not found')) statusMsg = 'File 404';
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
        if (url.startsWith('http')) return encodeURI(url);

        // Detect Local Path
        let filePath = '';
        if (url.startsWith('/api/media/uploads/')) {
            const filename = url.replace('/api/media/uploads/', '');
            filePath = path.join(process.cwd(), 'storage/media/uploads', filename);
        } else if (url.startsWith('/api/images/')) {
            const filename = url.replace('/api/images/', '');
            filePath = path.join(process.cwd(), 'storage/media/uploads', filename);
        } else if (url.startsWith('/media/library/')) {
            // Fix: Map /media/library to public/media/library
            const filename = url.replace('/media/library/', '');
            filePath = path.join(process.cwd(), 'public/media/library', filename);
        }

        if (filePath && fs.existsSync(filePath)) {
            try {
                // console.log(`[GenerateManager] Uploading local file to Kie: ${filePath}`);
                const fileBuffer = await fs.promises.readFile(filePath);
                const base64 = fileBuffer.toString('base64');
                const filename = path.basename(filePath);

                const uploadRes = await uploadFileBase64(base64, filename);
                // console.log(`[GenerateManager Debug] Upload Res:`, JSON.stringify(uploadRes));

                // Handle diverse response shapes (Flat, Nested URL, Nested DownloadUrl)
                const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;

                if (publicUrl) {
                    // console.log(`[GenerateManager] Uploaded! Public URL: ${publicUrl}`);
                    // Ensure URL is safely encoded (fixes issues with spaces in filenames)
                    return encodeURI(publicUrl);
                }

                throw new Error('Upload response missing URL/downloadUrl'); // Fail loudly!
            } catch (err) {
                console.error(`[GenerateManager] Failed to upload local file ${filePath}:`, err);
                throw new Error(`Upload Failed: ${path.basename(filePath)}`);
            }
        } else if (url.startsWith('/') && !url.startsWith('http')) {
            // Catch-all for other local paths to warn/error
            console.warn(`[GenerateManager] Local file not found for URL: ${url}`);
            throw new Error(`File Not Found: ${path.basename(url)}`);
        }

        return url;
    }
}
