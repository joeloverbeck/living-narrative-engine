# POSSITDOW-002: Implement Secondary Scope for Distance Seating

**Phase:** 1 - Feature Foundations
**Priority:** High
**Estimated Effort:** 5 hours

## Goal

Create a scope under `data/mods/positioning/scopes` that identifies the rightmost occupant on a furniture piece who has at least two empty spots to their right, enabling the new distance-sit action to resolve valid secondary targets.

## Context

The specification requires a bespoke scope (tentatively `actors_sitting_with_space_to_right.scope`) that runs with `contextFrom: "primary"`. The scope must enforce both rightmost-occupant and spacing constraints using available ScopeDSL operators. The new scope ID must match the existing reference in `data/mods/positioning/actions/sit_down_at_distance.action.json` (`positioning:actors_sitting_with_space_to_right`).

## Tasks

### 1. Author Scope File
- Create the new `.scope` file in `data/mods/positioning/scopes/` following existing naming conventions.
- Initialize the scope with `entities(core:actor)` (or another approved source) filtered to actors currently sitting (`positioning:sitting_on`).
- Add comments explaining non-obvious JSON logic, especially index calculations.

### 2. Filter by Furniture Context
- Ensure the scope compares each actor's `positioning:sitting_on.furniture_id` against `target.id` (the furniture selected as the primary target) to narrow candidates to the same piece of furniture.

### 3. Enforce Rightmost Occupant Rule
- Use JSON-logic variable lookups (for example, `{"var": "entity.components.positioning:sitting_on.spot_index"}` and `{"var": "target.components.positioning:allows_sitting.spots"}`) to reuse the actor's `spot_index` and the furniture `spots` array.
- Require that no seats with an index greater than the actor's current `spot_index` are occupied, using supported ScopeDSL array helpers (such as `some`/`filter` patterns) to ensure all higher positions are `null`.

### 4. Verify Gap Availability
- Add JSON-logic ensuring `spot_index + 1` and `spot_index + 2` both resolve to `null` within `target.components.positioning:allows_sitting.spots`.
- Include a guard so these lookups only pass when the furniture actually has indices at `spot_index + 1` and `spot_index + 2` (for example, by comparing the `spots` array length to `spot_index + 2` before asserting nullity).

### 5. Return Actor Identifiers
- Configure the scope to emit actor IDs for the targeting UI and action resolver.
- Double-check the structure matches expectations in `docs/scopeDsl/README.md` and `docs/scopeDsl/quick-reference.md`.

### 6. Local Validation
- Run `npm run scope:lint` and any targeted scope resolution tests (if available) to validate syntax and semantics.

## Acceptance Criteria
- Scope file exists and resolves only actors that satisfy the rightmost-with-two-empty-spots constraint relative to the primary furniture.
- Scope passes linting/validation.
- Documentation comments clarify how index math is performed for maintainers.
