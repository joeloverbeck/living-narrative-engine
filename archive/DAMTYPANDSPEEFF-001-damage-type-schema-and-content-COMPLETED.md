# DAMTYPANDSPEEFF-001: Define Damage Type schema and canonical content layout

**Status**: Completed
**Priority**: High
**Estimated Effort**: 1.5 days
**Dependencies**: None
**Blocks**: DAMTYPANDSPEEFF-002, DAMTYPANDSPEEFF-003

## Problem / Objective

Create the data model surface for damage types and status components so mods and engine code share the same schema. Establish the new `data/mods/anatomy/damage-types/` directory, component schema files, and safe defaults for missing fields.

## Scope

- Add JSON schema/definitions for damage types and anatomy status components (bleeding, burning, poisoned, fractured, stunned).
- Provide initial sample/placeholder damage type entries aligned to spec to exercise validation.
- Wire validation so unknown ids warn, optional fields default to no-op values, and schema errors are surfaced during data validation commands.

## File list

- `data/mods/anatomy/damage-types/*.json` (new directory plus starter definitions)
- `data/mods/anatomy/components/bleeding.component.json`
- `data/mods/anatomy/components/burning.component.json`
- `data/mods/anatomy/components/poisoned.component.json`
- `data/mods/anatomy/components/fractured.component.json`
- `data/mods/anatomy/components/stunned.component.json`
- `scripts/` or `config/` entries needed to register new validation schemas (if applicable)
- `tests/` fixtures covering schema parsing defaults (exact file names at developer discretion)

## Out of scope

- Implementing runtime systems that consume these schemas (handled in later tickets).
- UI, VFX, or narrative copy for new damage types.
- Balancing values for shipped mods beyond minimal placeholders.
- Changes to existing mod content unrelated to anatomy/damage types.

## Acceptance criteria

### Tests that must pass

- `npm run validate:ecosystem` (or `npm run validate:quick` while developing) recognizes new schema without regressions.
- New unit tests for schema parsing/defaulting executed via `npm run test:unit -- tests/unit/anatomy/damage-types.schema.test.ts` (or equivalent path) and passing.

### Invariants that must remain true

- Existing mod validation not related to damage types continues to pass without schema changes.
- Damage type parsing defaults missing optional sections to safe no-op values (penetration defaults to 0.0; effect blocks default to disabled).
- No hardcoded references to specific mod ids; respect `mod-architecture/no-hardcoded-mod-references` lint rule.

## Outcome

- Created `data/schemas/damage-type.schema.json` defining the structure for damage types.
- Updated `data/schemas/mod-manifest.schema.json` to support `damageTypes` content type.
- Registered the new schema in `src/configuration/staticConfiguration.js`.
- Created `data/mods/anatomy/damage-types/` with `blunt.json`, `slashing.json`, and `piercing.json`.
- Created component definitions for `bleeding`, `burning`, `poisoned`, `fractured`, and `stunned` in `data/mods/anatomy/components/`.
- Updated `data/mods/anatomy/mod-manifest.json` to include the new content.
- Added `tests/unit/anatomy/damage-types.schema.test.js` to validate the schema and defaults.
- Verified that `npm run validate:quick` passes with the new content.
