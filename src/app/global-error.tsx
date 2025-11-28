'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
                    <h2 className="text-2xl font-bold mb-4">Critical Error</h2>
                    <p className="mb-4 text-gray-300">{error.message}</p>
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-white text-black font-bold rounded hover:bg-gray-200"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
