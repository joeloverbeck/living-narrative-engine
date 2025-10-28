# ANABLUNONHUM-017: Recipe Pattern Enhancement Test Suite

**Phase**: 3 - Recipe Pattern Enhancement  
**Priority**: High  
**Estimated Effort**: 8-10 hours  
**Dependencies**: ANABLUNONHUM-013, ANABLUNONHUM-014, ANABLUNONHUM-015, ANABLUNONHUM-016

## Overview

End-to-end validation for the enhanced recipe pattern pipeline (see `docs/anatomy/recipe-patterns.md`). Focus on the `RecipePatternResolver` and associated schema validators that power the new V2 pattern matchers (`matchesGroup`, `matchesPattern`, `matchesAll`) while preserving backwards compatibility with V1 explicit slot lists.

## Test Files

1. `tests/unit/anatomy/recipePatternResolver.test.js` – core resolver behavior, slot group extraction, wildcard matching, exclusions, and pattern precedence.  
2. `tests/unit/anatomy/recipePatternResolver.validation.test.js` – validation guard rails, error/warning conditions, and logging expectations for malformed patterns.  
3. `tests/unit/anatomy/recipeProcessor.test.js` – ensures the processor loads recipes, defers V2 expansion to the resolver, and maintains logging/merging semantics.  
4. `tests/unit/schemas/anatomy.recipe.schema.test.js` – schema-level coverage for pattern matcher fields, slot group exclusions, and data shape enforcement.  
5. `tests/unit/validation/anatomyRecipeSchema.test.js` – AJV validation suite covering real-world recipe fixtures (spider, dragon, mixed V1/V2).  
6. `tests/integration/anatomy/recipePatternResolution.integration.test.js` – resolver + blueprint integration across structure templates.  
7. `tests/integration/anatomy/recipePatternValidation.integration.test.js` – end-to-end validation of pattern-driven anatomy generation.  
8. `tests/integration/schemas/recipePatternResolution.test.js` – schema integration tests that exercise slot group exclusions alongside property filters.  
9. `tests/performance/anatomy/performanceStressTesting.test.js` (optional) – regression guard for anatomy throughput using recipes under load (see `THRESHOLDS` constants inside the suite).

## Test Coverage

- High-confidence coverage of `src/anatomy/recipePatternResolver.js`, including slot group resolution, wildcard expansion, property filters, and exclusion precedence.  
- Schema validation for pattern matcher combinations, ensuring new keywords follow documented rules and emit actionable error messages.  
- Integration flows that load real structure templates from the data registry and verify resolver output against blueprint-driven slot inventories.  
- Processor-level assurances that legacy V1 recipes remain supported while V2 patterns are routed through the resolver.  
- Optional performance baseline via the anatomy stress tests to catch large-regression cases (targets defined within the performance suite itself).

## Key Scenarios

- Slot group expansion (e.g., spider limb sets `limbSet:leg`, dragon tail appendages `appendage:tail`).  
- Wildcard matching via `matchesPattern` for left/right orientation and tentacle clusters.  
- Property-based filtering with `matchesAll`, including combinations with `exclude.slotGroups` and property exclusions.  
- Mixed V1 (`matches`) and V2 pattern precedence to guarantee explicit slot definitions win.  
- Schema rejection paths for missing matchers, invalid wildcards, and unsupported combinations (warnings/errors logged as per validation tests).

## References

- `docs/anatomy/recipe-patterns.md`  
- `docs/anatomy/pattern-matching-best-practices.md`  
- `docs/anatomy/property-based-filtering-examples.md`  
- `docs/anatomy/v1-to-v2-pattern-migration.md`  
- `reports/anatomy-blueprint-non-human-architecture.md` Phase 3
