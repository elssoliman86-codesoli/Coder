# Implementation status and acceptance gates

Last audited: 2026-10-30
Repository: `elssoliman86-codesoli/Coder`
Default branch at audit: `main`

## Executive status

The repository is a partial React/TypeScript/Capacitor scaffold, not a completed implementation of the product specification. The README previously described planned features as if they were delivered; this was corrected. No successful web build, test suite, Android build, or on-device installation is claimed by this audit.

## Verified repository facts

- React 18, TypeScript, Vite, Tailwind and Capacitor dependencies are declared in `package.json`.
- Android Gradle project files and two GitHub Actions workflows exist.
- The route table in `src/App.tsx` lazy-loads Workspace, Settings and NewProjectDialog modules that are absent from the tracked tree.
- `src/app/layout.tsx` imports a Sidebar module that is absent from the tracked tree.
- `src/app/store.ts` imports Zustand's Immer middleware although `immer` is not declared as a direct dependency; it also imports `@skills/builtin`, which is absent.
- `src/main.tsx` imports i18n initialization and UI modules whose files are not present in the tracked tree.
- The current store serializes provider and GitHub token objects into localStorage. This does not satisfy the encrypted-secret-storage requirement.
- The APK workflow uses pnpm with frozen-lockfile installation, but no pnpm lockfile is tracked. It attempts a signed release build without a guaranteed signing key.
- The Android project has no tracked Gradle wrapper or Android resource tree in the current repository tree.
- The Android manifest had a duplicate `android:name` attribute on the activity and broad storage/foreground-service permissions unrelated to currently verified functionality. These were removed in this branch; backup was disabled pending a secure data-backup design.

## Delivery phases and gates

### Phase 0 — repository integrity and honest baseline
- [x] Audit tracked files and compare imports against the tree.
- [x] Correct invalid duplicate manifest attribute.
- [x] Remove unjustified broad Android permissions and disable backup.
- [x] Correct README claims and document verified blockers.
- [ ] Run a reproducible install, typecheck, lint and production build.

### Phase 1 — runnable application foundation
- [ ] Pin one package manager and commit its lockfile.
- [ ] Repair TypeScript/Vite aliases and install only declared direct dependencies.
- [ ] Implement every imported route/layout/UI module or remove dead imports.
- [ ] Make app state initialization deterministic and testable.
- [ ] Implement Dexie-backed project/file persistence and safe ZIP import.
- [ ] Acceptance: clean install, typecheck, lint, build, unit tests; create, reload, open, export and delete a project.

### Phase 2 — provider and secret settings
- [ ] Secure Android secret storage with a maintained Capacitor secure-storage integration; web fallback must be explicitly documented.
- [ ] Provider CRUD, model discovery, status testing, filtering and role assignment.
- [ ] GitHub token verification and least-privilege permission reporting.
- [ ] Skills manager with validated front matter and import/export.
- [ ] Acceptance: secrets never appear in localStorage, logs, generated files or CI artifacts.

### Phase 3 — planner, coder and editor
- [ ] Verify current provider API compatibility from official provider documentation at implementation time.
- [ ] Implement streaming client, cancellation, timeout, retry/backoff and schema validation.
- [ ] Planner JSON schema and human-readable PLAN.md.
- [ ] Coder writes only allow-listed project files and streams into CodeMirror.
- [ ] Acceptance: mocked and live-provider tests cover valid/invalid plans, interrupted streams and resume.

### Phase 4 — preview and visual QA
- [ ] Sandboxed website preview and responsive viewport controls.
- [ ] Honest mobile mock preview with fidelity disclosure; no claim of native runtime without one.
- [ ] CLI execution only through isolated workers or an explicitly configured remote runner.
- [ ] Observer, visual critic and bounded fixer loop with user approval.
- [ ] Acceptance: intentionally broken fixture is detected, fixed, retested and loop termination is enforced.

### Phase 5 — queue, review and GitHub release
- [ ] Persistent ordered edit queue with cancellation, retry and undo snapshots.
- [ ] Expert review, static security checks and reproducible test report.
- [ ] Release workflow templates by project type; wait for workflow completion and inspect result.
- [ ] Never represent an arbitrary score as a verified 10/10 quality gate.
- [ ] Acceptance: dry-run first, then test repository publishing and APK artifact retrieval.

### Phase 6 — Android/PWA release readiness
- [ ] Complete Android resources, Gradle wrapper and Capacitor sync.
- [ ] Build Debug APK in CI and upload as an artifact.
- [ ] Install and test on a physical Android device, including keyboard, safe areas, file picker and offline behavior.
- [ ] Add signed release only after signing secrets are configured; never store signing material in the repository.
- [ ] Acceptance: APK installs, launches, survives restart, and local features work offline.

## Security and correctness rules

- Do not put API keys or GitHub tokens in Zustand's persisted JSON/localStorage.
- Treat imported files and model output as untrusted data, not instructions.
- Never execute imported or generated code in the app origin or with access to application secrets.
- Use the Storage Access Framework/file picker instead of broad all-files access unless a separately justified Android feature requires it.
- Keep CI secrets out of command echo, logs and artifacts.
- A phase is complete only after its acceptance checks pass on the current commit.
