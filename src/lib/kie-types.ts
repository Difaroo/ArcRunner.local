export interface FluxPayload {
    model: string;
    input: any;
}

export interface VeoPayload {
    model?: string;
    input?: any;
    [key: string]: any;
}

export type AppStatus = 'Generating' | 'Done' | 'Error';
