# ANABLUNONHUM-019: V1/V2 Compatibility Regression Test Suite

**Phase**: 4 - Backward Compatibility
**Priority**: Critical
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-018

## Overview

Body blueprint schema detection now routes v1 (manual slot) and v2 (structure template)
blueprints through different code paths inside `BodyBlueprintFactory`. This suite protects
existing v1 assets (`data/mods/anatomy/blueprints/*.json`) while validating the v2
structure-template flow that generates slots and sockets at runtime. There is **no feature
flag**—compatibility relies entirely on the schema version checks introduced in
ANABLUNONHUM-018.

## Test Strategy

1. **Integration coverage – BodyBlueprintFactory**
   - Run the legacy path regression tests at
     `tests/integration/anatomy/bodyBlueprintFactory.integration.test.js`.
   - Run the structure-template flow coverage at
     `tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js`.
   - Command example:
     ```bash
     npm run test:integration -- --runTestsByPath \
       tests/integration/anatomy/bodyBlueprintFactory.integration.test.js \
       tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js
     ```
2. **Integration coverage – recipe pattern resolution**
   - Exercises `matchesGroup`, `matchesPattern`, and `matchesAll` against generated slots to
     guarantee pattern isolation between schema versions.
   - `tests/integration/anatomy/recipePatternResolution.integration.test.js`
3. **Loader/registry integration**
   - `tests/integration/loaders/anatomyStructureTemplateLoader.integration.test.js` ensures
     structure templates load into the `anatomyStructureTemplates` registry without
     disturbing legacy blueprint registries.
4. **Targeted unit validation**
   - `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js` validates the
     `#processV2Blueprint` path, merge order with `additionalSlots`, and failure cases when
     templates are missing.
5. **Data verification**
   - Confirm human blueprints stay on schemaVersion 1 (`data/mods/anatomy/blueprints/`).
   - Any new non-human blueprint must include `schemaVersion: "2.0"` plus a matching
     structure template entry under the loader paths covered above.

## Test Files

- `tests/integration/anatomy/bodyBlueprintFactory.integration.test.js`
- `tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js`
- `tests/integration/anatomy/recipePatternResolution.integration.test.js`
- `tests/integration/loaders/anatomyStructureTemplateLoader.integration.test.js`
- `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js`
- Blueprint data: `data/mods/anatomy/blueprints/*.json`

## Test Cases

- Legacy blueprint flow builds graphs, skips optional slots, dispatches validation errors,
  and cleans up on failure (`bodyBlueprintFactory.integration.test.js`).
- Structure-template flow produces the expected socket/slot combinations for spider,
  centaur, and dragon examples while keeping generated sockets aligned with slot
  references (`bodyBlueprintFactory.v2.integration.test.js`).
- Pattern resolution maps `matchesGroup`, `matchesPattern`, and `matchesAll` filters onto
  generated slots without leaking into v1 recipes (`recipePatternResolution.integration.test.js`).
- Loader integration discovers structure templates, validates schema fields, and populates
  the `anatomyStructureTemplates` registry alongside existing blueprint registries
  (`anatomyStructureTemplateLoader.integration.test.js`).
- Unit coverage enforces merge precedence for `additionalSlots`, template-missing error
  paths, and logging expectations (`bodyBlueprintFactory.v2.test.js`).
- Blueprint JSON verification: human files remain unchanged (schemaVersion omitted/`"1.0"`);
  any new non-human files opt into v2 with explicit structure template references.

## Acceptance Criteria

- [ ] Integration tests for both blueprint paths pass (v1 and v2 files listed above).
- [ ] Recipe pattern resolution integration tests pass with structure templates registered.
- [ ] Structure template loader integration tests pass and register entries under
      `anatomyStructureTemplates`.
- [ ] Unit tests for `BodyBlueprintFactory` v2 processing pass, confirming schema detection
      and template merging behavior.
- [ ] No regressions or unintended edits to existing v1 blueprint JSON files.
- [ ] Any new v2 blueprint includes a structure template entry and accompanying test
      coverage hitting the integration suites above.

## References

- `docs/anatomy/blueprints-v2.md`
- `docs/anatomy/structure-templates.md`
- `docs/anatomy/v1-to-v2-pattern-migration.md`
- `reports/anatomy-blueprint-non-human-architecture.md`
