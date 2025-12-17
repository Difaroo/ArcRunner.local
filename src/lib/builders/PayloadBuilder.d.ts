import { GenerateTaskInput } from '@/lib/generate-manager';

export interface GenerationContext {
    input: GenerateTaskInput;
    publicImageUrls: string[];
}

export interface PayloadBuilder {
    supports(modelId: string): boolean;
    build(context: GenerationContext): any;
}
