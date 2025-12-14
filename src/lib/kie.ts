import { KieClient } from './kie-strategies';
import { FluxPayload, VeoPayload, AppStatus } from './kie-types';

export type { FluxPayload, VeoPayload, AppStatus };

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
 * Uploads a file to Kie.ai temp storage (Base64)
 */
export const uploadFileBase64 = KieClient.uploadFileBase64;

/**
 * Checks the status of a task using the appropriate strategy
 */
export async function checkKieTaskStatus(taskId: string, type: 'flux' | 'veo') {
    return KieClient.getStrategy(type).checkStatus(taskId);
}
