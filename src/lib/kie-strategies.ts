import { FluxPayload, VeoPayload, AppStatus } from './kie-types';

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
            throw new Error(data.error?.message || data.msg || JSON.stringify(data) || `Failed to call Kie.ai ${endpoint}`);
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
    getType(): 'flux' | 'veo';
}

// --- FLUX STRATEGY ---
export class FluxStrategy implements KieStrategy {
    getType(): 'flux' | 'veo' { return 'flux'; }

    async createTask(payload: FluxPayload): Promise<{ taskId: string, rawData: any }> {
        const res = await kieFetch<any>('/jobs/createTask', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<StatusResult> {
        const res = await kieFetch<{ state: string, resultJson?: string }>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });
        console.log(`[FluxStrategy] Status Response for ${taskId}:`, JSON.stringify(res, null, 2));
        const state = (res.data?.state || '').toLowerCase();
        let status: AppStatus = 'Generating';
        let resultUrl = '';
        let errorMsg = '';

        const activeStates = ['queued', 'queuing', 'waiting', 'generating', 'processing', 'created', 'starting'];
        if (activeStates.includes(state)) {
            status = 'Generating';
        } else if (['success', 'succeeded', 'completed', 'done'].includes(state)) {
            status = 'Done';
            if (res.data?.resultJson) {
                try {
                    const results = JSON.parse(res.data.resultJson);
                    resultUrl = results.images?.[0]?.url || results.resultUrls?.[0] || results.url || '';
                } catch (e) {
                    status = 'Error';
                    errorMsg = 'JSON_PARSE_ERR';
                }
            } else {
                status = 'Error';
                errorMsg = 'NO_RESULT_JSON';
            }
        } else {
            status = 'Error';
            errorMsg = state || 'Unknown Error';
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
    getType(): 'flux' | 'veo' { return 'veo'; }

    async createTask(payload: VeoPayload): Promise<{ taskId: string, rawData: any }> {
        const res = await kieFetch<any>('/veo/generate', { method: 'POST', body: payload });
        const taskId = res.data?.taskId || res.taskId || res.jobId || res.task_id || '';
        return { taskId, rawData: res };
    }

    async checkStatus(taskId: string): Promise<StatusResult> {
        const res = await kieFetch<any>(`/veo/record-info?taskId=${taskId}`, { method: 'GET' });
        console.log(`[VeoStrategy] Status Response for ${taskId}:`, JSON.stringify(res));
        const data = res.data || {};

        // Handle Schema Divergence (Old Status vs New SuccessFlag)
        const rawStatus = data.status;
        let status: AppStatus = 'Generating';
        let resultUrl = '';
        let errorMsg = '';

        // NEW SCHEMA: successFlag + completeTime
        if (!rawStatus && (data.successFlag !== undefined || data.completeTime !== undefined)) {
            if (!data.completeTime) {
                status = 'Generating';
            } else {
                const isSuccess = data.successFlag === 1 || data.successFlag === true || String(data.successFlag) === 'true';
                if (isSuccess) {
                    status = 'Done';
                    const rawResp = data.response;
                    let parsed: any = {};
                    if (typeof rawResp === 'string') {
                        try { parsed = JSON.parse(rawResp); } catch (e) { }
                    } else if (typeof rawResp === 'object' && rawResp !== null) {
                        parsed = rawResp;
                    }
                    resultUrl = parsed.resultUrls?.[0] || parsed.videoUrl || parsed.url || parsed.downloadUrl || parsed.images?.[0]?.url || data.url || data.downloadUrl || '';
                    if (!resultUrl && typeof rawResp === 'string' && rawResp.startsWith('http')) {
                        resultUrl = rawResp;
                    }
                } else {
                    status = 'Error';
                    errorMsg = data.errorMessage || `Error Code: ${data.errorCode}`;
                }
            }
        }
        // LEGACY SCHEMA (status string)
        else {
            const s = (rawStatus || '').toUpperCase();

            // Explicit Success
            if (['COMPLETED', 'SUCCEEDED', 'DONE'].includes(s)) {
                status = 'Done';
                resultUrl = data.videoUrl || data.url || data.images?.[0]?.url || '';
            }
            // Explicit Failure
            else if (['FAILED', 'ERROR', 'CANCELLED', 'TIMEOUT'].includes(s)) {
                status = 'Error';
                errorMsg = data.errorMessage || s || 'Generation Failed';
            }
            // Default: Assume Generating (Handles QUEUED, RUNNING, and unknown transient states)
            else {
                status = 'Generating';
                if (!['QUEUED', 'PENDING', 'RUNNING', 'CREATED', 'PROCESSING'].includes(s)) {
                    console.warn(`[VeoStrategy] Unknown status '${s}' treated as Generating.`);
                }
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

// --- FACTORY ---
export const KieClient = {
    getStrategy(type: 'flux' | 'veo'): KieStrategy {
        if (type === 'flux') return new FluxStrategy();
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
