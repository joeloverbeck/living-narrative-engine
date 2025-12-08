# FIRAIDDISWOUBODPAR-007: Integration coverage for disinfect action flow (Completed)

**Status:** Completed

## Current state check
- Action/rule/scope/content already exist per `specs/first-aid-disinfect-wounded-body-part.md` (see `data/mods/first-aid/actions/disinfect_wounded_part.action.json`, `data/mods/items/scopes/disinfectant_liquids_in_inventory.scope`, and associated rule/condition/component/entity).
- Integration tests already live under `tests/integration/mods/first-aid/`:
  - `disinfect_wounded_part_action_discovery.test.js` (action structure + discoverability toggles for skill/tagged disinfectant/wounded part).
  - `handle_disinfect_wounded_part_rule.test.js` (rule messaging, component application, regen requests).
- Gap: no coverage that the disinfectant inventory scope filters out empty containers; add this to the discovery suite. Use existing JS test files (no new TypeScript file needed).

## Goal
Strengthen the existing first-aid disinfect integration tests to cover the empty-volume scope edge case while keeping current action/rule behavior intact.

## File list
- `tests/integration/mods/first-aid/disinfect_wounded_part_action_discovery.test.js` (extend with empty-volume scenario; reuse existing helpers/fixtures).
- `tests/integration/mods/first-aid/handle_disinfect_wounded_part_rule.test.js` (no structural changes expected; keep aligned with spec).
- Supporting fixtures/mocks stay alongside the tests if needed.

## Out of scope
- No production code refactors; only minimal data/rule tweaks if required to satisfy the new test.
- Do not rewrite unrelated test suites or Jest config.
- No coverage threshold changes.

## Acceptance criteria
- Integration tests cover: action visibility toggles (skill/tag/wound), disinfectant scope filtering by tag **and** volume (empty containers excluded), and rule messaging/component application.
- Command to verify: `npm run test:integration -- tests/integration/mods/first-aid/disinfect_wounded_part_action_discovery.test.js tests/integration/mods/first-aid/handle_disinfect_wounded_part_rule.test.js` passes.
- Existing integration suites continue to pass; fixtures mirror the spec without mutating other mods’ data.

## Outcome
- Added an empty-volume scenario to `disinfect_wounded_part_action_discovery.test.js` to ensure disinfectant scope ignores zero-volume containers.
- Kept production content unchanged; leveraged existing integration fixtures for coverage.
- Verified with `npm run test:integration -- --runInBand tests/integration/mods/first-aid/disinfect_wounded_part_action_discovery.test.js tests/integration/mods/first-aid/handle_disinfect_wounded_part_rule.test.js` (runInBand due to known worker crash).
