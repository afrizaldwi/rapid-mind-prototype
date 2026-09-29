# Repository Guidelines

## Project Structure & Module Organization

This is a Vite React prototype for RAPID-MIND.

Application code lives in `src/`, with route pages under `src/pages/` grouped by role: `admin`, `faskes`, and `relawan`.

Shared UI and flow components are in `src/components/`, role layouts in `src/components/layout/`, hooks in `src/hooks/`, Firebase/Dexie/domain helpers in `src/lib/`, protocols in `src/protocols/`, schemas in `src/schemas/`, and static data in `src/data/`.

Browser workers live in `src/workers/`.

Tests are in `tests/` and generally mirror domain modules, for example `tests/relawanManagement.test.js`.

Static assets are in `public/`; project documentation is in `docs/`.

## Repository Authority & Inspection

Before implementation work, inspect the current repository and all relevant source files.

When the user asks to verify the latest GitHub state, treat the latest remote GitHub branch as authoritative rather than relying only on prior conversation context or local assumptions.

Do not invent repository state, source behavior, test results, browser results, deployment state, or verification evidence.

Preserve unrelated user changes.

Do not perform unrelated refactors.

## Build, Test, and Development Commands

- `npm run dev`: start the local Vite development server.
- `npm test`: run the Vitest suite once.
- `npm run lint`: run Oxlint.
- `npm run build`: create a production build in `dist/`.
- `npm run preview`: serve the production build locally for smoke testing.
- `git diff --check`: check changed files for whitespace errors.

Do not install, remove, or update dependencies unless explicitly authorized.

Do not modify package versions merely to eliminate existing warnings unless explicitly requested.

## Coding Style & Naming Conventions

Use JavaScript/JSX with React functional components.

Keep components PascalCase, hooks prefixed with `use`, and helper modules camelCase, matching existing files such as `RelawanManagementPage.jsx`, `useOfflineSync.js`, and `relawanManagement.js`.

Prefer small domain helpers in `src/lib/` for Firestore/Dexie logic instead of embedding persistence or business rules directly in page components.

Follow existing formatting:

- two-space indentation;
- single quotes in most JavaScript modules;
- concise JSX class strings;
- existing repository patterns over unnecessary abstraction.

## RAPID-MIND Architecture Constraints

Preserve the existing React/Firebase/PWA architecture unless the requested task explicitly changes it.

Do not introduce:

- new dependencies;
- Cloud Functions;
- new backend services;
- unrelated infrastructure;
- Dexie schema/version changes;

unless the user explicitly authorizes or requests them.

Do not modify existing persistence contracts, historical data semantics, or role boundaries merely as cleanup.

Historical PFA, SRQ, T0, patient, Posko, referral, and other persisted snapshots must not be rewritten simply because current profile/configuration data changes.

Keep emergency T0 provenance separate from SRQ T1/T2/T3 classification.

Keep Nakes secondary-validation downgrade results separate from SRQ classification.

Do not invent:

- synthetic combined clinical risk scores;
- new clinical tiers;
- clinical wording;
- classification rules;
- Risk/Function adjustment logic;

unless explicitly defined by the project's requirements.

Implement only the requested phase/scope. Do not opportunistically implement later roadmap phases.

## Project Documentation

`docs/workflow.md` is the project's business-workflow source of truth.

Do not modify `docs/workflow.md` unless the user explicitly requests it.

Relevant implementation/status documents include:

- `docs/plan.md`
- `docs/gap-analysis.md`
- `docs/changes-notes.md`

When updating status documentation, preserve unresolved caveats unless the task actually verifies or resolves them.

Do not mark a phase COMPLETE/PASS merely because source implementation exists if its required browser/manual gate is still pending.

## Testing Guidelines

Use Vitest for unit and domain tests.

Add or update focused tests in `tests/*.test.js` when changing:

- validation;
- persistence;
- Firestore projections;
- role routing;
- workflow behavior;
- domain calculations;
- write guards.

For implementation work, run the relevant automated validation, normally:

- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`

Report exact results and distinguish new warnings from existing baseline warnings.

Automated tests, lint, build, source inspection, and mocked Firestore tests are not browser evidence.

Do not claim:

- browser validation unless it was actually performed in a browser;
- Firestore Rules deployment unless the Rules were actually deployed;
- Rules emulator verification unless emulator tests were actually run;
- runtime backend authorization merely because behavior passed under Firebase Test Mode;
- full E2E coverage unless a real E2E suite was actually executed.

## Firestore & Security Boundaries

Treat source Firestore Rules, deployed Rules, Rules Playground results, emulator tests, and runtime application behavior as separate forms of evidence.

Changing `firestore.rules` does not mean the Rules are deployed.

Firebase Test Mode behavior is not proof of backend authorization.

Do not weaken existing Rules solely to make a client-side feature pass.

Existing unresolved security caveats must remain documented until actually resolved and verified.

## Git Policy

The user alone performs all Git mutations.

Never run or instruct execution of:

- `git switch`
- `git checkout`
- `git branch`
- `git add`
- `git commit`
- `git merge`
- `git rebase`
- `git push`
- `git pull`
- `git reset`
- `git stash`

Read-only Git inspection is allowed, including:

- `git status`
- `git status --short`
- `git diff`
- `git diff --check`
- `git log`
- `git show`
- `git branch --show-current`

Do not create branches, commits, merges, or pushes.

If the user asks for a commit message, provide the message only; the user performs the commit.

## Completion Reports

After implementation, summarize:

- what changed;
- files changed;
- relevant architecture decisions;
- exact automated validation results;
- browser/manual verification status separately;
- remaining caveats;
- whether any requested scope remains pending.

Do not present planned or unverified behavior as completed evidence.