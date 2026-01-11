import { FluxPayload, VeoPayload, NanoPayload, KlingPayload, AppStatus, KieResult } from './kie-types';
import * as fs from 'fs';
import * as path from 'path';

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_BASE_URL = 'https://api.kie.ai/api/v1';


interface KieResponse<T = any> {
    data?: T;
    error?: { message: string };
    msg?: string;
    [key: string]: any;
}

// Base Fetcher
async function kieFetch<T>(endpoint: string, options: { method: 'POST' | 'GET', body?: any }): Promise<KieResponse<T>> {
    const { method, body } = options;
    const url = endpoint.startsWith('http') ? endpoint : `${KIE_BASE_URL}${endpoint}`;
    console.log(`[KieFetch] ${method} ${url}`);
    if (body) {
        console.log('[KieFetch] Request Body:', JSON.stringify(body, null, 2));
    }

    // Resilience: 15s Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(url, {
            method,
            cache: 'no-store',
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });

        const data = await res.json();
        console.log(`[KieFetch] Response [${res.status}]:`, JSON.stringify(data, null, 2));

        if (!res.ok) {
            console.error(`[KieFetch] RAW ERROR:`, JSON.stringify(data, null, 2));
            const errMsg = data.error?.message || data.msg || JSON.stringify(data) || `Failed to call Kie.ai ${endpoint}`;
            const error: any = new Error(errMsg);
            error.response = { status: res.status, data }; // Axios compatibility
            error.status = res.status;
            error.code = res.status; // Fallback code
            throw error;
        }
        return data;

    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error(`Kie.ai Request Timed Out (${endpoint})`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// --- HELPERS ---
function safeStatus(val: any): string {
    if (val === undefined || val === null) return '';
    return String(val).toUpperCase();
}

/**
 * Normalizes the chaotic status codes from various Kie-hosted models (Flux, Veo, Nano)
 * into a standard AppStatus.
 * 
 * @param rawStatus - String or Number status from API
 * @param successFlag - Optional boolean flag (Veo specific)
 * @param hasError - Explicit error presence
 */
function normalizeKieStatus(rawStatus: any, successFlag?: any, hasError?: boolean): { status: AppStatus, isDone: boolean, isError: boolean } {
    const s = safeStatus(rawStatus);

    // 1. Explicit Success Flag (Veo Priority)
    if (successFlag !== undefined) {
        const isTrue = successFlag === 1 || successFlag === true || String(successFlag) === 'true';
        if (isTrue) return { status: 'Done', isDone: true, isError: false };
        // If flag is false but we have a status, fall through...
    }

    // 2. Standard Status Codes
    if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE', '1'].includes(s)) {
        return { status: 'Done', isDone: true, isError: false };
    }

    // 3. Error Codes
    if (hasError || ['FAILED', 'ERROR', 'CANCELLED', 'TIMEOUT', '2', '3'].includes(s)) {
        return { status: 'Error', isDone: false, isError: true };
    }

    // 4. Default: Generating
    return { status: 'Generating', isDone: false, isError: false };
}

function findResultUrl(data: any): string {
    if (!data) return '';

    // Direct Keys (Camel & Snake)
    if (data.resultUrl) return data.resultUrl;
    if (data.result_url) return data.result_url;
    if (data.videoUrl) return data.videoUrl;
    if (data.video_url) return data.video_url;
    if (data.url) return data.url;
    if (data.downloadUrl) return data.downloadUrl;
    if (data.download_url) return data.download_url;
    if (data.output) return data.output;
    if (data.output_url) return data.output_url;

    // Arrays
    if (Array.isArray(data.resultUrls) && data.resultUrls[0]) return data.resultUrls[0];
    if (Array.isArray(data.images) && data.images[0]?.url) return data.images[0].url;

    // Recursive / Nested Response
    if (data.response) {
        let nested = data.response;
        if (typeof nested === 'string') {
            try { nested = JSON.parse(nested); } catch (e) {
                // If response is a string URL
                if (nested.startsWith('http')) return nested;
                return '';
            }
        }
        if (typeof nested === 'object' && nested !== null) {
            // Avoid infinite recursion if response points to self (unlikely but safe)
            if (nested !== data) return findResultUrl(nested);
        }
    }

    return '';
}

// Strategy Interface
export interface KieStrategy {
    createTask(payload: any): Promise<{ taskId: string, rawData: any }>;
    checkStatus(taskId: string): Promise<KieResult>;
    getType(): 'flux' | 'veo' | 'nano' | 'kling';
}


