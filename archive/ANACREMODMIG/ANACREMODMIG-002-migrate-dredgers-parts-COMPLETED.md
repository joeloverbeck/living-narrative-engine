# ANACREMODMIG-002: Migrate dredgers Parts into anatomy-creatures (COMPLETED)

## Outcome
- Added `anatomy-creatures` copies of `amphibian_core.part.json` and `mustelid_core.part.json` with updated `anatomy-creatures:*` IDs while keeping slot/clothing mappings identical.
- Registered both parts in `data/mods/anatomy-creatures/mod-manifest.json` without altering dredgers files or manifests (those stay until follow-up tickets update references/removals).
- Validated schema (`npm run validate:quick`) and added a focused integration test for loading the new parts/IDs.

## Notes vs. Original Plan
- Original ticket implied moving/deleting dredgers files; adjusted to copy-only to avoid breaking existing dredgers references until ANACREMODMIG-004/007 execute.
- Acceptance updated to cover manifest registration and targeted integration test instead of broad typecheck.

## Verification
- `npm run validate:quick`
- `npm run test:integration --runTestsByPath tests/integration/mods/anatomy-creatures/partsLoading.test.js`
