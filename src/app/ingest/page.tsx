'use client';

import { useState } from 'react';

export default function IngestPage() {
    const [clipsJson, setClipsJson] = useState('');
    const [libraryJson, setLibraryJson] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleSave = async () => {
        setStatus(null);
        if (!clipsJson && !libraryJson) {
            setStatus({ type: 'error', message: 'Please paste JSON for Clips or Library.' });
            return;
        }

        let parsedClips = [];
        let parsedLibrary = [];

        try {
            if (clipsJson) parsedClips = JSON.parse(clipsJson);
            if (libraryJson) parsedLibrary = JSON.parse(libraryJson);
        } catch (e) {
            setStatus({ type: 'error', message: 'Invalid JSON format. Please check your input.' });
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clips: parsedClips, library: parsedLibrary }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to save');

            setStatus({ type: 'success', message: `Saved! ${data.clipsCount} clips and ${data.libraryCount} library items added.` });
            setClipsJson('');
            setLibraryJson('');
        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen p-8 font-sans text-white">
            <header className="mb-8 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Ingest JSON</h1>
                <a href="/" className="text-gray-400 hover:text-white">← Back to Dashboard</a>
            </header>

            <div className="grid grid-cols-2 gap-8 h-[calc(100vh-200px)]">
                {/* Clips Input */}
                <div className="flex flex-col space-y-2">
                    <label className="font-bold text-lg">Clips JSON</label>
                    <textarea
                        value={clipsJson}
                        onChange={(e) => setClipsJson(e.target.value)}
                        className="flex-1 p-4 bg-black/20 border border-gray-600 rounded text-white font-mono text-xs resize-none focus:border-white outline-none"
                        placeholder='[ { "Scene #": "1.1", "Title": "..." }, ... ]'
                    />
                </div>

                {/* Library Input */}
                <div className="flex flex-col space-y-2">
                    <label className="font-bold text-lg">Library JSON</label>
                    <textarea
                        value={libraryJson}
                        onChange={(e) => setLibraryJson(e.target.value)}
                        className="flex-1 p-4 bg-black/20 border border-gray-600 rounded text-white font-mono text-xs resize-none focus:border-white outline-none"
                        placeholder='[ { "Type": "LIB_CHARACTER", "Name": "..." }, ... ]'
                    />
                </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
                <div className="text-sm">
                    {status && (
                        <span className={status.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                            {status.message}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 bg-white text-midgrey font-bold rounded hover:bg-gray-200 disabled:opacity-50 transition"
                >
                    {isSaving ? 'Saving to Sheets...' : 'Save to Google Sheets'}
                </button>
            </div>
        </div>
    );
}
