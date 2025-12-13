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
