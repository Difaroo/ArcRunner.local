import { createFluxTask, createVeoTask, createNanoTask, createKlingTask, FluxPayload, VeoPayload, NanoPayload, KlingPayload } from '@/lib/kie';
import fs from 'fs';
import path from 'path';

export class NetworkExecutor {
    public static async execute(payload: any, apiType: string, inputClipId: string): Promise<{ taskId?: string, resultUrl?: string, rawResult: any }> {
        let result: any;

        if (apiType === 'veo') {
            console.log(`[NetworkExecutor] Sending to Kie (Veo)...`, JSON.stringify(payload, null, 2));
            result = await createVeoTask(payload as VeoPayload);
        } else if (apiType === 'nano') {
            console.log(`[NetworkExecutor] Sending to Kie (Nano)...`, JSON.stringify(payload, null, 2));
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] Sending Nano Task for ${inputClipId}...\n`);
            } catch (e) { }
            result = await createNanoTask(payload as NanoPayload);
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] Nano Result: ${JSON.stringify(result)}\n`);
            } catch (e) { }
        } else if (apiType === 'kling') {
            console.log(`[NetworkExecutor] Sending to Kie (Kling)...`, JSON.stringify(payload, null, 2));
            try {
                const logPath = path.join(process.cwd(), 'debug_gen.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] Sending Kling Task for ${inputClipId}...\nPayload: ${JSON.stringify(payload)}\n`);
            } catch (e) { }
            result = await createKlingTask(payload as KlingPayload);
        } else {
            console.log(`[NetworkExecutor] Sending to Kie (Flux)...`, JSON.stringify(payload, null, 2));
            result = await createFluxTask(payload as FluxPayload);
        }

        const output = result.rawData?.output;
        const directUrl = (Array.isArray(output) && output.length > 0) ? output[0] : (typeof output === 'string' ? output : null);

        console.log('[NetworkExecutor] Raw Result:', JSON.stringify(result, null, 2));

        if (result.taskId) {
            return { taskId: result.taskId, rawResult: result };
        } else if (directUrl) {
            return { resultUrl: directUrl, rawResult: result };
        }

        throw new Error(`Kie failed to return TaskId or URL. Raw: ${JSON.stringify(result)}`);
    }
}
