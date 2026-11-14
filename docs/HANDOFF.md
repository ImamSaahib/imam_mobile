# Development handoff

Updated: 2026-11-14. Read this first, then [agent workflow](AGENT-WORKFLOW.md) and the active story. This is a current-state summary, not a second requirements document.

## Current state

- Work directly on development (Decision C10). Only development and main remain; completed feature work, including PR #12, is consolidated. Main is unchanged and requires explicit production approval.
- Story 00: Kumo/Phosphor foundation, responsive shell/navigation, table controls/states, central context menu, dialog, side panel, toasts and shared states are implemented in the development-only /__ui gallery, styled with design tokens measured from the reference (tokens.css). Production screens still use the legacy runtime.
- Story 01: backend slices 01a–01d implemented. The Dev preview consumes published bootstrap metadata. Final workflow/deployment acceptance and interrupted-operation recovery evidence remain open.
- Story 02: [Hosted Dev navigation preview](https://imam-mobile-dev.pages.dev/__platform) verified against live bootstrap. Stable module links survive reload. Pages support published heading and text blocks. The seeded dashboard summary reads maintained device counters. `/` serves existing workflows. Story 05 has begun: the backend keyset page read `GET /api/devices/page` exists and the published Inventory list renders from it (first page, Next, Previous; search and sorting are inert or absent). Other seeded lists still show an unavailable message. Focus revalidation and governor notices are implemented.
- Story 04: implemented with explicitly deferred criteria; consult its review before dependent work. Other stories are planned in TIMELINE order.
- Feature baseline `4ba2e4a` on development passed [GitHub CI](https://github.com/ImamSaahib/imam_mobile/actions/runs/43615557279), 284 backend tests and both built-preview Chromium scenarios. Preview JS measured 173.9 KiB gzip. The last hosted smoke check covered navigation. The dashboard and its Worker endpoint still need a hosted Dev check.

## Next agent — Inventory list

1. Check the current development tip and working tree for intervening work. On the [Dev preview](https://imam-mobile-dev.pages.dev/__platform), open Dashboard and check whether the summary renders and the Dev Worker returns a successful `GET /api/devices/summary`. Record deployment or runtime failures separately from CI. The owner confirmed on 2026-11-14 that the Dashboard summary renders on the Dev preview. Agent sessions cannot reach `pages.dev` or `workers.dev` (egress proxy returns 403). The owner also confirmed on 2026-11-15, from a screenshot, that the Dev preview Inventory list loads two real devices ("Showing 1–2 of 2") from the Dev Worker, so `/api/devices/page` is deployed there. Not yet seen on the hosted Dev preview: a multi-page list (more than 25 devices), Next/Previous against real data, and the error state.
2. Start with the published Inventory list. Read [Story 05](platform/stories/05-list-view-engine.md), [UI reference](platform/UI-REFERENCE.md) and Contracts §§1, 3, 9–10. Trace the seeded list’s `config.dataSourceId` from [seed configuration](../applications/imam-mobile/seed/package.ts) into [PageContent](../frontend/src/platform/pages/PageContent.tsx). The ID is opaque.
3. Next small piece for Story 05, pick one: (a) previous/last and a safer cursor trail after refresh, or (b) server-side search with the 2-character minimum and indexed prefix rule from [Story 05](platform/stories/05-list-view-engine.md) items 2 and 21, enabling the list's search field, or (c) opening a row in the side panel. Then sorting and filters, `ETag`, governor cache behavior, and the same page read for Customers, entries and sales. Keep each session to one piece with tests and a built-preview check.
4. Story 00 still needs pagination and icon sizing, per-primitive state coverage and dark-theme review. See the [Story 00 acceptance criteria](platform/stories/00-ui-shell-design-system.md). Preserve the existing workflows at `/` during migration.

## Open dependencies and observations

- Original Cloudflare reference received privately; keep account details out of Git. Light-theme tokens are measured; use the supplied dark Kumo demo for comparison. The original D1 screenshot is light-theme only.
- Dev D1 migrations 0001–0009 were confirmed on 2026-11-12. Seed v2 was confirmed; seed v3 upgrade confirmation remains open. Recheck only when relevant; never infer current remote state from these dated observations.
- Dev Worker: https://imam-mobile-api-dev.imamsaahib.workers.dev; dev D1: imam-mobile-dev-db. Verify environment bindings/configuration before remote reads; do not infer production targets from a Pages project name.
- Role choices and password-hashing spike belong to Story 11. Reference-dataset assumptions remain in Contracts §9.

## Sources

- [Product vision](platform/README.md), [decisions](platform/DECISIONS.md), [contracts](platform/IMPLEMENTATION-CONTRACTS.md).
- [Story 00](platform/stories/00-ui-shell-design-system.md), [Story 01](platform/stories/01-platform-foundation.md), [Story 04](platform/stories/04-data-model-properties.md).
- [Sequence and milestones](TIMELINE.md), [migration process](platform/MIGRATIONS.md), [historical operational notes](HANDOFF-HISTORY.md).

Update this summary only when current state, next work or dependencies change. Detailed evidence belongs in the story; do not append session transcripts here.
