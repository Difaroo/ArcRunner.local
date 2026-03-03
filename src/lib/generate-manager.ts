import { db } from '@/lib/db';
import { getModelConfig } from '@/lib/models';
import { BuilderFactory } from '@/lib/builders/BuilderFactory';
import { AssetResolver } from './generation/AssetResolver';
import { AssetUploader } from './generation/AssetUploader';
import { NetworkExecutor } from './generation/NetworkExecutor';
import { uploadFileBase64 } from '@/lib/kie';
import fs from 'fs';
import path from 'path';
import { Clip } from '@prisma/client';

export interface GenerateTaskInput {
    clipId: string;
    seriesId: string;
    model?: string;
    aspectRatio?: string;
    sound?: boolean;
    startFrame?: boolean;
    prompt?: string;
    clip: Clip & { prompt?: string, duration?: string, negativePrompt?: string | null, movement?: string | null };
    dryRun?: boolean;
    styleStrength?: number;
    refStrength?: number;
    seed?: number;
    subjectName?: string;
    subjectDescription?: string;
    styleName?: string;
    styleDescription?: string;
    styleImageIndex?: number;
    subjectNegatives?: string;
    styleNegatives?: string;
}

export class GenerateManager {

    constructor() {
        console.log('[GenerateManager] Initialized');
    }

