# ArcRunner & Antigravity Transfer Instructions

This guide outlines the steps to transfer your ArcRunner development environment and the Antigravity agent to your new MacBook.

## 1. Preparation on New MacBook

Before transferring files, ensure the new machine has the necessary base software installed.

### Software Prerequisites
1.  **Node.js (v18)**: The project is configured for Node.js 18.
    *   Recommended: Use `nvm` (Node Version Manager) to install it.
    *   Command: `nvm install 18` and `nvm use 18`.
2.  **Git**: Ensure git is installed (`git --version`).
3.  **VS Code / Editor**: Install your preferred editor.
4.  **Antigravity**: Install the Antigravity application or extension (however you originally installed it).

### Important Note on Paths
*   **Username**: Ideally, create the user account on the new Mac with the exact same username (`davidfennell`). This ensures absolute paths (if any exist in configs) remain valid.
*   **File Location**: You should place the transferred files in the exact same location: `/Users/davidfennell/.gemini/antigravity`.

## 2. File Transfer (What to Copy)

You mentioned you are using a Thunderbolt cable. You need to copy the entire **Antigravity Data Directory**.

*   **Source**: `/Users/davidfennell/.gemini/antigravity`
*   **Destination**: `/Users/YOUR_NEW_USERNAME/.gemini/antigravity` (Create the `.gemini` folder if it doesn't exist).

> **Note**: The `.gemini` folder is hidden. You can toggle hidden files in Finder with `Cmd + Shift + .` (period).

This folder contains:
*   `workspaces/arcrunner-local`: Your project source code, database (`dev.db`, `prod.db`), and local environment variables.
*   `brain`: The agent's memory, conversation history, and artifacts.

## 3. Project Re-hydration (On New Mac)

Once the folder is copied, you need to refresh the dependencies to match the new machine's architecture (especially if moving from Intel to Apple Silicon, or just to be safe).

Open your terminal on the new Mac and run the following commands:

```bash
# 1. Navigate to the project folder
cd ~/.gemini/antigravity/workspaces/arcrunner-local

# 2. Re-install Dependencies (Clears out old binaries)
rm -rf node_modules
npm install

# 3. Regenerate Database Client
# This ensures the Prisma client matches the new system's OpenSSL version
npx prisma generate
```

## 4. Verification

Start the web server to confirm everything is working.

```bash
# Start the development server
npm run dev
```

*   Open `http://localhost:3000` in your browser.
*   Check that your data (Clips, Studio items) is present.
*   Check that Antigravity (the agent) can see the workspace.

## Troubleshooting

*   **Database Errors**: If you see errors about "Query engine library", run `npx prisma generate` again.
*   **Environment Variables**: Your `.env` files are included in the transfer (inside the project folder), so secrets should work immediately.
*   **Antigravity not seeing project**: Ensure the path is exactly `~/.gemini/antigravity/workspaces/arcrunner-local`.
