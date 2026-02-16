import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
    try {
        // AppleScript to open a folder picker dialog
        // - "choose folder": Native macOS dialog
        // - "with prompt": Custom title
        // - "POSIX path of": Convert Mac path (Macintosh HD:Users:...) to Unix path (/Users/...)
        const appleScript = `
            tell application "System Events"
                activate
                set theFolder to choose folder with prompt "Choose destination for episode movies"
                return POSIX path of theFolder
            end tell
        `;

        const { stdout } = await execAsync(`osascript -e '${appleScript}'`);

        // Trim newline from result
        const path = stdout.trim();

        if (!path) {
            return NextResponse.json({ error: 'No folder selected' }, { status: 400 });
        }

        return NextResponse.json({ path });
    } catch (error: any) {
        console.error('Folder picker error:', error);
        // User cancelled dialog throws an error in osascript
        if (error.stderr && error.stderr.includes('User canceled')) {
            return NextResponse.json({ cancelled: true }, { status: 200 });
        }
        return NextResponse.json({ error: 'Failed to open folder picker' }, { status: 500 });
    }
}
