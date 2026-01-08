import { db } from '@/lib/db';
import { createFluxTask, createVeoTask, createNanoTask, FluxPayload, VeoPayload, NanoPayload, uploadFileBase64 } from '@/lib/kie';
import { resolveClipImages } from '@/lib/shared-resolvers';
import { getLibraryItems } from '@/lib/library';
import fs from 'fs';
import path from 'path';
import { BuilderFactory } from '@/lib/builders/BuilderFactory';
import { Clip } from '@prisma/client';

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
    clip: Clip & { prompt?: string, duration?: string, explicitRefUrls?: string }; // Extended for legacy/UI fields

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
        console.log(`[GenerateManager] Input: Clip=${input.clipId}, Series=${input.seriesId}, Prompt='${input.prompt || input.clip.prompt?.substring(0, 50)}...'`);
        // console.log(`[GenerateManager] Full Input Payload:`, JSON.stringify(input, null, 2));

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
        const { fullRefs, characterImageUrls, locationImageUrls } = resolveClipImages(input.clip, findLib, resolveMode);
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

            if (!styleItem && styleName) {
                console.warn(`[GenerateManager] Style '${styleName}' not found in library. Ignoring to prevent phantom text styles.`);
            }

            input.styleName = styleItem ? styleName : "";
            // FIX: Do NOT fallback to styleName if item is missing. This prevents "Ghost Styles" (e.g. renamed/deleted assets) from persisting as text prompts.
            input.styleDescription = styleItem?.description || "";
            input.styleNegatives = styleItem?.negatives || "";

            // -- Character / Subject --
            const charNames = input.clip.character ? input.clip.character.split(',') : [];
            const charItems = charNames.map((n: string) => findItem(n.trim(), 'LIB_CHARACTER')).filter((i: any) => i);

            const locName = input.clip.location || "";
            const locItem = findItem(locName, 'LIB_LOCATION');

            const camName = input.clip.camera || "";
            const camItem = findItem(camName, 'LIB_CAMERA');

            // Construct Composite Subject Description (Strict Order: Loc -> Char -> Action -> Dialog -> Cam)
            const parts = [];

            // 1. Location
            if (locItem?.description) {
                // USER REQUEST: Insert "LOCATION: [Name]:" label
                const nameLabel = locName ? `LOCATION: ${locName}: ` : 'LOCATION: ';
                parts.push(`${nameLabel}At ${locItem.description}`);
            }
            else if (locName) parts.push(`LOCATION: ${locName}: At ${locName}`);

            // 2. Characters
            if (charItems.length > 0) parts.push(charItems.map((i: any) => i.description || i.name).join(' and '));
            else if (input.clip.character) parts.push(input.clip.character);

            // 3. Action
            if (input.clip.action) {
                parts.push(`ACTION: ${input.clip.action}`);
            }

            // 4. Dialog (New)
            if (input.clip.dialog) parts.push(`Character says: "${input.clip.dialog}"`);

            // 5. Camera
            if (camItem?.description) parts.push(`${camItem.description} shot.`);
            else if (camName) parts.push(`${camName} shot.`);

            input.subjectDescription = parts.join('. '); // Use period separator for clarity

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
            const builder = BuilderFactory.getBuilder(model);
            if (!builder) throw new Error(`Model not supported: ${model}`);

            // 1. Resolve Granular Images to Public URLs
            const ensureList = async (urls: string[]) => {
                const results = await Promise.allSettled(urls.map(u => this.ensurePublicUrl(u)));
                return results.map(r => {
                    if (r.status === 'fulfilled') return (r as PromiseFulfilledResult<string>).value;
                    console.error('[GenerateManager] Image Upload Failed, skipping slot:', r.reason);
                    return ""; // Return empty string to preserve index alignment (Robustness)
                });
            };

            // Style Image
            let publicStyleImage: string | null = null;
            if (styleItem?.refImageUrl) {
                const [res] = await ensureList([styleItem.refImageUrl]);
                publicStyleImage = res || null;
            }

            // Character Images
            const rawCharUrls = characterImageUrls; // From shared-resolver
            const publicCharImages = await ensureList(rawCharUrls);

            // Location Images
            const rawLocUrls = locationImageUrls; // From shared-resolver
            const publicLocImages = await ensureList(rawLocUrls);

            // Explicit Images (Clip Refs) - Note: shared-resolver mixing explicit+lib is tricky.
            // resolveClipImages returns 'explicitRefs' as comma-joined string.
            const rawExplicit = (input.clip.explicitRefUrls || input.clip.refImageUrls || "").split(',').map((s: string) => s.trim()).filter(Boolean);
            const publicExplicitImages = await ensureList(rawExplicit);

            // Legacy Fallback (keeping fullRefs for safety if needed, but PromptConstructor should use granular)
            let publicImageUrls: string[] = [];
            if (fullRefs) {
                const rawUrls = fullRefs.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
                publicImageUrls = await ensureList(rawUrls);
            }

            // --- FLUX T2I PATCH ---
            // 'flux-2/flex-image-to-image' requires input_urls to be non-empty.
            if (!isVideo && publicImageUrls.length === 0 && publicExplicitImages.length === 0 && publicCharImages.length === 0 && publicLocImages.length === 0 && !publicStyleImage) {
                console.log('[GenerateManager] No input images found for Flux. Injecting dummy placeholder.');
                try {
                    const filePath = path.join(process.cwd(), 'storage/media/defaults/empty.png');
                    if (fs.existsSync(filePath)) {
                        const fileBuffer = await fs.promises.readFile(filePath);
                        const base64 = fileBuffer.toString('base64');
                        const uploadRes = await uploadFileBase64(base64, "empty.png");
                        const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;
                        if (publicUrl) {
                            publicImageUrls.push(publicUrl); // Legacy
                            // Should we push to explicit? No, keep it separate or let Builder handle fallback?
                            // Let's rely on legacy publicImageUrls for the failsafe.
                        }
                    }
                } catch (e) {
                    console.error('[GenerateManager] Failed to inject dummy image:', e);
                }
            }

            let payload;
            try {
                payload = builder.build({
                    input,
                    publicImageUrls,
                    characterImages: publicCharImages,
                    locationImages: publicLocImages,
                    explicitImages: publicExplicitImages,
                    styleImage: publicStyleImage,

                    // Rich Asset Data
                    locationAsset: locItem ? { name: locName, description: locItem.description || "", negatives: locItem.negatives || "" } : undefined,
                    characterAssets: charItems.map((c: any) => ({
                        name: c.name,
                        description: c.description || "",
                        negatives: c.negatives || "",
                        refImageUrl: c.refImageUrl || undefined // Pass DB URL for linkage
                    })),
                    styleAsset: styleItem ? { description: styleItem.description || "", negatives: styleItem.negatives || "" } : undefined,
                    cameraAsset: camItem ? { description: camItem.description || "", negatives: camItem.negatives || "" } : undefined
                });
            } catch (builderError: any) {
                console.error('[GenerateManager] Builder Failed:', builderError);
                throw new Error(`Builder Error: ${builderError.message}`);
            }



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
            // DEBUG: Log full structure to identify missing code
            try {
                const debugObj = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                console.error('[GenerateManager] FULL ERROR STRUCTURE:', JSON.stringify(debugObj, null, 2));
            } catch (e) { console.error('Error logging error', e); }

            // Enhanced Error Reporting
            if (error.response) {
                console.error('[GenerateManager] API Error Response Status:', error.response.status);
                // console.error('[GenerateManager] API Error Data:', JSON.stringify(error.response.data, null, 2));
            }

            // Robust Error Parsing
            let statusMsg = 'Error';
            const msg = (error.message || String(error)).toLowerCase();

            // Attempt to capture specific status code if available
            if (error.response?.status) statusMsg = `Error ${error.response.status}`;
            else if (error.status) statusMsg = `Error ${error.status}`;
            else if (error.code) statusMsg = `Error ${error.code}`; // Moved up for priority

            // Semantic overrides
            else if (msg.includes('500')) statusMsg = 'Error 500';
            else if (msg.includes('400')) statusMsg = 'Error 400';
            else if (msg.includes('422')) statusMsg = 'Error 422'; // Validation
            else if (msg.includes('upload failed')) statusMsg = 'Upload Err';
            else if (msg.includes('file not found')) statusMsg = 'File 404';
            else if (msg.includes('fetch') || msg.includes('network')) statusMsg = 'Net Err';

            // Final Fallback: Use the Error Message itself (Truncated) if strictly "Error"
            if (statusMsg === 'Error') {
                // Clean prompt prefix if present? No, just take first 15 chars
                // e.g. "Error: Unprocessable" -> "Error Unprocess"
                const cleanMsg = (error.message || "Unknown").replace(/^Error:?\s*/i, '');
                // Take first 12 chars to fit UI (e.g. "Bad Request")
                statusMsg = `Error ${cleanMsg.substring(0, 12)}`;
            }

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
