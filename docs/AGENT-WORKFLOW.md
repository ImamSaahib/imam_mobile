# Agent workflow and documentation map

## Authority and document ownership

Current owner instructions take precedence. Decisions records explain approved choices; contracts define implementation invariants; architecture defines boundaries; stories define scope and acceptance. Code/tests/deployment evidence establish what actually exists. If they disagree, record and resolve the discrepancy; do not silently weaken a contract or mark acceptance complete.

| Document | Owns | Read when |
|---|---|---|
| HANDOFF | Current state, next slice, unresolved dependencies | Every new session |
| platform/README | Product vision, phase scope, distribution model | First onboarding or product-scope change |
| platform/ARCHITECTURE | Runtime layers, extension/configuration boundaries | First onboarding; relevant sections for boundary changes |
| platform/DECISIONS | Approved choices and owner direction | First onboarding; changed/relevant decisions afterward |
| platform/IMPLEMENTATION-CONTRACTS | Normative interfaces, invariants and budgets | Relevant sections before implementation |
| platform/stories/* | Scope, acceptance, canonical implementation/test evidence | Active story and affected dependency criteria |
| platform/UI-REFERENCE | Visual/interaction target | UI work |
| platform/MIGRATIONS | Schema change and deployment process | Migration/schema work |
| TIMELINE | Dependency order and short milestone history | Choosing the next story or changing status |
| HANDOFF-HISTORY | Dated operational snapshot | Investigating historical behavior only |

Do not read every story or the full historical log for routine continuation. Search headings first, then read the complete relevant sections; expand context for cross-cutting changes. Do not omit applicable requirements merely to save tokens.

## Task routing

- UI shell/navigation: Story 00/02, UI-REFERENCE, Contracts §7, §9–10 and Decisions D20.
- Metadata/bootstrap/seeds: Story 01/02, Contracts §2, §12; architecture configuration/release sections.
- Properties/schema: Story 04, Contracts §3, §8; MIGRATIONS.
- Lists/forms/domain writes: Stories 05/06, Contracts §1, §3, §9–10; counters/version-bump rules and legacy inventory.
- Edit mode/publishing: Stories 03/07/09, Contracts §7, §12.
- Security/release/client forks: Stories 11/10, Contracts §5–6, §11; Decisions C8–C10 and deployment/README.md.

## Delivery rules

1. Inspect git status and existing changes. Implement directly on development in cohesive commits; no routine feature branches or PRs (C10). No history rewrite or force push.
2. Main and production resources require explicit owner approval. Use test data only in development. Never commit secrets or embed them in browser variables. Do not change branch protection without authorization.
3. Follow the documented automatic Cloudflare deployment/migration process. Never manually deploy Workers or run remote migrations. Use Wrangler for authorized read-only Cloudflare validation; verify targets. Applied migrations are immutable.
4. Preserve existing workflows. Do not introduce unrelated refactors or optional work. Make reversible decisions independently; ask only for missing required resources, consequential hard-to-reverse choices or explicit authorization.
5. Story 11 is the security gate: dev-open is development-only, not a production authentication solution. Never copy development test data into client/production databases.

## Validation checkpoints

| Change | Required approach |
|---|---|
| Documentation/branch maintenance only | Diff, links and consistency; no repeat application tests |
| Localized implementation | Targeted tests of behavior/risk while iterating |
| Stable frontend slice | TypeScript, frontend check/build/budget; browser scenarios affected by UI interaction/layout changes |
| Stable backend slice | Backend check and affected API/workflow regressions |
| Schema/release changes | Migration/compatibility/recovery and budget checks required by contracts; verify through documented pipeline |

Use existing tests first. Add tests for meaningful new behavior, failure modes and regressions, not trivial implementation mirrors. Batch related tests; do not rerun unchanged successful suites unless code changes, failures or unresolved risks justify it. Install dependencies only when absent or the lockfile changes. CI remains a final gate; never bypass a failure to save time.

Commands: frontend npm run check and npm run test:browser; backend npm run check, each in its directory. Use package scripts as the current command source. Existing pipeline may run broader checks automatically; do not disable it merely because local work was narrow.

## Documentation updates

- Update the active story status/acceptance and one evidence entry: behavior, validation/commit, migration/resource impact, limitations and recovery.
- Update HANDOFF only for changed current state/next work; TIMELINE gets one short milestone, not copied logs.
- Change DECISIONS only for durable decisions; change contracts/architecture only when an approved boundary/invariant changes. Documentation cleanup does not authorize architectural redesign.
- Preserve historical evidence and decision IDs/section anchors. Label dated observations as historical. Do not present a fixture as integrated runtime behavior or unchecked acceptance as complete.
- End with changed/passed/pending/next, concisely. Never fabricate commit authorship or tool-specific trailers.