// --- FLUX STRATEGY ---
export class FluxStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' | 'nano' { return 'flux'; }

    async createTask(payload: FluxPayload): Promise<{ taskId: string, rawData: any }> {
        const res = await kieFetch<any>('/jobs/createTask', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<KieResult> {
        const res = await kieFetch<any>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });
        console.log(`[FluxStrategy] Status Check ${taskId} RAW:`, JSON.stringify(res));

        const rawState = res.data?.state || res.data?.status;
        const normalized = normalizeKieStatus(rawState);
        let resultUrl = '';
        let errorMsg = '';

        if (normalized.isDone) {
            console.log(`[FluxStrategy] DONE Payload:`, JSON.stringify(res.data));

            // Flux Robust Check
            if (res.data?.model_outputs?.output) resultUrl = res.data.model_outputs.output;
            else if (res.data?.model_outputs?.url) resultUrl = res.data.model_outputs.url;
            else if (res.data?.output) resultUrl = res.data.output;
            else if (res.data?.url) resultUrl = res.data.url;

            if (res.data?.resultJson) {
                try {
                    const results = JSON.parse(res.data.resultJson);
                    if (!resultUrl) resultUrl = findResultUrl(results);
                } catch (e) { }
            }
            if (!resultUrl) resultUrl = findResultUrl(res.data || {});

            if (!resultUrl) {
                normalized.status = 'Error';
                errorMsg = 'MISSING_URL - Check Console';
            }
        } else if (normalized.isError) {
            const data = res.data || {};
            errorMsg = safeStatus(data.failMsg || data.failCode || data.error || data.message || data.errorMessage) || 'Generation Failed';
        }

        return { status: normalized.status, resultUrl, errorMsg, debugRaw: res.data };
    }
}

// --- VEO STRATEGY ---
export class VeoStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' | 'nano' { return 'veo'; }

    async createTask(payload: VeoPayload): Promise<{ taskId: string, rawData: any }> {
        const res = await kieFetch<any>('/veo/generate', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<KieResult> {
        const res = await kieFetch<any>(`/veo/record-info?taskId=${taskId}`, { method: 'GET' });
        // console.log(`[VeoStrategy] Status Response for ${taskId}:`, JSON.stringify(res));
        const data = res.data || {};

        const rawStatus = data.status;
        const normalized = normalizeKieStatus(rawStatus, data.successFlag);

        // Edge Case: Veo sometimes marks "Complete" but successFlag is false/undefined -> Error
        if (data.completeTime && !normalized.isDone && !normalized.isError && data.successFlag !== 1 && data.successFlag !== true) {
            normalized.status = 'Error';
            normalized.isError = true;
        }

        let resultUrl = '';
        let errorMsg = '';

        if (normalized.isDone) {
            resultUrl = findResultUrl(data);
            // Validation
            if (!resultUrl) {
                normalized.status = 'Error';
                errorMsg = 'MISSING_URL';
            }
        } else if (normalized.isError) {
            errorMsg = data.errorMessage || data.errorCode || 'Generation Failed';
        }

        return { status: normalized.status, resultUrl, errorMsg, debugRaw: data };
    }
}

// --- NANO STRATEGY ---
export class NanoStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' | 'nano' { return 'nano'; }

    async createTask(payload: NanoPayload): Promise<{ taskId: string, rawData: any }> {
        console.log('[NanoStrategy] Creating Task:', JSON.stringify(payload));

        // Log to file
        try {
            const logPath = path.join(process.cwd(), 'debug_nano.log');
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] CREATE REQ: ${JSON.stringify(payload)}\n`);
        } catch (e) { }

        const res = await kieFetch<any>('/jobs/createTask', { method: 'POST', body: payload });
        console.log('[NanoStrategy] Create Response:', JSON.stringify(res));

        // Log response
        try {
            const logPath = path.join(process.cwd(), 'debug_nano.log');
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] CREATE RES: ${JSON.stringify(res)}\n`);
        } catch (e) { }

        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        if (!taskId) {
            console.error('[NanoStrategy] FAILED TO EXTRACT TASK ID from:', JSON.stringify(res));
            try {
                const logPath = path.join(process.cwd(), 'debug_nano.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR: Missing Task ID in response!\n`);
            } catch (e) { }
        }
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<KieResult> {
        try {
            // Nano uses Flux infrastructure
            const res = await kieFetch<any>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });

            // LOG TO FILE FOR DEBUGGING
            try {
                const logPath = path.join(process.cwd(), 'debug_nano.log');
                const logEntry = `[${new Date().toISOString()}] Task: ${taskId} | State: ${res.data?.state || res.data?.status} | Data: ${JSON.stringify(res)}\n`;
                fs.appendFileSync(logPath, logEntry);
            } catch (e) { console.error('Log failed', e); }

            console.log(`[NanoStrategy] Status Check ${taskId} RAW:`, JSON.stringify(res));

            const rawState = res.data?.state || res.data?.status;
            const normalized = normalizeKieStatus(rawState);
            let resultUrl = '';
            let errorMsg = '';

            if (normalized.isDone) {
                console.log(`[NanoStrategy] DONE Payload:`, JSON.stringify(res.data)); // Debug final payload

                // 1. Check for specific Nano output fields often used in this backend
                // Common variations: data.model_outputs.output, data.output, data.url
                if (res.data?.model_outputs?.output) resultUrl = res.data.model_outputs.output;
                else if (res.data?.model_outputs?.url) resultUrl = res.data.model_outputs.url;
                else if (res.data?.output) resultUrl = res.data.output;
                else if (res.data?.url) resultUrl = res.data.url;

                // 2. Parse resultJson if present (Flux style)
                if (!resultUrl && res.data?.resultJson) {
                    try {
                        const results = JSON.parse(res.data.resultJson);
                        resultUrl = findResultUrl(results);
                    } catch (e) { }
                }

                // 3. Last Resort Fallback
                if (!resultUrl) resultUrl = findResultUrl(res.data || {});

                if (!resultUrl) {
                    normalized.status = 'Error';
                    errorMsg = 'MISSING_URL - Check Console for Payload';
                    // Log specfic failure to file
                    try {
                        const logPath = path.join(process.cwd(), 'debug_nano.log');
                        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR: ID ${taskId} is DONE but NO URL FOUND. Data: ${JSON.stringify(res.data)}\n`);
                    } catch (e) { }
                }
            } else if (normalized.isError) {
                // Robust extraction of error message
                const data = res.data || {};
                errorMsg = safeStatus(data.failMsg || data.failCode || data.error || data.message || data.errorMessage) || 'Generation Failed';
            }

            return { status: normalized.status, resultUrl, errorMsg, debugRaw: res.data };

        } catch (error: any) {
            // Log Logic for Network Failures
            try {
                const logPath = path.join(process.cwd(), 'debug_nano.log');
                const errMsg = error.message || String(error);
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] FATAL EXCEPTION for ${taskId}: ${errMsg}\n`);
            } catch (e) { }
            throw error;
        }
    }
}

