import { db } from '@/lib/db';
import { createFluxTask, createVeoTask, createNanoTask, createKlingTask, FluxPayload, VeoPayload, NanoPayload, KlingPayload, uploadFileBase64 } from '@/lib/kie';
import { resolveClipImages } from '@/lib/shared-resolvers';
import { getLibraryItems } from '@/lib/library';
import fs from 'fs';
import path from 'path';
import { BuilderFactory } from '@/lib/builders/BuilderFactory';
import { getModelConfig } from '@/lib/models';
import { Clip } from '@prisma/client';

// Input payload for a generation task
export interface GenerateTaskInput {
    clipId: string; // DB ID string
    seriesId: string;
    model?: string;
    aspectRatio?: string;
    sound?: boolean; // NEW: Audio Toggle
    startFrame?: boolean; // NEW: Start Frame Toggle

    // Provided overrides
    prompt?: string; // If we build prompt here, or pass it in? 
    // Usually prompt is built from clip fields.

    // Or we accept the full Clip object?
    clip: Clip & { prompt?: string, duration?: string, explicitRefUrls?: string, negativePrompt?: string | null }; // Extended for legacy/UI fields

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
        // 1. Select Strategy (Model Resolution)
        let effectiveModelId = input.model;

        if (!effectiveModelId && input.clip.episodeId) {
            try {
                const ep = await db.episode.findUnique({
                    where: { id: input.clip.episodeId },
                    select: { model: true }
                });
                if (ep?.model) {
                    effectiveModelId = ep.model;
                }
            } catch (err) {
                console.warn('[GenerateManager] Failed to fetch episode model:', err);
            }
        }

        const config = getModelConfig(effectiveModelId);

        // console.log(`[GenerateManager Debug] Input Model: '${input.model}' -> Config ID: '${config.id}' (Strategy: ${config.apiStrategy})`);
        const apiType = config.apiStrategy;

