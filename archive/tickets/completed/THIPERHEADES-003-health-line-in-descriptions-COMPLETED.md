# THIPERHEADES-003: Insert Health line into body descriptions (Completed)

## Status
Completed

## Updated assumptions
- Third-person formatter `formatThirdPersonVisible` already exists (filters vital organs, orders visible injuries) and is unit-tested alongside the vital-organ fallback.
- `BodyDescriptionComposer` already calls the aggregator + formatter and inserts `Health:` between `Wearing:` and `Inventory:` when those services are provided; descriptions are already persisted on `core:description`.
- Missing coverage: integration proof that `composeDescription` emits the `Health:` line for healthy actors, visible injuries, and vital-organ-only injuries (which should fall back to `Perfect health.`) while keeping equipment/inventory text intact.

## Scope
- Add an integration test under `tests/integration/anatomy/` that exercises `composeDescription` with the real aggregation + third-person formatter pipeline for:
  - No visible injuries → `Health: Perfect health.`
  - Visible injuries → third-person narrative line.
  - Only vital-organ injuries → `Health: Perfect health.` fallback.
- Ensure the `Health:` line stays between `Wearing:` and `Inventory:`.
- Run: `npm run test:integration -- tests/integration/anatomy/bodyDescriptionComposer.healthLine.integration.test.js`.

## Out of scope
- Changes to tooltip rendering or prompt parsing logic.
- Altering equipment or inventory formatting and ordering beyond inserting the Health line at the specified position.
- Modifying first-person Physical Condition text.

## Acceptance criteria
- Integration test under `tests/integration/anatomy/` covers healthy, visible injuries, and vital-organ-only injuries with ordering between `Wearing:` and `Inventory:`.
- `npm run test:integration -- tests/integration/anatomy/bodyDescriptionComposer.healthLine.integration.test.js` passes.
- Existing `Wearing:` and `Inventory:` text remains unchanged aside from the new `Health:` insertion point.
- Descriptions still serialize into `core:description` without breaking downstream consumers.

## Outcome
- Added integration coverage for `BodyDescriptionComposer` using the real injury aggregation + third-person formatter pipeline to lock in the `Health:` line ordering and vital-organ fallback. No production code changes required.
