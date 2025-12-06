# DAMAPPMEC-001: Component Schemas for Health and Anatomy Parts

## Description

Define the data structures required for the Damage Application Mechanics. This involves creating a new `anatomy:health` component schema and updating the existing `anatomy:part` component schema to support hit weights and damage propagation rules.

## Expected File List

- `data/mods/anatomy/components/health.component.json` (New)
- `data/mods/anatomy/components/part.component.json` (Modify)

## Context & Assumptions

- **Existing `anatomy:part_health`**: The project already has a robust health component for parts. The spec initially called for a new `anatomy:health`, but this was corrected to utilize the existing standard to avoid redundancy and maintain consistency.
- **Backward Compatibility**: `anatomy:part` changes must be additive to avoid breaking existing entity definitions.

## Out of Scope

- Implementation of any logic (resolvers, damage handlers).
- Modifying any other mod's components.
- Creating instances of these components (entities).

## Acceptance Criteria

### 1. Schema Validation

- Run `npm run validate:ecosystem` (or specific schema validation command). It must pass without errors for the modified schemas.

### 2. `anatomy:part_health` (Existing)

- Use the existing component structure which supports `currentHealth`, `maxHealth`, and `state` (enum).

### 3. `anatomy:part` Extension

- Must maintain backward compatibility with existing `anatomy:part` fields (don't remove existing fields).
- New Property: `hit_probability_weight` (number, default 1.0).
- New Property: `damage_propagation` (object/map).
  - Key: Child part ID or identifier (string).
  - Value Object:
    - `probability` (number, 0-1).
    - `damage_fraction` (number, default 0.5).
    - `damage_types` (array of strings, optional).

### Invariants

- Existing entities using `anatomy:part` must still pass validation (defaults should handle missing new fields).

## Outcome

- **Correction**: Deleted redundant `anatomy:health` component. Updated specs to use existing `anatomy:part_health`.
- Extended `data/mods/anatomy/components/part.component.json` with `hit_probability_weight` and `damage_propagation`.
- Verified ecosystem validation passes.
- Updated `tests/integration/schemas/damageMechanics.schema.test.js` to verify `anatomy:part_health` and extended `anatomy:part`.
- Cleaned up `tests/unit/schemas/core.allComponents.schema.test.js` to remove `anatomy:health` references.
