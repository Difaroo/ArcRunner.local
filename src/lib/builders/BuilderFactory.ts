import { PayloadBuilder } from './PayloadBuilder';
import { VeoPayloadBuilder } from './VeoPayloadBuilder';

// Map of Builders
const builders: PayloadBuilder[] = [
    new VeoPayloadBuilder(),
    // Future: new FluxPayloadBuilder()
];

export class BuilderFactory {
    static getBuilder(modelId: string): PayloadBuilder | null {
        return builders.find(b => b.supports(modelId)) || null;
    }
}
