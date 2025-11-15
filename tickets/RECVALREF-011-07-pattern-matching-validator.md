# RECVALREF-011-07: Implement PatternMatchingValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P1 (High Priority - Warnings)
**Estimated Effort:** 2.5 hours
**Complexity:** Medium-High

## Objective

Migrate the external `validatePatternMatching` function from `patternMatchingValidator.js` into a standalone `PatternMatchingValidator` class extending `BaseValidator`.

## Background

This validator performs dry-run pattern matching to detect patterns that would match zero slots. It helps mod developers identify problematic pattern configurations before runtime.

## Current Implementation

**Location:** `src/anatomy/validation/patternMatchingValidator.js`

**Functions:**
- `validatePatternMatching(recipe, blueprint, dataRegistry, slotGenerator, logger)` (main)
- `findMatchingSlots(pattern, blueprint, dataRegistry, slotGenerator, logger)` (helper)
- `getPatternDescription(pattern)` (helper - exported for RecipePreflightValidator and the runtime pattern resolver)
- `extractMatcherInfo(pattern)` (helper - shapes warning metadata)
- `identifyBlockingMatcher(pattern, result, blueprint)` (helper - explains failure reason)
- `suggestPatternFix(pattern, result, blueprint)` (helper - proposes corrective action)

**Logic:**
- Assumes blueprint has already been processed (RecipePreflightValidator calls its private `#ensureBlueprintProcessed` before delegating)
- For each pattern in `recipe.patterns`, resolves slot matches via the matcher helpers (group, wildcard, property filter, explicit list)
- Logs debug info for each matcher and accumulates warning objects when `matches.length === 0`
- Warning objects include `type`, `location`, `matcher`, `availableSlots`, `reason`, `fix`, and `severity: 'warning'`
- Uses `getPatternDescription` plus the matcher helpers to keep parity with runtime recipePatternResolver diagnostics

## Implementation Tasks

### 1. Create Blueprint Processing Utility (45 min)

**First, extract the shared async utility:**

**File:** `src/anatomy/validation/utils/blueprintProcessingUtils.js`

```javascript
/**
 * Blueprint processing utilities shared by validators
 */

/**
 * Ensures blueprint is processed (V2 compatibility)
 *
 * @param {object} params.blueprint - Blueprint to process
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Registry for structure templates
 * @param {import('../../slotGenerator.js').SlotGenerator} params.slotGenerator - Slot generator for template expansion
 * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger for diagnostics
 * @returns {Promise<object>} Processed blueprint
 */
export async function ensureBlueprintProcessed({
  blueprint,
  dataRegistry,
  slotGenerator,
  logger,
}) {
  // Extract from RecipePreflightValidator.#ensureBlueprintProcessed (currently ~lines 411-471)
  // Must support V1 pass-through, V2 template expansion, `_generatedSockets` guard, and `additionalSlots` precedence per docs/anatomy/blueprints-and-recipes.md
}
```

> Note: RecipePreflightValidator currently calls `this.#slotGenerator.generateBlueprintSlots(template)` and `this.#dataRegistry.get('anatomyStructureTemplates', templateId)`, so the shared helper must accept those dependencies explicitly instead of relying on globals.

### 2. Create Validator Class (1.5 hours)

**File:** `src/anatomy/validation/validators/PatternMatchingValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';

/**
 * Validates pattern matching by dry-run to detect zero-match patterns
 *
 * Priority: 35 - Warnings only, after critical validations
 * Fail Fast: false - Report all problematic patterns
 */
export class PatternMatchingValidator extends BaseValidator {
  #dataRegistry;
  #slotGenerator;
  #anatomyBlueprintRepository;
  #logger;

  constructor({ logger, dataRegistry, slotGenerator, anatomyBlueprintRepository }) {
    super({
      name: 'pattern-matching',
      priority: 35,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });

    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
        'generateBlueprintSlots',
      ],
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });

    this.#dataRegistry = dataRegistry;
    this.#slotGenerator = slotGenerator;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
  }

  async performValidation(recipe, options, builder) {
    // Get and process blueprint
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

    if (!blueprint) {
      this.#logger.debug(
        `PatternMatchingValidator: Blueprint '${recipe.blueprintId}' missing (handled by BlueprintExistenceValidator)`
      );
      return;
    }

    const processedBlueprint = await ensureBlueprintProcessed({
      blueprint,
      dataRegistry: this.#dataRegistry,
      slotGenerator: this.#slotGenerator,
      logger: this.#logger,
    });

    // Migrate logic from validatePatternMatching function
    // Use builder.addWarning() for zero-match patterns, preserving matcher/reason/fix payloads
    // Use builder.addPassed() when all patterns match
  }

  #findMatchingSlots(pattern, blueprint) {
    // Migrate from external helper function (still needs dataRegistry, slotGenerator, logger context)
  }

  #getPatternDescription(pattern) {
    // Reuse exported helper so runtime recipePatternResolver + RecipePreflightValidator stay consistent
  }
}

// Export utilities for use by other validators/runtime helpers
export {
  getPatternDescription,
  extractMatcherInfo,
  identifyBlockingMatcher,
  suggestPatternFix,
} from './PatternMatchingValidator.js';
```

**Key Migration Points:**
- External function `validatePatternMatching` → `performValidation`
- Helper `findMatchingSlots` → private method that still leverages slotGenerator/dataRegistry
- Helper exports (`getPatternDescription`, `extractMatcherInfo`, `identifyBlockingMatcher`, `suggestPatternFix`) stay at module scope for reuse
- Blueprint processing using shared utility