    public async startTask(input: GenerateTaskInput): Promise<{ taskId?: string, resultUrl?: string, debugPayload?: any }> {
        console.log(`[GenerateManager] >>> Starting Task <<<`);
        console.log(`[GenerateManager] Input: Clip=${input.clipId}, Series=${input.seriesId}, Prompt='${input.prompt || input.clip.prompt?.substring(0, 50)}...'`);

        try {
            // 1. Resolve Asset Context (Replaced monolithic block)
            const context = await AssetResolver.resolve(input);
            const { effectiveModelId, apiType, builderId, manifest, dbClip, libraryItems, descriptors, modifiedInput } = context;
            const isVideo = apiType === 'veo';

            console.log(`[GenerateManager] StartTask: Model='${effectiveModelId}' -> ApiStrategy='${apiType}' -> BuilderID='${builderId}'`);

            // 2. Build Unified Builder
            const builder = BuilderFactory.getBuilder(builderId);
            if (!builder) throw new Error(`Model not supported: ${builderId}`);

            // 3. Update DB Status
            if (!modifiedInput.dryRun) {
                await this.updateStatus(modifiedInput.clipId, 'Generating');
            }

            // 4. Resolve Granular Images to Public URLs using AssetUploader
            const ensureList = async (urls: string[]) => {
                const results = await Promise.allSettled(urls.map(u => AssetUploader.ensurePublicUrl(u)));
                return results.map(r => {
                    if (r.status === 'fulfilled') return (r as PromiseFulfilledResult<string>).value;
                    console.error('[GenerateManager] Image Upload Failed, skipping slot:', r.reason);
                    return "";
                });
            };

            const manifestEnsuredData = await ensureList(manifest.selectedUrls);

            const ensuredSlots = manifest.slots.map((slot: any, index: number) => ({
                ...slot,
                ensuredData: manifestEnsuredData[index]
            }));

            let publicStyleImage: string | null = ensuredSlots.find((s: any) => s.type === 'style')?.ensuredData || null;
            const publicCharImages = ensuredSlots.filter((s: any) => s.type === 'character').map((s: any) => s.ensuredData);
            const publicLocImages = ensuredSlots.filter((s: any) => s.type === 'location').map((s: any) => s.ensuredData);
            const publicExplicitImages = ensuredSlots.filter((s: any) => ['reference', 'start-frame', 'end-frame'].includes(s.type)).map((s: any) => s.ensuredData);
            const publicImageUrls = publicExplicitImages;

            // FLUX T2I PATCH
            if (!isVideo && apiType !== 'kling' && publicImageUrls.length === 0 && publicExplicitImages.length === 0 && publicCharImages.length === 0 && publicLocImages.length === 0 && !publicStyleImage) {
                console.log('[GenerateManager] No input images found for Flux. Injecting dummy placeholder.');
                try {
                    const filePath = path.join(process.cwd(), 'storage/media/defaults/empty.png');
                    if (fs.existsSync(filePath)) {
                        const fileBuffer = await fs.promises.readFile(filePath);
                        const base64 = fileBuffer.toString('base64');
                        const uploadRes = await uploadFileBase64(base64, "empty.png");
                        const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;
                        if (publicUrl) {
                            publicImageUrls.push(publicUrl);
                        }
                    }
                } catch (e) {
                    console.error('[GenerateManager] Failed to inject dummy image:', e);
                }
            }

            // 5. Build Payload Context
            let payload;
            try {
                const buildContext = {
                    input: {
                        ...modifiedInput,
                        model: effectiveModelId
                    },
                    base64Images: apiType === 'veo' ? publicExplicitImages : undefined,
                    publicImageUrls,
                    characterImages: publicCharImages,
                    locationImages: publicLocImages,
                    explicitImages: publicExplicitImages,
                    styleImage: publicStyleImage || null,
                    locationAsset: descriptors.locationAsset,
                    characterAssets: descriptors.characterAssets || [],
                    styleAsset: descriptors.styleAsset,
                    cameraAsset: descriptors.cameraAsset
                };

                console.log(`[GenerateManager] Validating Builder Context...`);
                builder.validate(buildContext);
                payload = builder.build(buildContext);
            } catch (builderError: any) {
                console.error('[GenerateManager] Builder Failed:', builderError);
                throw new Error(`Builder Error: ${builderError.message}`);
            }

            // 6. Execute Task
            if (modifiedInput.dryRun) {
                return { taskId: 'DRY-RUN', debugPayload: payload };
            }

            const execResult = await NetworkExecutor.execute(payload, apiType, modifiedInput.clipId);

            // 7. Process Result and Update DB
            if (execResult.taskId) {
                if (execResult.resultUrl) {
                    await this.updateResult(modifiedInput.clipId, execResult.resultUrl, 'Done');
                    return { resultUrl: execResult.resultUrl };
                } else {
                    const config = getModelConfig(effectiveModelId);
                    await this.updateTaskId(modifiedInput.clipId, execResult.taskId, 'Generating', config.id);
                    return { taskId: execResult.taskId };
                }
            } else if (execResult.resultUrl) {
                await this.updateResult(modifiedInput.clipId, execResult.resultUrl, 'Done');
                return { resultUrl: execResult.resultUrl };
            }

            throw new Error(`Execution returned invalid shape.`);

        } catch (error: any) {
            console.error(`[GenerateManager] Fatal Error:`, error);
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] FATAL ERROR: ${error.message}\nStack: ${error.stack}\n`);
            } catch (e) { }

            let statusMsg = 'Error';
            const msg = (error.message || String(error)).toLowerCase();

            if (error.response?.status) statusMsg = `Error ${error.response.status}`;
            else if (error.status) statusMsg = `Error ${error.status}`;
            else if (error.code) statusMsg = `Error ${error.code}`;
            else if (msg.includes('500')) statusMsg = 'Error 500';
            else if (msg.includes('400')) statusMsg = 'Error 400';
            else if (msg.includes('422')) statusMsg = 'Error 422';
            else if (msg.includes('upload failed')) statusMsg = 'Upload Err';
            else if (msg.includes('file not found')) statusMsg = 'File 404';
            else if (msg.includes('fetch') || msg.includes('network')) statusMsg = 'Net Err';

            if (statusMsg === 'Error') {
                const cleanMsg = (error.message || "Unknown").replace(/^Error:?\s*/i, '');
                statusMsg = `Error ${cleanMsg.substring(0, 12)}`;
            }

            try {
                await this.updateStatus(input.clipId, statusMsg);
            } catch (dbErr) {
                console.error('[GenerateManager] Failed to update error status in DB:', dbErr);
            }

            throw error;
        }
    }

    private async updateStatus(clipId: string, status: string) {
        await db.clip.update({
            where: { id: parseInt(clipId) },
            data: { status }
        });
    }

    private async updateTaskId(clipId: string, taskId: string, status: string, model: string) {
        await db.clip.update({
            where: { id: parseInt(clipId) },
            data: { taskId, status, model }
        });
    }

    private async updateResult(clipId: string, result: string, status: string) {
        const id = parseInt(clipId);
        const updatedClip = await db.clip.update({
            where: { id },
            data: { status }
        });

        if (result && status === 'Done') {
            try {
                const isImage = result.match(/\.(png|jpg|jpeg|webp)($|\?)/i);
                await db.media.create({
                    data: {
                        url: result,
                        type: isImage ? 'IMAGE' : 'VIDEO',
                        category: 'RESULT',
                        resultForClipId: id,
                        episodeId: updatedClip.episodeId
                    }
                });
                console.log(`[GenerateManager] Created Media record for Clip ${id}`);
            } catch (e) {
                console.error(`[GenerateManager] Failed to create Media record:`, e);
            }
        }
    }
}
