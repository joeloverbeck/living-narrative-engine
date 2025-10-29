# Core Anatomy Example Recipe Validation Cleanup Spec

## Implementation Status

**Status**: PROPOSED – Data Fix Guidance  
**Date**: 2025-02-15  
**Author**: AI Maintenance Agent

## 1. Overview

### 1.1 Executive Summary

Loading `game.html` currently triggers multiple `AnatomyRecipeLoader` validation failures. Every failure originates from example recipes under `data/mods/core/recipes/examples/` that declare body descriptor values not supported by the canonical schema `data/schemas/anatomy.recipe.schema.json`. This specification documents the misalignments and prescribes the steps required to realign the sample content with the schema so that the core content pack loads without errors.

### 1.2 Current Symptoms

- Console logs during the `ContentPhase` report schema validation errors for the following recipes:
  - `examples/dragon-mixed-patterns.recipe.json`
  - `examples/property-filters/combined-filters.recipe.json`
  - `examples/property-filters/filter-by-orientation.recipe.json`
  - `examples/property-filters/filter-by-slottype.recipe.json`
  - `examples/property-filters/filter-by-socketid.recipe.json`
  - `examples/spider-property-filtering.recipe.json`
- Each error message references `AnatomyRecipeLoader [core]: Primary schema validation failed` with details pointing to the `bodyDescriptors` block (unexpected properties or invalid enum values).

### 1.3 Affected Assets

- Recipe data: `data/mods/core/recipes/examples/*.recipe.json`
- Schema reference: `data/schemas/anatomy.recipe.schema.json`
- Documentation: `docs/modding/body-descriptors-guide.md`

## 2. Root Cause Analysis

1. **Out-of-date body descriptor vocabulary** – The schema restricts `bodyDescriptors.build` to the enum `[skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky]` and `bodyDescriptors.height` to `[gigantic, very-tall, tall, average, short, petite, tiny]`. Several example recipes still use legacy descriptors such as `sturdy`, `average`, `aerodynamic`, `large`, `medium`, and `small`, which no longer validate.
2. **Unsupported descriptor field** – `examples/dragon-mixed-patterns.recipe.json` introduces a `bodyDescriptors.age` field. The schema’s `bodyDescriptors` object explicitly sets `additionalProperties: false`, so any extra key (including `age`) fails validation.

These inconsistencies only affect the instructional examples but they block mod loading because the loader treats all schema failures as fatal.

## 3. Proposed Fix

### 3.1 Normalize body descriptor values

For each file listed below, replace invalid descriptors with schema-supported equivalents that preserve the intent of the examples:

| File | Invalid Entry | Recommended Adjustment |
| --- | --- | --- |
| `examples/dragon-mixed-patterns.recipe.json` | `"age": "ancient"` | Remove the key entirely. If age context is needed, migrate it into a narrative tag or documentation comment. |
| `examples/property-filters/combined-filters.recipe.json` | `"height": "large"` | Use `"height": "very-tall"` (closest canonical synonym). |
| `examples/property-filters/filter-by-orientation.recipe.json` | `"build": "sturdy"`, `"height": "medium"` | Switch to `"build": "stocky"` and `"height": "average"`. |
| `examples/property-filters/filter-by-slottype.recipe.json` | `"build": "average"` | Move the concept to `"composition": "average"` or choose a supported build such as `"athletic"`. |
| `examples/property-filters/filter-by-socketid.recipe.json` | `"build": "aerodynamic"` | Replace with `"build": "slim"` (retains streamlined feel). |
| `examples/spider-property-filtering.recipe.json` | `"height": "small"` | Use `"height": "petite"` to communicate diminutive size. |

When adjusting descriptors, keep any other recipe content untouched so the instructional focus (pattern filtering mechanics) remains unchanged.

### 3.2 Align documentation examples

Audit `docs/modding/body-descriptors-guide.md` (and any other tutorials referencing the outdated terms) to ensure sample JSON uses only schema-legal descriptor names. Update textual descriptions where necessary to match the curated vocabulary, preventing future regressions by new content authors.

### 3.3 Regression prevention

- Add or update a lightweight validation test that loads the example recipes (e.g., extend `tests/unit/loaders/anatomyRecipeLoader.examples.test.js` or similar) to assert that the `AnatomyRecipeLoader` can process these core examples without throwing schema errors.
- Consider wiring `npm run validate` (or the specific Ajv validation command) into the documentation build/test pipeline for the examples directory so discrepancies are surfaced early.

## 4. Acceptance Criteria

1. Running `npm run validate` (or loading `game.html`) completes without schema validation errors for the core example recipes.
2. All `bodyDescriptors` blocks inside `data/mods/core/recipes/examples/*.recipe.json` conform to the enums declared in `data/schemas/anatomy.recipe.schema.json` and avoid additional ad-hoc keys.
3. Documentation snippets mirror the canonical descriptor vocabulary, so copy/paste usage stays schema-compliant.
4. Automated validation covers the repaired examples to guard against future drift.

## 5. Open Questions

- Should we introduce an explicit `age` descriptor in a future schema revision, or keep age-related flavor confined to narrative descriptors?
- Do we want to document an official mapping between legacy descriptor names (e.g., `sturdy`, `large`) and the new enums to help third-party modders migrate their content?