// --- KLING STRATEGY ---
export class KlingStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' | 'nano' | 'kling' { return 'kling'; }

    async createTask(payload: KlingPayload): Promise<{ taskId: string, rawData: any }> {
        const res = await kieFetch<any>('/jobs/createTask', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<KieResult> {
        // Kling uses same infra as Flux/Nano
        const res = await kieFetch<any>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });
        console.log(`[KlingStrategy] Status Check ${taskId} RAW:`, JSON.stringify(res));

        const rawState = res.data?.state || res.data?.status;
        const normalized = normalizeKieStatus(rawState);
        let resultUrl = '';
        let errorMsg = '';

        if (normalized.isDone) {
            console.log(`[KlingStrategy] DONE Payload:`, JSON.stringify(res.data));

            // Kling Robust Check
            if (res.data?.model_outputs?.output) resultUrl = res.data.model_outputs.output;
            else if (res.data?.model_outputs?.url) resultUrl = res.data.model_outputs.url;
            else if (res.data?.output) resultUrl = res.data.output;
            else if (res.data?.url) resultUrl = res.data.url;

            if (res.data?.resultJson) {
                try {
                    const results = JSON.parse(res.data.resultJson);
                    if (!resultUrl) resultUrl = findResultUrl(results);
                } catch (e) { }
            }
            if (!resultUrl) resultUrl = findResultUrl(res.data || {});

            if (!resultUrl) {
                normalized.status = 'Error';
                errorMsg = 'MISSING_URL - Check Console';
            }
        } else if (normalized.isError) {
            const data = res.data || {};
            errorMsg = safeStatus(data.failMsg || data.failCode || data.error || data.message || data.errorMessage) || 'Generation Failed';
        }

        return { status: normalized.status, resultUrl, errorMsg, debugRaw: res.data };
    }
}

// --- FACTORY ---
export const KieClient = {
    getStrategy(type: 'flux' | 'veo' | 'nano' | 'kling'): KieStrategy {
        if (type === 'flux') return new FluxStrategy();
        if (type === 'nano') return new NanoStrategy();
        if (type === 'kling') return new KlingStrategy();
        return new VeoStrategy();
    },

    // Shared Utility
    async uploadFileBase64(base64Data: string, fileName?: string) {
        return kieFetch<{ url: string }>('https://kieai.redpandaai.co/api/file-base64-upload', {
            method: 'POST',
            body: { base64Data, fileName, uploadPath: "temp_uploads" }
        });
    }
};
