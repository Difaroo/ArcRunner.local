import { PayloadBuilder } from './PayloadBuilder';
import { PayloadBuilderVeo } from './PayloadBuilderVeo';
import { PayloadBuilderFlux } from './PayloadBuilderFlux';
import { PayloadBuilderNano } from './PayloadBuilderNano';
import { PayloadBuilderKling } from './PayloadBuilderKling';

// Map of Builders
const builders: PayloadBuilder[] = [
    new PayloadBuilderVeo(),
    new PayloadBuilderFlux(),
    new PayloadBuilderNano(),
    new PayloadBuilderKling()
];

export class BuilderFactory {
    static getBuilder(modelId: string): PayloadBuilder | null {
        return builders.find(b => b.supports(modelId)) || null;
    }
}