### 3. Update Unit & Integration Tests (45 min)

**File:** `tests/unit/anatomy/validation/patternMatchingValidator.test.js`

- Update existing tests to cover the class-based entry point (builder-level behavior) while keeping helper coverage intact.
- Ensure helper exports (`findMatchingSlots`, `getPatternDescription`, `extractMatcherInfo`, `identifyBlockingMatcher`, `suggestPatternFix`) continue to be unit-tested directly because other systems import them.

**File:** `tests/unit/anatomy/validation/validators/PatternMatchingValidator.test.js`

- Add new tests for the BaseValidator subclass (constructor validation, blueprint loading, ensureBlueprintProcessed usage, builder outputs, warnings vs passes).

**File:** `tests/integration/anatomy/validation/patternMatchingValidation.integration.test.js`

- Keep parity tests up to date if they reference the legacy function signature.

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate all dependencies (dataRegistry, slotGenerator, anatomyBlueprintRepository)

2. Basic validation scenarios
   - Should pass when all patterns match slots
   - Should warn when pattern matches zero slots
   - Should warn for multiple zero-match patterns
   - Should handle recipe with no patterns

3. Pattern matching logic
   - Should find slots matching pattern criteria
   - Should handle complex pattern criteria
   - Should handle patterns with multiple conditions
   - Should use slotGenerator correctly

4. Blueprint processing
   - Should process V2 blueprints correctly
   - Should skip if blueprint is null
   - Should handle blueprint processing errors

5. Pattern descriptions
   - Should generate readable pattern descriptions
   - Should handle patterns with slotName
   - Should handle patterns with partType
   - Should handle patterns with multiple criteria

6. Edge cases
   - Should handle empty patterns array (builder records "No patterns to validate")
   - Should handle malformed patterns (helper returns matcherType `none`, warning reason/fix still populated)
   - Should handle blueprint with no slots (availableSlots metadata surfaces for fixes)

**Coverage Target:** 80%+ branch coverage

### 4. Deprecate Old File (Included in integration ticket)

**Action:** Mark `src/anatomy/validation/patternMatchingValidator.js` for deletion in RECVALREF-011-10

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For component access
- `ISlotGenerator` - For slot extraction
- `IAnatomyBlueprintRepository` - For loading blueprints
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation
- `blueprintProcessingUtils` - Shared blueprint processing

## Acceptance Criteria

- [ ] blueprintProcessingUtils.js created with `ensureBlueprintProcessed` (async, dependency-injected `dataRegistry`, `slotGenerator`, `logger`)
- [ ] PatternMatchingValidator class created
- [ ] Extends BaseValidator with priority: 35, failFast: false
- [ ] All logic from external function migrated without changing warning payloads (`type`, `location`, `matcher`, `reason`, `fix`, `severity`)
- [ ] Helper exports (`getPatternDescription`, `extractMatcherInfo`, `identifyBlockingMatcher`, `suggestPatternFix`) remain available to other modules
- [ ] Constructor validates all dependencies
- [ ] Unit + integration tests updated, maintaining ≥80% branch coverage
- [ ] Warning messages match original format exactly
- [ ] Blueprint processing uses shared utility and preserves `_generatedSockets` guard described in docs/anatomy/blueprints-and-recipes.md
- [ ] ESLint passes on new/updated files

## Testing Commands

```bash
# Run utility tests (if created)
npm run test:unit -- validation/utils/blueprintProcessingUtils.test.js

# Run helper + legacy function tests
npm run test:unit -- anatomy/validation/patternMatchingValidator.test.js

# Run validator class tests
npm run test:unit -- anatomy/validation/validators/PatternMatchingValidator.test.js

# Check coverage
npm run test:unit -- anatomy/validation/validators/PatternMatchingValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/PatternMatchingValidator.js
npx eslint src/anatomy/validation/utils/blueprintProcessingUtils.js
```

## Code Reference

**Original File:**
`src/anatomy/validation/patternMatchingValidator.js`

**Functions to Migrate:**
- `validatePatternMatching(recipe, blueprint, dataRegistry, slotGenerator, logger)`
- `findMatchingSlots(pattern, blueprint, dataRegistry, slotGenerator, logger)`
- `getPatternDescription(pattern)` (export for reuse)
- `extractMatcherInfo(pattern)`
- `identifyBlockingMatcher(pattern, result, blueprint)`
- `suggestPatternFix(pattern, result, blueprint)`

**Blueprint Processing Source:**
`RecipePreflightValidator.js:411-471` (#ensureBlueprintProcessed)

**Usage Sites:**
- RecipePreflightValidator line 14: Import
- RecipePreflightValidator line 471-511: Call site + duplicate `#getPatternDescription`
- `src/anatomy/recipePatternResolver/patternResolver.js`: Imports `getPatternDescription` for runtime diagnostics

## Critical Notes

- Creates shared blueprint processing utility (DRY principle)
- Warnings only (not errors) - helps developers but doesn't block
- Pattern matching is dry-run (doesn't generate actual slots)
- `getPatternDescription` must remain accessible to RecipePreflightValidator and the runtime pattern resolver

## Success Metrics

- blueprintProcessingUtils.js: ~60-80 lines
- PatternMatchingValidator: ~180-220 lines
- Test file: ~250-300 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Shared utility reduces duplication
