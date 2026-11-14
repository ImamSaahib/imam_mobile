# Development handoff

Updated: 2026-11-14. Read this first, then [agent workflow](AGENT-WORKFLOW.md) and the active story. This is a current-state summary, not a second requirements document.

## Current state

- Work directly on development (Decision C10). Only development and main remain; completed feature work, including PR #12, is consolidated. Main is unchanged and requires explicit production approval.
- Story 00: Kumo/Phosphor foundation, responsive shell/navigation, table controls/states, central context menu, dialog, side panel, toasts and shared states are implemented in the development-only /__ui gallery, styled with design tokens measured from the reference (tokens.css). Production screens still use the legacy runtime.
- Story 01: backend slices 01a–01d implemented. Published-metadata shell integration, final workflow/deployment acceptance and interrupted-operation recovery evidence remain open.
- Story 02: [Hosted Dev navigation preview](https://imam-mobile-dev.pages.dev/__platform) verified against live bootstrap. Stable module links survive reload. Page bodies remain placeholders; `/` serves existing workflows. Focus revalidation and governor notices are implemented.
- Story 04: implemented with explicitly deferred criteria; consult its review before dependent work. Other stories are planned in TIMELINE order.
- Last feature validation: frontend 12 helper and 29 component tests (41 total) and 17 Chromium scenarios, TypeScript/build and 69.1 KiB gzip gate; backend baseline 283 tests (not rerun on 2026-11-14). These are recorded results, not a guarantee about future commits.

## Next cohesive slice

Light-theme tokens are measured and applied (see Story 00, 2026-11-13). Next: close the remaining Story 00 acceptance gaps (pagination sizing, icon sizes, per-primitive state coverage, dark-theme review; RTL testing is out of scope), then integrate the shell with Story 02's published navigation at runtime. Do not reopen the resolved Worker-preview investigation or recreate branches.

## Open dependencies and observations

- Original Cloudflare reference received privately; keep account details out of Git. Light-theme tokens are measured; dark theme has no reference and uses Kumo semantics.
- Dev D1 migrations 0001–0009 were confirmed on 2026-11-12. Seed v2 was confirmed; seed v3 upgrade confirmation remains open. Recheck only when relevant; never infer current remote state from these dated observations.
- Dev Worker: https://imam-mobile-api-dev.imamsaahib.workers.dev; dev D1: imam-mobile-dev-db. Verify environment bindings/configuration before remote reads; do not infer production targets from a Pages project name.
- Role choices and password-hashing spike belong to Story 11. Reference-dataset assumptions remain in Contracts §9.

## Sources

- [Product vision](platform/README.md), [decisions](platform/DECISIONS.md), [contracts](platform/IMPLEMENTATION-CONTRACTS.md).
- [Story 00](platform/stories/00-ui-shell-design-system.md), [Story 01](platform/stories/01-platform-foundation.md), [Story 04](platform/stories/04-data-model-properties.md).
- [Sequence and milestones](TIMELINE.md), [migration process](platform/MIGRATIONS.md), [historical operational notes](HANDOFF-HISTORY.md).

Update this summary only when current state, next work or dependencies change. Detailed evidence belongs in the story; do not append session transcripts here.
