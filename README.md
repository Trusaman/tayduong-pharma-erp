# tayduong-pharma-erp

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Convex** - Reactive backend-as-a-service platform
- **Authentication** - Better-Auth
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
pnpm run dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Copy environment variables from `packages/backend/.env.local` to `apps/*/.env`.

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Your app will connect to the Convex cloud backend automatically.

## Git Hooks and Formatting

- Format and lint fix: `pnpm run check`

## Project Structure

```
tayduong-pharma-erp/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
├── packages/
│   ├── backend/     # Convex backend functions and schema
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:setup`: Setup and configure your Convex project
- `pnpm run backup`: Create a full Convex backup (tables + file storage)
- `pnpm run backup:light`: Create a data-only Convex backup (tables only)
- `pnpm run backup:restore`: Restore Convex data from backup snapshot
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Biome formatting and linting

## Backup

This project includes a built-in backup command for Convex data.

```bash
pnpm run backup
```

Backups are exported into `backups/<timestamp>/` at the project root.
Convex will create a snapshot `.zip` file inside that timestamp folder.

- `backup`: exports tables and file storage
- `backup:light`: exports tables only (without file storage)

You can forward extra Convex export flags after `--`.

```bash
pnpm run backup -- --prod
```

To restore, use Convex import/restore tooling with the exported artifacts.

```bash
pnpm run backup:restore
```

`backup:restore` will auto-pick the latest `.zip` snapshot from `backups/`.
You can specify a snapshot file or timestamp folder explicitly:

```bash
pnpm run backup:restore -- backups/2026-03-14T16-35-44-064Z
pnpm run backup:restore -- backups/2026-03-14T16-35-44-064Z/snapshot_xxx.zip --replace
```

You can also forward Convex import flags after `--` (for example `--replace`, `--prod`, `--yes`, `--env-file`).
If a flag expects a value, pass the value right after the flag.
