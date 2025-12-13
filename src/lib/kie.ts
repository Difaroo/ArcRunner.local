const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_BASE_URL = 'https://api.kie.ai/api/v1';

export interface FluxPayload {
    model: string;
    input: {
        prompt: string;
        aspect_ratio?: string;
        resolution?: string;
        input_urls?: string[];
        strength?: number;
        [key: string]: any;
    };
}

export interface VeoPayload {
    prompt: string;
    model: string;
    aspectRatio?: string;
    imageUrls?: string[];
    generationType?: 'REFERENCE_2_VIDEO' | 'TEXT_2_VIDEO';
    enableFallback?: boolean;
    enableTranslation?: boolean;
    [key: string]: any;
}

interface KieResponse<T = any> {
    data?: T;
    error?: { message: string };
    msg?: string;
    [key: string]: any;
}

async function kieFetch<T>(endpoint: string, options: { method: 'POST' | 'GET', body?: any }): Promise<KieResponse<T>> {
    const { method, body } = options;
    const url = endpoint.startsWith('http') ? endpoint : `${KIE_BASE_URL}${endpoint}`;

    const res = await fetch(url, {
        method,
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || data.msg || JSON.stringify(data) || `Failed to call Kie.ai ${endpoint}`);
    }

    return data;
}

export async function createFluxTask(payload: FluxPayload) {
    return kieFetch<{ taskId: string }>('/jobs/createTask', { method: 'POST', body: payload });
}

export async function createVeoTask(payload: VeoPayload) {
    return kieFetch<{ taskId: string }>('/veo/generate', { method: 'POST', body: payload });
}

export async function getFluxTask(taskId: string) {
    return kieFetch<{ state: string, resultJson?: string }>(`/jobs/recordInfo?taskId=${taskId}`, { method: 'GET' });
}

export async function getVeoTask(taskId: string) {
    return kieFetch<{
        status: string,
        videoUrl?: string,
        url?: string,
        images?: { url: string }[],
        failureReason?: string,
        msg?: string,
        error?: string
    }>(`/veo/record-info?taskId=${taskId}`, { method: 'GET' });
}

export async function uploadFileBase64(base64Data: string, fileName?: string) {
    // Uses /api/file-base64-upload endpoint (Note: NO /v1 prefix based on docs)
    // We use absolute URL to bypass the default /api/v1 base
    return kieFetch<{ url: string }>('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        body: { base64Data, fileName, uploadPath: "temp_uploads" }
    });
}

export type AppStatus = 'Generating' | 'Done' | 'Error';

export async function checkKieTaskStatus(taskId: string, type: 'flux' | 'veo'): Promise<{ status: AppStatus, resultUrl?: string, errorMsg?: string }> {
    try {
        let status: AppStatus = 'Generating';
        let resultUrl = '';
        let errorMsg = '';

        if (type === 'flux') {
            const res = await getFluxTask(taskId);
            const state = (res.data?.state || '').toLowerCase();

            // Flux Normalization
            const activeStates = ['queued', 'generating', 'processing', 'created', 'starting'];
            if (activeStates.includes(state)) {
                status = 'Generating';
            } else if (['success', 'succeeded', 'completed', 'done'].includes(state)) {
                status = 'Done';
                // URL Extraction Logic
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
        } else {
            const res = await getVeoTask(taskId);
            const s = res.data?.status || '';

            // Veo Normalization
            const activeStates = ['QUEUED', 'PENDING', 'RUNNING', 'CREATED', 'PROCESSING'];
            const successStates = ['COMPLETED', 'SUCCEEDED'];

            if (activeStates.includes(s)) {
                status = 'Generating';
            } else if (successStates.includes(s)) {
                status = 'Done';
                resultUrl = res.data?.videoUrl || res.data?.url || res.data?.images?.[0]?.url || '';
            } else {
                status = 'Error';
                errorMsg = res.data?.failureReason || res.data?.msg || res.data?.error || s;
            }
        }

        // Universal URL Check
        if (status === 'Done' && !resultUrl) {
            status = 'Error';
            errorMsg = errorMsg || 'MISSING_URL';
        }

        return { status, resultUrl, errorMsg };

    } catch (e: any) {
        const msg = e.message || '';
        // ZOMBIE / 404 Check
        if (msg.includes('404') || msg.includes('Not Found') || msg.includes('does not exist')) {
            return { status: 'Error', errorMsg: `POLL_ERR: ${msg}` };
        }
        // Transient Error (Network/Timeout) -> Assume logic should retry later
        console.warn(`Transient Poll Error for ${taskId}:`, e);
        // Return Generating allows the system to retry next loop without updating sheet
        return { status: 'Generating' };
    }
}
