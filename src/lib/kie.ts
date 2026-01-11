import { KieClient } from './kie-strategies';
import { FluxPayload, VeoPayload, NanoPayload, KlingPayload, AppStatus } from './kie-types';

export type { FluxPayload, VeoPayload, NanoPayload, KlingPayload, AppStatus };

// Delegate create functions
/**
 * Creates a Flux Task via Strategy
 */
export async function createFluxTask(payload: FluxPayload) {
    return KieClient.getStrategy('flux').createTask(payload);
}

// Delegate create functions
/**
 * Creates a Veo Task via Strategy
 */
export async function createVeoTask(payload: VeoPayload) {
    return KieClient.getStrategy('veo').createTask(payload);
}

/**
 * Creates a Nano Task via Strategy
 */
export async function createNanoTask(payload: NanoPayload) {
    // MOCK_MODE for Testing
    if (process.env.MOCK_KIE === 'true') {
        console.log('[Kie] MOCK MODE: createNanoTask returning fake ID');
        return { taskId: 'MOCK-TASK-' + Date.now(), rawData: { mock: true } };
    }
    return KieClient.getStrategy('nano').createTask(payload);
}

/**
 * Creates a Kling Task via Strategy
 */
export async function createKlingTask(payload: KlingPayload) {
    return KieClient.getStrategy('kling').createTask(payload);
}

/**
 * Uploads a file to Kie.ai temp storage (Base64)
 */
export const uploadFileBase64 = KieClient.uploadFileBase64;

/**
 * Checks the status of a task using the appropriate strategy
 */
export async function checkKieTaskStatus(taskId: string, type: 'flux' | 'veo' | 'nano' | 'kling') {
    return KieClient.getStrategy(type).checkStatus(taskId);
}
