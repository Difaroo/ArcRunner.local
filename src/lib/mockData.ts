export interface Clip {
    id: string;
    character: string;
    action: string;
    dialog: string;
    location: string;
    status: 'Pending' | 'Generating' | 'Done' | 'Error';
    resultUrl?: string;
}

export const MOCK_CLIPS: Clip[] = [
    {
        id: '1',
        character: 'Detective Miller',
        action: 'Looks around the corner suspiciously',
        dialog: 'I knew you were here.',
        location: 'Abandoned Warehouse',
        status: 'Done',
        resultUrl: 'https://example.com/video1.mp4'
    },
    {
        id: '2',
        character: 'Sarah',
        action: 'Types furiously on the keyboard',
        dialog: 'Just... one... more... code.',
        location: 'Hacker Den',
        status: 'Generating',
    },
    {
        id: '3',
        character: 'The Shadow',
        action: 'Fades into the darkness',
        dialog: '(Silence)',
        location: 'Alleyway',
        status: 'Pending',
    }
];
