# Local Dev/Prod Setup Walkthrough

We have successfully migrated the application to a **Local Dual-Environment** setup. This ensures that active development does not impact the stable "Production" version of the app.

## 1. Environment Architecture

| Environment | Port | Database | Build Artifacts | Command |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | `3000` | `prisma/dev.db` | `.next-dev` | `npm run dev` |
| **Production** | `3001` | `prisma/prod.db` | `.next` | `npm run start` |

## 2. Key Changes

### Database Isolation
- **`dev.db`**: The working database for new features.
- **`prod.db`**: A stable clone for the production app.
- Configured via `.env.development` and `.env.production`.

### Build Isolation
- Modified `next.config.js` to use different `distDir` folders (`.next-dev` vs `.next`) based on `NODE_ENV`. This prevents the development server from overwriting or corrupting the production build.

### Script Updates
- **Checking Scripts**: Several utility scripts in `scripts/` were excluded from the TypeScript build check (`tsconfig.json` exclude) to ensure a stable production build despite legacy type errors in those external tools.

## 3. How to Run

### Development
1. Open a terminal.
2. Run: `npm run dev`
3. Access: [http://localhost:3000](http://localhost:3000)

### Production
1. Open a separate terminal.
2. Run: `npm run start`
3. Access: [http://localhost:3001](http://localhost:3001)

## 4. Verification

- [x] **Production Server**: Verified running on Port 3001. Connection to `prod.db` established.
- [x] **Development Server**: Verified running on Port 3000. Connection to `dev.db` established.
- [x] **Build Isolation**: Ran `npm run build` successfully. Confirmed separate `.next` and `.next-dev` directories exist.

> [!IMPORTANT]
> If you make schema changes in Development (`prisma migrate dev`), remember to deploy them to Production manually using `npx prisma migrate deploy` (pointing to the prod DB env) when ready to promote features.

## 5. Database Migration Workflow
We have established a migration pipeline to safely promote schema changes from Dev to Prod.

1.  **Edit Schema**: Modify `prisma/schema.prisma`.
2.  **Update Dev**: Run `npm run migrate:dev` (or the raw command if preferred).
    *   *Note: We baselined the DBs, so standard usage applies.*
3.  **Deploy to Prod**: Run `./scripts/deploy-migration.sh`.
    *   This script safely loads `.env.production` and applies pending migrations to `prod.db`.

## 6. Server Management

### 🔄 Restarting the Stack
We have a [helper script](../scripts/restart-stack.sh) to safely kill existing processes (ports 3000/3001), rebuild Production, and restart both environments.

```bash
./scripts/restart-stack.sh
```

### 📜 Checking Logs
- **Development**: View in your active terminal.
- **Production**: Run `tail -f production.log` to watch real-time logs.

### 🛠️ Helper Commands (package.json)
- `npm run migrate:dev`: Create/Apply migration to Dev DB.
- `npm run migrate:deploy`: Apply pending migrations to Prod DB ([Script Source](../scripts/deploy-migration.sh)).


