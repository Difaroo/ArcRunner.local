import { PayloadBuilder } from './PayloadBuilder';
import { PayloadBuilderVeo } from './PayloadBuilderVeo';
import { PayloadBuilderFlux } from './PayloadBuilderFlux';
import { PayloadBuilderNano } from './PayloadBuilderNano';

// Map of Builders
const builders: PayloadBuilder[] = [
    new PayloadBuilderVeo(),
    new PayloadBuilderFlux(),
    new PayloadBuilderNano()
];

export class BuilderFactory {
    static getBuilder(modelId: string): PayloadBuilder | null {
        return builders.find(b => b.supports(modelId)) || null;
    }
}
