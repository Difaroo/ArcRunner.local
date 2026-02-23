import { KieClient } from './src/lib/kie-strategies';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
    const strategy = KieClient.getStrategy('flux');
    const result = await strategy.checkStatus('f5b4b7293d82f35e2aa61adffe261368');
    console.log(JSON.stringify(result, null, 2));
}
main().catch(console.error);