        // DEBUG: Verify Model Resolution
        try {
            const logPath = path.join(process.cwd(), 'debug_gen.log');
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] StartTask: Model='${input.model}' -> ApiStrategy='${apiType}' -> ConfigID='${config.id}'\n`);
        } catch (e) { }

        const builderId = config.builderId;
        const builder = BuilderFactory.getBuilder(builderId); // 'veo' | 'flux' | 'nano'

        // Legacy variable for BuilderFactory calls
        const model = builderId;

        // 2. Resolve Library References (Server-Side)
        // --- START FRAME LOGIC MOVED UP ----
        // We must process Start Frame filtering BEFORE resolving images so that
        // filtered-out characters do not have their images resolved.
        const isImageModel = (apiType === 'flux' || apiType === 'nano');

        if (isImageModel) {
            // Force disable dialogue
            if (input.clip.dialog) {
                console.log('[GenerateManager] Image Model detected: Suppressing Dialogue field.');
                input.clip.dialog = ""; // Clean input
            }

            // Start Frame (First Sentence Only)
            if (input.startFrame) {
                const originalAction = input.clip.action || "";
                // Regex to capture first sentence (ending in . ! ?)
                // Fallback to full string if no punctuation found.
                const sentences = originalAction.match(/[^.!?]+[.!?]+/g);
                if (sentences && sentences.length > 0) {
                    const firstSentence = sentences[0].trim();
                    console.log(`[GenerateManager] Start Frame Active: Truncating Action. \nOriginal: "${originalAction}" \nResult: "${firstSentence}"`);
                    input.clip.action = firstSentence;

                    // CHARACTER INTELLIGENCE: Filter Characters based on First Sentence
                    // Goal: Prevent "Character Bleeding" (e.g. Character mentioned later in action appearing in start frame)
                    if (input.clip.character) {
                        const originalChars = input.clip.character.split(',').map(s => s.trim()).filter(Boolean);
                        const filteredChars = originalChars.filter(charName => {
                            // Strict Case-Insensitive Check
                            // We use word boundary check logic roughly by checking inclusion.
                            // Ideally regex \bName\b but names can be complex. simpler includes() is safer for now.
                            return firstSentence.toLowerCase().includes(charName.toLowerCase());
                        });

                        // Rule: If we filtered everything out, should we keep NONE? Yes.
                        // If the action is "The fire burns.", we don't want Afsaar just because she's in the scene metadata.

                        console.log(`[GenerateManager] Start Frame Intelligence: Filtering Characters.\nOriginal: ${originalChars.join(', ')}\nFiltered: ${filteredChars.join(', ')}`);
                        input.clip.character = filteredChars.join(', ');
                    }

                } else {
                    // No punctuation? Use whole string but log it
                    console.log('[GenerateManager] Start Frame Active but no sentence boundary found. Using full text.');
                }
            }
        }
        console.log(`[GenerateManager] StartTask: Model='${model}' -> ApiStrategy='${apiType}' -> ConfigID='${config.id}'`);

        // --- DB SOURCE OF TRUTH ---
        // Fetch the Clip + MediaReferences directly from DB to ensure we have the correct files.
        // Do not trust the frontend 'refImageUrls' string blindly.
        const dbClip = await db.clip.findUnique({
            where: { id: parseInt(String(input.clipId)) },
            include: { mediaReferences: true }
        });

        if (!dbClip) throw new Error(`Clip ID ${input.clipId} not found in DB`);

        // Merge DB data back into input context if needed, or just use it below
        // input.clip = dbClip; // Caution: dbClip might have different shape/types than InputClip interface?

        // --- RESOLVER PHASE ---
        // 2. Resolve Explicit References from Media Relations (The "One True Place")
        let explicitRefPaths: string[] = [];

        if (dbClip.mediaReferences && dbClip.mediaReferences.length > 0) {
            // Sort by CreatedAt Descending (Latest First)
            const sortedRefs = dbClip.mediaReferences.sort((a, b) => {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            // Extract valid paths
            explicitRefPaths = sortedRefs.map(m => {
                // FAST PATH: If we have a valid Remote URL, use it to avoid expensive re-upload (Timeout Fix)
                if (m.url && m.url.startsWith('http')) {
                    return m.url;
                }
                // PREFER localPath if it exists (Absolute connection to disk)
                if (m.localPath && fs.existsSync(m.localPath)) {
                    return m.localPath;
                }
                // Fallback to URL (Local /api/ path)
                return m.url;
            });
            console.log(`[GenerateManager] Resolved ${explicitRefPaths.length} Media References from DB Relations.`);
        } else {
            // Fallback to Legacy CSV if no relations (Backward Compat)
            const rawExplicit = (input.clip.refImageUrls || "").split(',').map((s: string) => s.trim()).filter(Boolean).reverse();
            explicitRefPaths = rawExplicit;
        }

        // ... ensureList logic will handle both Absolute Paths and URLs ...
        const libraryItems = await db.studioItem.findMany({
            where: { seriesId: input.seriesId },
            include: {
                media: {
                    // FIX: Allow REFERENCE and GENERATED categories for library images, not just Studio Uploads
                    // where: { category: 'STUDIO_UPLOAD' }, 
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const seriesLib: Record<string, string> = {};
        libraryItems.forEach(item => {
            // Media-First Logic: Prefer Media table, fallback to Legacy CSV
            const mediaUrl = (item.media && item.media.length > 0) ? item.media[0].url : item.refImageUrl;

            if (item.name && mediaUrl) {
                seriesLib[item.name.toLowerCase()] = mediaUrl;
            }
        });

        const findLib = (name: string) => {
            if (!name) return undefined;
            const k = name.toLowerCase().trim();
            // Robust Lookup: Exact -> Space-to-Underscore -> Underscore-to-Space
            return seriesLib[k] || seriesLib[k.replace(/ /g, '_')] || seriesLib[k.replace(/_/g, ' ')];
        };

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

            // Explicit Images (Prioritize DB Media Relations)
            // We resolved 'explicitRefPaths' earlier from the DB Source of Truth.
            const publicExplicitImages = await ensureList(explicitRefPaths);

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
                const buildContext = {
                    input: {
                        ...input,
                        model: effectiveModelId // CRITICAL: Ensure resolved model is passed so PromptConstructor selects correct schema (Nano vs Standard)
                    },
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
                };

                // VALIDATION (Hardening)
                console.log(`[GenerateManager] Validating Builder Context...`);
                builder.validate(buildContext);

                payload = builder.build(buildContext);
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
                // LOG DEBUG
                try {
                    const logPath = path.join(process.cwd(), 'debug_gen.log');
                    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Sending Nano Task for ${input.clipId}...\n`);
                } catch (e) { }
                result = await createNanoTask(payload as NanoPayload);
                try {
                    const logPath = path.join(process.cwd(), 'debug_gen.log');
                    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Nano Result: ${JSON.stringify(result)}\n`);
                } catch (e) { }
            } else if (apiType === 'kling') {
                console.log(`[GenerateManager] Sending to Kie (Kling)...`, JSON.stringify(payload, null, 2));
                try {
                    const logPath = path.join(process.cwd(), 'debug_gen.log');
                    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Sending Kling Task for ${input.clipId}...\nPayload: ${JSON.stringify(payload)}\n`);
                } catch (e) { }
                result = await createKlingTask(payload as KlingPayload);
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
                    // CRITICAL FIX: Save the RESOLVED model (config.id), not input.model
                    // This ensures polling uses correct strategy (e.g., 'nano' instead of legacy 'veo-fast')
                    await this.updateTaskId(input.clipId, result.taskId, 'Generating', config.id);
                    try {
                        const logPath = path.join(process.cwd(), 'debug_gen.log');
                        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Updated DB with TaskID: ${result.taskId}\n`);
                    } catch (e) { }
                    return { taskId: result.taskId };
                }
            } else if (directUrl) {
                await this.updateResult(input.clipId, directUrl, 'Done');
                return { resultUrl: directUrl };
            }

            throw new Error(`Kie failed to return TaskId or URL. Raw: ${JSON.stringify(result)}`);

        } catch (error: any) {
            console.error(`[GenerateManager] Fatal Error:`, error);
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] FATAL ERROR: ${error.message}\nStack: ${error.stack}\n`);
            } catch (e) { }
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

    private async updateTaskId(clipId: string, taskId: string, status: string, model: string) {
        // Save Task ID separately, preserving previous resultUrl
        await db.clip.update({
            where: { id: parseInt(clipId) },
            data: { taskId, status, model }
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
    private async ensurePublicUrl(rawUrl: string): Promise<string> {
        const url = rawUrl.trim();
        if (url.startsWith('http')) return encodeURI(url);

        // Detect Absolute Path (from DB localPath)
        let filePath = '';
        if (path.isAbsolute(url) && fs.existsSync(url)) {
            filePath = url;
        }
        // Detect Local URL Path
        else if (url.startsWith('/api/media/uploads/')) {
            const filename = decodeURIComponent(url.replace('/api/media/uploads/', ''));
            filePath = path.join(process.cwd(), 'storage/media/uploads', filename);
        } else if (url.startsWith('/api/images/')) {
            const filename = decodeURIComponent(url.replace('/api/images/', ''));
            filePath = path.join(process.cwd(), 'storage/media/uploads', filename);
        } else if (url.startsWith('/media/library/')) {
            // Fix: Map /media/library to public/media/library
            const filename = decodeURIComponent(url.replace('/media/library/', ''));
            filePath = path.join(process.cwd(), 'public/media/library', filename);
        } else if (url.startsWith('/media/clips/')) {
            // Fix: Map /media/clips to public/media/clips (Legacy/Generated paths)
            const filename = decodeURIComponent(url.replace('/media/clips/', ''));
            filePath = path.join(process.cwd(), 'public/media/clips', filename);
        } else if (url.startsWith('/api/media/clips/')) {
            // Fix: Map /api/media/clips to storage/media/clips (Found via search)
            const filename = decodeURIComponent(url.replace('/api/media/clips/', ''));
            filePath = path.join(process.cwd(), 'storage/media/clips', filename);
        } else if (url.startsWith('/media/uploads/')) {
            // Fix: Missing Handler for legacy direct uploads path
            const filename = decodeURIComponent(url.replace('/media/uploads/', ''));
            // Check both Public and Storage locations
            const publicPath = path.join(process.cwd(), 'public/media/uploads', filename);
            const storagePath = path.join(process.cwd(), 'storage/media/uploads', filename); // Fallback
            filePath = fs.existsSync(publicPath) ? publicPath : storagePath;
        }

        // --- ROBUSTNESS: Fuzzy Search if path not resolved or file missing ---
        if (!filePath || !fs.existsSync(filePath)) {
            const basename = decodeURIComponent(path.basename(url));
            const candidateDirs = [
                path.join(process.cwd(), 'storage/media/uploads'),
                path.join(process.cwd(), 'storage/media/generated'),
                path.join(process.cwd(), 'public/media/clips'),
                path.join(process.cwd(), 'public/media/library'),
                path.join(process.cwd(), 'public/media/uploads')
            ];

            for (const dir of candidateDirs) {
                const candidate = path.join(dir, basename);
                if (fs.existsSync(candidate)) {
                    // console.log(`[GenerateManager] Fuzzy Resolved '${url}' -> '${candidate}'`);
                    filePath = candidate;
                    break;
                }
            }
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
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR: File Not Found for URL: '${url}' (Path resolved to: '${filePath}')\n`);
            } catch (e) { }
            throw new Error(`File Not Found: ${path.basename(url)}`);
        }

        return url;
    }
}
