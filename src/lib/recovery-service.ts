import { db } from '@/lib/db';
import { checkKieTaskStatus } from '@/lib/kie';

export class RecoveryService {
    /**
     * Scans for clips that are 'Generating' but might have finished or failed.
     * Reconciles their status with the provider.
     */
    async recoverAll() {
        console.log('[RecoveryService] Scanning for stuck tasks...');

        try {
            // Find all 'Generating' clips
            const generatingClips = await db.clip.findMany({
                where: { status: 'Generating' }
            });

            if (generatingClips.length === 0) {
                console.log('[RecoveryService] No pending tasks found.');
                return;
            }

            console.log(`[RecoveryService] Found ${generatingClips.length} pending tasks. Checking status...`);

            for (const clip of generatingClips) {
                // NEW LOGIC: Use 'taskId' column.
                // If 'resultUrl' exists, it might be the OLD generation, so ignore it for status checking.
                const taskId = clip.taskId;

                if (!taskId) {
                    // Legacy Fallback: Check resultUrl for TASK: prefix
                    if (clip.resultUrl && clip.resultUrl.startsWith('TASK:')) {
                        const legacyId = clip.resultUrl.replace('TASK:', '');
                        await this.checkAndRecover(clip, legacyId);
                        continue;
                    }

                    // Zombie: Generating but no Task ID
                    console.log(`[RecoveryService] Clip ${clip.id} is Generating but has no Task ID. Marking Error.`);
                    await db.clip.update({
                        where: { id: clip.id },
                        data: { status: 'Error', resultUrl: clip.resultUrl || 'ERR_ZOMBIE' } // Keep old URL if present? No, status Error implies failure.
                        // Actually, if we mark Error, maybe we should NOT touch resultUrl if it was a regen?
                        // But usually 'ERR_ZOMBIE' is useful debugging.
                        // Let's assume if it is a zombie, we just set status Error.
                    });
                    continue;
                }

                // Normal Case: Have Task ID
                await this.checkAndRecover(clip, taskId);
            }
        } catch (error) {
            console.error('[RecoveryService] Fatal error during recovery:', error);
        }
    }

    private async checkAndRecover(clip: any, taskId: string) {
        try {
            const model = clip.model || 'veo';
            const type = model.startsWith('veo') ? 'veo' : 'flux';

            const status: any = await checkKieTaskStatus(taskId, type);

            if (status.status === 'COMPLETED' || status.status === 'SUCCEEDED') {
                console.log(`[RecoveryService] Task ${taskId} completed. Updating...`);
                await db.clip.update({
                    where: { id: clip.id },
                    data: {
                        status: 'Done',
                        resultUrl: status.resultUrl
                    }
                });
            } else if (status.status === 'FAILED') {
                console.log(`[RecoveryService] Task ${taskId} failed.`);
                // On failure, we set status to Error.
                // We do NOT wipe resultUrl, so user keeps old video if this was a regen.
                await db.clip.update({
                    where: { id: clip.id },
                    data: { status: 'Error' }
                });
            } else {
                // Still processing
            }

        } catch (err) {
            console.error(`[RecoveryService] Failed to check task ${taskId}:`, err);
        }
    }

}
