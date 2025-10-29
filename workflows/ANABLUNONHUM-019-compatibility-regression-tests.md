# ANABLUNONHUM-019: V1/V2 Compatibility Regression Test Suite

**Phase**: 4 - Backward Compatibility  
**Priority**: Critical  
**Estimated Effort**: 6-8 hours  
**Dependencies**: ANABLUNONHUM-018

## Purpose

Body blueprint schema detection now routes v1 (manual slot) and v2 (structure template) blueprints through different code paths inside `BodyBlueprintFactory`. This suite protects existing v1 assets (`data/mods/anatomy/blueprints/*.json`) while validating the v2 structure-template flow that generates slots and sockets at runtime. There is **no feature flag**—compatibility relies entirely on the schema version checks introduced in ANABLUNONHUM-018.

## Background

- **Blueprint v2 contracts**: V2 blueprints opt-in with `schemaVersion: "2.0"`, reference a `structureTemplate`, and may add `additionalSlots`. V1 blueprints omit the version (or use `"1.0"`) and continue to supply explicit `slots`, `parts`, and `compose` arrays.【F:docs/anatomy/blueprints-v2.md†L28-L75】【F:docs/anatomy/blueprints-v2.md†L95-L137】
- **Structure template topology**: Templates declare limb sets, appendages, and socket generation patterns (e.g., spider, dragon, centaur) that the factory must resolve when processing v2 blueprints.【F:docs/anatomy/structure-templates.md†L1-L108】【F:docs/anatomy/structure-templates.md†L109-L190】
- **Pattern migration**: Recipes for non-human creatures rely on `matchesGroup`, `matchesPattern`, and `matchesAll` to target template-generated slots, so regressions in the v2 flow will surface as recipe matcher failures.【F:docs/anatomy/v1-to-v2-pattern-migration.md†L1-L93】【F:docs/anatomy/v1-to-v2-pattern-migration.md†L95-L158】

## Pre-Execution Checklist

- [ ] Run ANABLUNONHUM-018 schema detection tests and ensure `BodyBlueprintFactory` reports the expected mode switches before executing this suite.
- [ ] Confirm new or updated blueprint fixtures identify their intended schema version.
- [ ] Verify structure templates referenced by v2 blueprints exist in `data/mods/anatomy/templates/` and pass schema validation.
- [ ] Ensure recipe fixtures targeting new structures have updated pattern definitions (no lingering `matches` arrays for v2-only slots).

## Regression Matrix

| Layer | Test Suite | Focus |
| --- | --- | --- |
| Integration | `tests/integration/anatomy/bodyBlueprintFactory.integration.test.js` | Legacy (v1) blueprint flow, manual slots, failure cleanup |
| Integration | `tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js` | Structure template flow, socket generation parity |
| Integration | `tests/integration/anatomy/recipePatternResolution.integration.test.js` | Recipe matchers against generated slots |
| Integration | `tests/integration/loaders/anatomyStructureTemplateLoader.integration.test.js` | Template discovery, registry registration |
| Unit | `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js` | V2-specific processing, merge order, error handling |

## Detailed Coverage

### 1. BodyBlueprintFactory – Legacy Path
- Execute `tests/integration/anatomy/bodyBlueprintFactory.integration.test.js` to confirm manual slot construction, optional slot handling, and failure cleanup remain unchanged for schemaVersion `1.0`/omitted files.
- Regression focus: socket pruning, validation error propagation, and blueprint cache invalidation.

### 2. BodyBlueprintFactory – Structure Template Path
- Run `tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js` to validate template resolution for spider, centaur, and dragon fixtures (limb sets, appendages, additional slot merges).
- Assert that generated sockets match template expectations and that `additionalSlots` merge after template expansion.

### 3. Recipe Pattern Resolution
- Execute `tests/integration/anatomy/recipePatternResolution.integration.test.js` to cover `matchesGroup`, `matchesPattern`, and `matchesAll` behaviors across generated slots.
- Confirm v1 recipes still resolve against manual slots while v2 recipes exclusively target template-driven slots.

### 4. Loader and Registry Integration
- Run `tests/integration/loaders/anatomyStructureTemplateLoader.integration.test.js` to ensure structure templates populate the `anatomyStructureTemplates` registry without affecting legacy blueprint registries.
- Validate schema enforcement for template fields and verify registry lookups used by `BodyBlueprintFactory` v2 path.

### 5. Targeted Unit Validation
- Use `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js` to exercise `#processV2Blueprint`, merge ordering with `additionalSlots`, and error paths when templates are missing.
- Verify logging expectations for malformed templates and ensure failure surfaces as actionable errors.

## Data Contract Checks

- Inspect `data/mods/anatomy/blueprints/*.json` before and after test runs to confirm human blueprints remain on schemaVersion 1 (or omit the field entirely). V2-only features (`structureTemplate`, `additionalSlots`) must not appear in v1 files.【F:docs/anatomy/blueprints-v2.md†L49-L94】
- For each non-human blueprint that declares `schemaVersion: "2.0"`, verify the referenced template exists and the recipe fixtures leverage V2 pattern matchers (`matchesGroup`, `matchesPattern`, `matchesAll`).【F:docs/anatomy/v1-to-v2-pattern-migration.md†L59-L158】
- Confirm newly added templates and blueprints include coverage in the suites listed above (no orphan data).

## Execution Steps

```bash
npm run test:integration -- --runTestsByPath \
  tests/integration/anatomy/bodyBlueprintFactory.integration.test.js \
  tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js \
  tests/integration/anatomy/recipePatternResolution.integration.test.js \
  tests/integration/loaders/anatomyStructureTemplateLoader.integration.test.js
npm run test:unit -- --runTestsByPath tests/unit/anatomy/bodyBlueprintFactory.v2.test.js
```

- Optional: run `npm run test:integration` without filters if additional suites are introduced during implementation.

## Failure Diagnostics

- **Schema mismatches**: Validate blueprint or template files against `data/schemas/anatomy.blueprint.schema.json` and `data/schemas/anatomy.structure-template.schema.json` when encountering AJV errors.
- **Registry misses**: Inspect loader logs for missing template IDs; confirm registry population order matches loader expectations.
- **Recipe mismatches**: When pattern resolution fails, compare slot inventories produced by the relevant blueprint (via integration test snapshots) with recipe matcher definitions.
- **Merge ordering issues**: Re-run unit suite with verbose logging to ensure `additionalSlots` overlay template-generated sockets without overwriting required slots.

## Exit Criteria

- [ ] Integration tests for both blueprint paths pass (legacy and structure-template suites).
- [ ] Recipe pattern resolution integration tests pass with structure templates registered.
- [ ] Structure template loader integration tests pass and register entries under `anatomyStructureTemplates`.
- [ ] Unit tests for `BodyBlueprintFactory` v2 processing pass, confirming schema detection and template merging behavior.
- [ ] No regressions or unintended edits to existing v1 blueprint JSON files.
- [ ] Any new v2 blueprint includes a structure template entry and accompanying test coverage hitting the suites above.

## References

- `docs/anatomy/blueprints-v2.md`
- `docs/anatomy/structure-templates.md`
- `docs/anatomy/v1-to-v2-pattern-migration.md`
- `reports/anatomy-blueprint-non-human-architecture.md`
