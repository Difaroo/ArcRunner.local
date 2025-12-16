import { RecoveryService } from '@/lib/recovery-service';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const recovery = new RecoveryService();
        // Run scan asynchronously to not block startup
        recovery.recoverAll().catch(err => {
            console.error('[Instrumentation] Recovery service failed:', err);
        });
    }
}
