import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createFluxTask, createVeoTask, createNanoTask, createKlingTask, uploadFileBase64 } from '@/lib/kie';
import { db } from '@/lib/db';
import { BuilderFactory } from '@/lib/builders/BuilderFactory';
import fs from 'fs';
import path from 'path';

// Helper to get authenticated sheets client - DUPLICATE from generate-image (should refactor to lib)
async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

// Helper: Ensure URL is public (upload local files to Kie)
async function ensurePublicUrl(url: string): Promise<string> {
    if (!url) return '';
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
            console.log(`[LibraryGen] Uploading local file to Kie: ${filePath}`);
            const fileBuffer = await fs.promises.readFile(filePath);
            const base64 = fileBuffer.toString('base64');
            const filenameStr = path.basename(filePath);

            const uploadRes = await uploadFileBase64(base64, filenameStr);

            // Handle diverse response shapes
            const publicUrl = uploadRes.data?.url || uploadRes.url || (uploadRes.data as any)?.downloadUrl;

            if (publicUrl) {
                return publicUrl;
            }

            throw new Error('Upload response missing URL/downloadUrl');
        } catch (err) {
            console.error(`[LibraryGen] Failed to upload local file ${filePath}:`, err);
            // Don't fail hard, return original (will likely fail downstream but keeps process alive)
            return url;
        }
    }

    return url;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { item, rowIndex, style, styleStrength, refStrength, seed, aspectRatio, model } = body;
        console.log(`[LibraryGen] Request Received for ${item?.name || 'Unknown'} (Model: ${model})`);

        if (!item || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing item or rowIndex' }, { status: 400 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Resolve Style Reference (Server-Side)
        let styleRefUrl = '';
        let styleDescription = '';

        if (style && item.series) {
            // Find the style item for this series
            const styleItem = await db.studioItem.findFirst({
                where: {
                    seriesId: item.series,
                    type: 'LIB_STYLE',
                    name: style
                }
            });
            if (styleItem) {
                if (styleItem.refImageUrl) {
                    styleRefUrl = styleItem.refImageUrl;
                }

                if (styleItem.description) {
                    styleDescription = styleItem.description;
                }
            }
        }

        // 2. Prepare Payload via Builder Factory
        // Combine Item Ref + Style Ref
        const rawUrls: string[] = [];
        if (item.refImageUrl && !item.refImageUrl.startsWith('TASK:')) {
            // Handle comma-separated input if user uploaded multiple
            item.refImageUrl.split(',').forEach((u: string) => rawUrls.push(u.trim()));
        }
        if (styleRefUrl && !styleRefUrl.startsWith('TASK:')) rawUrls.push(styleRefUrl);

        // Resolve Local Files to Public URLs
        const publicImageUrls: string[] = [];
        let rStyleIndex: number | undefined = undefined;

        if (rawUrls.length > 0) {
            const results = await Promise.allSettled(rawUrls.map(url => ensurePublicUrl(url)));

            // Map results maintaining correlation with rawUrls
            const resolvedMap = results.map((r, i) => ({
                original: rawUrls[i],
                success: r.status === 'fulfilled',
                url: r.status === 'fulfilled' ? (r as PromiseFulfilledResult<string>).value : null,
                isStyle: rawUrls[i] === styleRefUrl // Identify if this was the style
            }));

            // Filter for success only, but track where the style went
            resolvedMap.forEach(item => {
                if (item.success && item.url) {
                    publicImageUrls.push(item.url);
                    if (item.isStyle) {
                        rStyleIndex = publicImageUrls.length - 1; // Current Last Index
                    }
                } else if (item.isStyle) {
                    console.warn('[LibraryGen] Style Reference failed to resolve/upload:', item.original);
                }
            });
        }

        const targetModel = model || 'flux-2/flex-image-to-image';
        console.log(`[LibraryGen] Using Model: ${targetModel}`);

        // Validate image count against model limits
        const isNanoModel = targetModel.includes('nano') || targetModel.includes('banana');
        const modelLimit = isNanoModel ? 8 : 3;
        let warningMessage = '';

        if (publicImageUrls.length > modelLimit) {
            warningMessage = `MAX ${modelLimit}`;
            console.warn(`[LibraryGen] Image limit exceeded: ${publicImageUrls.length} provided, ${modelLimit} supported. Excess images ignored.`);
        }

        const builder = BuilderFactory.getBuilder(targetModel);
        if (!builder) throw new Error('Flux Builder not found');

        // Construct minimal input for builder
        const builderInput = {
            clipId: item.id.toString(), // Pseudo ID
            seriesId: item.series || '',
            model: targetModel,
            aspectRatio: aspectRatio || '16:9',
            // Smart Prompt Elements (Passed separately for Builder to assemble)
            subjectName: item.name,
            subjectDescription: item.description,
            styleName: style,
            styleDescription: styleDescription,
            clip: item,
            styleStrength, // Pass through
            refStrength, // Pass through
            // Use the robustly calculated index
            styleImageIndex: rStyleIndex,
            seed: seed || undefined // Pass through if present
        };

        // Identify Explicit Images (Non-Style)
        // This ensures the PromptSelector logic picks them up.
        // publicImageUrls contains ALL images (refs + style).
        // WE must separate them.
        let resolvedExplicitImages: string[] = [];
        let resolvedStyleImage: string | null = null;

        // Optimized: Reuse already-resolved publicImageUrls and rStyleIndex
        // publicImageUrls was populated lines 108-133
        if (rStyleIndex !== undefined && rStyleIndex >= 0 && rStyleIndex < publicImageUrls.length) {
            resolvedStyleImage = publicImageUrls[rStyleIndex];
            // Explicit images are everything ELSE
            resolvedExplicitImages = publicImageUrls.filter((_, i) => i !== rStyleIndex);
        } else {
            // No style, or style failed. Everything is explicit.
            resolvedExplicitImages = [...publicImageUrls];
        }


        const payload = builder.build({
            input: builderInput,
            publicImageUrls, // Legacy/Fallback (contains all)
            characterImages: [],
            characterAssets: [],
            locationImages: [],
            locationAsset: undefined,
            explicitImages: resolvedExplicitImages,
            styleImage: resolvedStyleImage
        }); // as FluxPayload

        // 3. Call Kie.ai via Standard Client
        // Dynamic Strategy Dispatch
        console.log(`[LibraryGen] Dispatching to Strategy: ${targetModel} (Payload ID: ${payload.model})`);

        // Simple strategy detection (can also import getModelConfig from @/lib/models)
        let kieRes;
        if (targetModel.includes('nano') || targetModel.includes('banana')) {
            kieRes = await createNanoTask(payload as any);
        } else if (targetModel.includes('veo')) {
            kieRes = await createVeoTask(payload as any);
        } else if (targetModel.includes('kling')) {
            kieRes = await createKlingTask(payload as any);
        } else {
            // Default to Flux
            kieRes = await createFluxTask(payload as any);
        }

        // Debug Metadata
        const debugMeta = {
            attemptedModel: payload.model,
            hasInputUrls: !!(payload.input as any).input_urls,
            fallbackTriggered: payload.model !== builderInput.model,
            params: {
                styleStrength,
                refStrength,
                guidanceScale: (payload.input as any).guidance_scale,
                enhancedPrompt: (payload.input as any).prompt,
                seed: (payload.input as any).seed, // Explicitly return passed seed
                fullInputKeys: Object.keys(payload.input)
            }
        };

        // 4. Handle Response
        // Standard Factory returns { taskId, rawData }
        let taskId = '';
        if (kieRes.taskId) {
            taskId = kieRes.taskId;
        } else {
            console.error('No Task ID returned:', JSON.stringify(kieRes));
            return NextResponse.json({
                error: 'Generation failed (Missing Task ID)',
                debug: {
                    ...debugMeta,
                    kieResponseString: 'See Server Logs'
                }
            }, { status: 500 });
        }

        const kieData = kieRes.rawData;

        // 5. Update Database with Status and TaskID
        // We do NOT touch the sheet here anymore for transient "Generating" state.
        // We only care about the StudioItem table.
        // Also, 'rowIndex' passed from client is sheet row, but we have 'item.id' which is our DB ID (string id in Prisma).
        // Check schema: id is Int. item.id passed from client is string. Parse it.
        const dbId = parseInt(item.id);

        await db.studioItem.update({
            where: { id: dbId },
            data: {
                status: 'GENERATING',
                taskId: taskId,
                model: targetModel
            }
        });

        // We return 'generating' status to client so it can update local state immediately if desired
        const response: any = {
            success: true,
            data: kieData,
            taskId,
            status: warningMessage || 'GENERATING',  // Use warning as status if present
            debug: debugMeta
        };

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Library Generate Error:', error);
        return NextResponse.json({
            error: error.message,
            debug: {
                // Try to infer what was attempted if possible, though 'payload' variable is block-scoped.
                // We can't access 'payload' here easily without lifting it out.
                // Instead, just return the standard error message but formatted for client visibility.
                msg: error.message || 'Unknown Error',
                code: error.code || 500
            }
        }, { status: 500 }); // Return 500 so client sees it's an error, but with body
    }
}
