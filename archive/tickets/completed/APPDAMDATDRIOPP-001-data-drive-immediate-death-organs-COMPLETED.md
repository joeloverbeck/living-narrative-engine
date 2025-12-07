# APPDAMDATDRIOPP-001: Data-drive immediate-death vital organs

Status: Completed

Create a data-driven source of truth for which vital organs cause instant death so mods can add new lethal organs without code edits.

## Reality check (current state)
- `deathCheckService` hardcodes `['brain','heart','spine']` as the only immediate-death organs and ignores any data flagging.
- The `anatomy:vital_organ` component schema only exposes `organType` (enum: brain/heart/spine) plus health-cap fields; there is no kill flag to opt parts in/out. Mods currently cannot declare a lethal organ without editing both the enum and the hardcoded list.
- `deathMechanics.e2e.test` and unit tests mirror the hardcoded list in their fixtures/expectations, so they will need to follow the data-driven source once introduced.

## File list (expected touches)
- src/anatomy/services/deathCheckService.js
- data/mods/anatomy/components/vital_organ.component.json
- tests/e2e/actions/deathMechanics.e2e.test.js
- tests/unit/anatomy/services/deathCheckService.test.js
- tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js

## Tasks
- Add a data field (e.g., `killOnDestroy`, defaulting to true) to the `anatomy:vital_organ` component definition and validate it in the component schema/tests.
- Load or derive the lethal determination from the component data at runtime (no hardcoded organ-type arrays); honor `killOnDestroy` on each vital organ instance.
- Update `deathCheckService` to rely on the data-driven lethal flag when determining immediate death.
- Adjust death-mechanics coverage (e2e + unit) to consume the data-driven lethal flag rather than a fixed organ-type list.

## Out of scope
- Changing propagation rules, socket logic, or non-vital organ death causes.
- Adding new organ content beyond the minimal changes needed to represent lethal flags.
- Broad refactors to injuryAggregationService or unrelated services.

## Acceptance criteria
- Tests: `npm run test:e2e -- tests/e2e/actions/deathMechanics.e2e.test.js --runInBand` passes.
- Invariants: Existing lethal organs (brain/heart/spine) remain lethal with current data; death causes and event payload shapes emitted by `deathCheckService` stay unchanged aside from sourcing the lethal list from data; no new console output in browser/runtime paths.

## Outcome
- Added `killOnDestroy` (default true) to the `anatomy:vital_organ` component schema so lethality is data-driven and validated.
- `deathCheckService` now keys off the component flag (no hardcoded organ list) and supports new organ types without code edits.
- Death mechanics coverage now consumes the component config (kill flag/default) and includes a guard case where a vital organ with `killOnDestroy: false` does not instantly kill.
