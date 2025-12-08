# Wounded Body Part Scope Operator Refactor

**Status**: Draft  
**Created**: 2026-02-06  
**Purpose**: Identify operator-level refactors that collapse repeated coverage/visibility checks used in `data/mods/first-aid/scopes/wounded_actor_body_parts.scope` and `data/mods/first-aid/scopes/wounded_target_body_parts.scope`, and reuse them across other scopes to minimize JSON Logic duplication.

---

## Context

- The wounded scopes chain multiple operators (`hasClothingInSlotLayer`, `isSocketCovered`, comparisons on `anatomy:part_health`) to decide which body parts are targetable. The same coverage logic repeats across many other scopes under `data/mods/*/scopes/`, especially around socket exposure.
- Current operators in `src/logic/operators/` already cover single-slot checks (`hasClothingInSlotLayer`, `isSocketCovered`, `hasClothingInSlot`), but common combinations (multi-layer emptiness, multi-socket exposure, “exposed if no socket defined”) are handwritten per scope.
- Goal: introduce higher-level operators to encode these combinations once, then rewrite scopes to call them, reducing boilerplate and risk of drift.

## Findings (operator usage)

- `isSocketCovered`: Used in 22 scope files (e.g., `sex-core`, `sex-dry-intimacy`, `sex-breastplay`, `caressing`) with recurring patterns:
  - Exposed socket: `{ "not": { "isSocketCovered": [entityPath, socketId] } }`.
  - Any-of two sockets: `{ "or": [not left, not right] }`.
  - All covered: `{ "and": [is left, is right] }`.
  - Missing socket IDs treated as exposed via `or` with `! joint.socketId` in the wounded scopes.
- `hasClothingInSlotLayer`: Only appears in the two wounded scopes, but always as the same triple negation (`base`/`outer`/`armor`) gated by `visibility_rules.clothingSlotId`.
- `hasClothingInSlot`: Used in `caressing`/`distress` torso-clothing scopes to assert any clothing in a slot, overlapping conceptually with the triple-layer emptiness check above.
- Health/vital filters: The wounded scopes replicate `part_health.currentHealth < maxHealth` and `!vital_organ`; similar health predicates appear in `first-aid:bleeding_actor_body_parts`.

## Refactor Opportunities (new operators)

### 1) Slot Exposure Operator
- **Operator**: `isSlotExposed(slotName, options?)` under `src/logic/operators/` (BaseEquipmentOperator).
- **Behavior**: Returns true when no covering items are equipped in a slot across configurable layers (default `['base','outer','armor']`), optionally ignoring accessories/underwear. If `slotName` is falsy/undefined, default to true (matches current `!visibility_rules.clothingSlotId` guard).
- **Impact**: Replace the repeated triple `!hasClothingInSlotLayer` block in both wounded scopes; also reusable for torso/back/penis/vagina “covered vs uncovered” scopes that currently rely on `hasClothingInSlot` + manual layer assumptions.

### 2) Socket Exposure Aggregator
- **Operator**: `socketExposure(entityPath, sockets, mode = 'any', invert = false, treatMissingAsExposed = true)` wrapping `isSocketCovered`.
- **Behavior**: Accepts a single socket ID or array. `mode: 'any'|'all'` determines how many must be exposed/covered. `invert` flips between “exposed” vs “covered”. `treatMissingAsExposed` mirrors the wounded scopes’ `!joint.socketId` shortcut.
- **Impact**: Collapses patterns like `{or: [not left, not right]}`, `{and: [is left, is right]}`, and the `!socketId OR not isSocketCovered(socketId)` guard into one call. Targets the 20+ scopes using these shapes plus the wounded scopes’ joint coverage check.

### 3) Body Part Accessibility Operator
- **Operator**: `isBodyPartAccessible(entityPath, partEntityRef, options?)` that delegates to BodyGraphService.
- **Behavior**: For a part entity, resolve `visibility_rules.clothingSlotId` and `joint.socketId`, then apply (1) slot exposure (using the new operator with layer allowlist) and (2) socket exposure (using the aggregator with `treatMissingAsExposed`). Returns true if the part is interactable/exposed.
- **Impact**: Lets wounded scopes collapse the clothing + socket visibility block into a single predicate and reuse the same rule in future “exposed part” scopes (sex and caressing mods currently approximate this manually per body region).

### 4) Body Part Wound Predicate
- **Operator**: `isBodyPartWounded(partEntityRef, options?)` (could extend `BaseBodyPartOperator`).
- **Behavior**: Checks `anatomy:part_health.currentHealth < maxHealth` with optional flags to exclude `vital_organ` or require additional components (`bleeding`, `infection`).
- **Impact**: Replaces duplicated health/vital checks across `first-aid:wounded_*` and `first-aid:bleeding_actor_body_parts`, enabling future triage scopes to share the same predicate instead of embedding comparison logic.

## Refactor Path (scope reductions)

- Replace the wounded scopes’ visibility block with `isBodyPartAccessible` (or, interim, `isSlotExposed` + `socketExposure`), keeping actor/target selection as the only difference between the two files.
- Update sex/caressing scopes to use `socketExposure` for left/right pairs and single-socket exposure/coverage instead of hand-built `and/or` trees.
- Where a scope only cares about clothing coverage (torso clothing presence), migrate to `isSlotExposed` / `hasClothingInSlot` depending on intent, reducing layer-specific duplication.
- Add tests alongside each new operator covering: missing slot IDs, accessories-only clothing, multi-socket any/all behavior, and parity with existing wounded scope results.

---

## Open Questions

- Should underwear count as “covering” for wound accessibility? If not, add an `excludeLayers` option to `isSlotExposed`.
- For sockets with explicit coverage mappings (used by `isSocketCovered`), do we still treat missing sockets as exposed by default?
- Can `isBodyPartAccessible` also return the resolved slot/socket metadata to support future narrative or debugging traces?
