# CHH Radiology Portal

## Prerequisites

- Node.js 22.x (see [.nvmrc](.nvmrc))
- npm

## Local Development

1. Install dependencies:
   `npm install`
2. Add environment variables in `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Start dev server:
   `npm run dev`

## Supabase Auth Setup

- Enable email/password sign-in in Supabase Auth providers.
- Disable email confirmation if you want immediate email login without verification.
- Enable phone sign-in and configure an SMS provider (for OTP delivery).
- Keep Google provider configured if using Google login.
- This app UI is admin-managed access only: self-sign-up is removed from the login screen.

## Scripts

- `npm run dev`: Start Vite dev server
- `npm run build`: Build production assets
- `npm run preview`: Preview the production build
- `npm run typecheck`: Run TypeScript checks
- `npm run lint`: Run ESLint checks
- `npm run test`: Run Vitest once
- `npm run test:watch`: Run Vitest in watch mode
- `npm run check`: Run required local validation (`typecheck` + `build`)
- `npm run ci`: Run full quality suite (`lint` + `typecheck` + `build` + `test`)

## Quality Gate

- CI runs on pull requests and pushes to `main`.
- Current Phase 1 required checks are:
  - `npm run typecheck`
  - `npm run build`
- `lint` and `test` run in advisory mode during baseline cleanup.
- Before merge, all checks should be green. `npm run ci` is the canonical pre-merge command.
