import { FluxPayload, VeoPayload, NanoPayload, AppStatus } from './kie-types';

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_BASE_URL = 'https://api.kie.ai/api/v1';



export interface StatusResult {
    status: AppStatus;
    resultUrl: string;
    errorMsg: string;
}

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

// Strategy Interface
export interface KieStrategy {
    createTask(payload: any): Promise<{ taskId: string, rawData: any }>;
    checkStatus(taskId: string): Promise<StatusResult>;
    getType(): 'flux' | 'veo' | 'nano';
}

// --- SHARED HELPERS ---
function safeStatus(val: any): string {
    if (val === undefined || val === null) return '';
    return String(val).toUpperCase();
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

// --- FLUX STRATEGY ---
export class FluxStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' | 'nano' { return 'flux'; }

    async createTask(payload: FluxPayload): Promise<{ taskId: string, rawData: any }> {
        const res = await kieFetch<any>('/jobs/createTask', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<StatusResult> {
        const res = await kieFetch<any>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });
        console.log(`[FluxStrategy] Status Response for ${taskId}:`, JSON.stringify(res, null, 2));

        // Flux/Nano typically use 'state'
        // But let's be defensive and check standard keys too
        const rawState = res.data?.state || res.data?.status;
        const s = safeStatus(rawState);

        let status: AppStatus = 'Generating';
        let resultUrl = '';
        let errorMsg = '';

        // Success
        if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE', '1'].includes(s)) {
            status = 'Done';

            // 1. Try JSON String first (Flux standard)
            if (res.data?.resultJson) {
                try {
                    const results = JSON.parse(res.data.resultJson);
                    resultUrl = findResultUrl(results);
                } catch (e) {
                    // Fallback to top-level search
                }
            }
            // 2. Fallback to global search in data
            if (!resultUrl) {
                resultUrl = findResultUrl(res.data || {});
            }

        }
        // Failure
        else if (['FAILED', 'ERROR', 'CANCELLED', 'TIMEOUT', '2', '3'].includes(s)) {
            status = 'Error';
            errorMsg = safeStatus(res.data || '') || 'Generation Failed';
        }
        // Generating
        else {
            // If unknown, assume generating to be safe, unless explicit error
            status = 'Generating';
        }

        // URL Check
        if (status === 'Done' && !resultUrl) {
            status = 'Error';
            errorMsg = 'MISSING_URL';
        }

        return { status, resultUrl, errorMsg };
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

    async checkStatus(taskId: string): Promise<StatusResult> {
        const res = await kieFetch<any>(`/veo/record-info?taskId=${taskId}`, { method: 'GET' });
        console.log(`[VeoStrategy] Status Response for ${taskId}:`, JSON.stringify(res));
        const data = res.data || {};

        const rawStatus = data.status;
        let status: AppStatus = 'Generating';
        let resultUrl = '';
        let errorMsg = '';

        // 1. NEW SCHEMA CHECK: successFlag
        // Robust check for various truthy values
        const flag = data.successFlag;
        const isSuccessFlag = flag === 1 || flag === true || String(flag) === 'true';

        if (isSuccessFlag) {
            // DONE
            status = 'Done';
            resultUrl = findResultUrl(data);
        }
        else if (data.successFlag !== undefined && !isSuccessFlag && data.completeTime) {
            // Completed but flag says NO -> Error
            status = 'Error';
            errorMsg = data.errorMessage || `Error Code: ${data.errorCode}`;
        }
        else {
            // 2. LEGACY STATUS CHECK
            const s = safeStatus(rawStatus);

            if (['COMPLETED', 'SUCCEEDED', 'DONE', 'SUCCESS', '1'].includes(s)) {
                status = 'Done';
                resultUrl = findResultUrl(data);
            }
            else if (['FAILED', 'ERROR', 'CANCELLED', 'TIMEOUT', '2', '3'].includes(s)) {
                status = 'Error';
                errorMsg = data.errorMessage || s || 'Generation Failed';
            }
            else {
                status = 'Generating';
            }
        }

        // URL Check
        if (status === 'Done' && !resultUrl) {
            status = 'Error';
            errorMsg = 'MISSING_URL';
        }

        return { status, resultUrl, errorMsg };
    }
}

// --- NANO STRATEGY ---
export class NanoStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' | 'nano' { return 'nano'; }

    async createTask(payload: NanoPayload): Promise<{ taskId: string, rawData: any }> {
        // Nano uses same endpoint as Flux
        const res = await kieFetch<any>('/jobs/createTask', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<StatusResult> {
        // Same Logic as Flux but separated class for clarity/future divergence
        // Reusing the robust logic
        const res = await kieFetch<{ state: string, resultJson?: string }>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });
        console.log(`[NanoStrategy] Status Response for ${taskId}:`, JSON.stringify(res, null, 2));

        const rawState = res.data?.state || res.data?.status;
        const s = safeStatus(rawState);

        let status: AppStatus = 'Generating';
        let resultUrl = '';
        let errorMsg = '';

        if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE', '1'].includes(s)) {
            status = 'Done';
            if (res.data?.resultJson) {
                try {
                    const results = JSON.parse(res.data.resultJson);
                    resultUrl = findResultUrl(results);
                } catch (e) { }
            }
            if (!resultUrl) resultUrl = findResultUrl(res.data || {});
        }
        else if (['FAILED', 'ERROR', 'CANCELLED', 'TIMEOUT', '2', '3'].includes(s)) {
            status = 'Error';
            errorMsg = safeStatus(res.data) || 'Generation Failed';
        }
        else {
            status = 'Generating';
        }

        if (status === 'Done' && !resultUrl) {
            status = 'Error';
            errorMsg = 'MISSING_URL';
        }

        return { status, resultUrl, errorMsg };
    }
}

// --- FACTORY ---
export const KieClient = {
    getStrategy(type: 'flux' | 'veo' | 'nano'): KieStrategy {
        if (type === 'flux') return new FluxStrategy();
        if (type === 'nano') return new NanoStrategy();
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
