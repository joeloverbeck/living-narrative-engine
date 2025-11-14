# RECVALREF-011: Refactor Recipe Validators to Standalone Classes (CORRECTED)

**Phase:** 3 - Validator Implementations
**Priority:** P0 - Critical
**Estimated Effort:** 12 hours (1.5 hours per validator average)
**Dependencies:** RECVALREF-009 (BaseValidator), RECVALREF-010 (ValidatorRegistry)
**Validation Date:** 2025-01-14

## ⚠️ IMPORTANT: Architectural Clarification

This project uses **TWO DISTINCT VALIDATION PATTERNS** serving different purposes:

### ValidationRule Pattern (Graph Validation - Post-Generation)
- **Purpose:** Validates assembled anatomy graphs AFTER generation
- **Base Class:** `src/anatomy/validation/validationRule.js`
- **Context:** ValidationContext with entityIds, recipe, entityManager
- **Usage:** Runtime graph validation via ValidationRuleChain
- **DO NOT MIGRATE:** These validators should remain as ValidationRule

### BaseValidator Pattern (Recipe Validation - Pre-Generation)
- **Purpose:** Validates recipe definitions BEFORE generation (pre-flight checks)
- **Base Class:** `src/anatomy/validation/validators/BaseValidator.js`
- **Context:** Recipe object and options
- **Usage:** Load-time validation via validation pipeline
- **MIGRATE TO THIS:** Inline methods and external functions

## Context

Currently the RecipePreflightValidator (1,064 lines) contains:
- 2 ValidationRule adapters (via LoadTimeValidationContext) ✅ CORRECTLY IMPLEMENTED
- 2 external validator functions → NEED MIGRATION
- 7 inline validation methods → NEED MIGRATION

Total validators requiring refactoring to BaseValidator: **8 validators**

## Validators Requiring Refactoring

### Critical (P0) - Fail Fast - 5 Validators

#### 1. BlueprintExistenceValidator
**Current:** Inline method `#checkBlueprintExists` (line 341)
**Purpose:** Validates blueprint exists and loads successfully
**Dependencies:** anatomyBlueprintRepository, logger
**Priority:** 10 (must run before socket/pattern validation)

#### 2. RecipeBodyDescriptorValidator
**Current:** Inline method `#checkBodyDescriptors` (line 235)
**Purpose:** Validates recipe bodyDescriptors against anatomy:body component schema
**Note:** DISTINCT from `src/anatomy/validators/bodyDescriptorValidator.js` (system/registry validator)
**Dependencies:** dataRegistry, schemaValidator, logger
**Priority:** 15

#### 3. SocketSlotCompatibilityValidator
**Current:** External function in `socketSlotCompatibilityValidator.js`
**Purpose:** Validates blueprint additionalSlots reference valid sockets
**Dependencies:** dataRegistry, logger
**Priority:** 20 (requires blueprint to exist)

#### 4. PartAvailabilityValidator
**Current:** Inline method `#checkPartAvailability` (line 554)
**Purpose:** Validates entity definitions exist for recipe slots
**Dependencies:** dataRegistry, entityMatcherService, logger
**Priority:** 25

#### 5. GeneratedSlotPartsValidator
**Current:** Inline method `#checkGeneratedSlotPartAvailability` (line 717)
**Purpose:** Validates entity definitions exist for pattern-matched slots
**Dependencies:** slotGenerator, dataRegistry, entityMatcherService, logger
**Priority:** 30 (requires blueprint)

### High Priority (P1) - 2 Validators

#### 6. PatternMatchingValidator
**Current:** External function in `patternMatchingValidator.js`
**Purpose:** Dry-run pattern matching to detect zero-match patterns
**Dependencies:** dataRegistry, slotGenerator, logger
**Priority:** 35 (warnings only)

#### 7. RecipeUsageValidator
**Current:** Inline method `#checkRecipeUsage` (line 1022)
**Purpose:** Verifies entity definitions reference this recipe
**Dependencies:** dataRegistry, logger
**Priority:** 60 (informational)

### Medium Priority (P2) - 1 Validator

#### 8. DescriptorCoverageValidator
**Current:** Inline method `#checkDescriptorCoverage` (line 513)
**Purpose:** Suggests body descriptors that could enhance recipe
**Dependencies:** dataRegistry, logger
**Priority:** 40 (suggestions only)

### Load Failure Tracking (P0 but Different Pattern)

#### 9. LoadFailureValidator
**Current:** Inline method `#checkEntityDefinitionLoadFailures` (line 904)
**Purpose:** Reports entity definition load failures for context
**Dependencies:** loadFailures map, logger
**Priority:** 50
**Note:** May require different pattern (stateful tracking vs stateless validation)

## Validators to KEEP as ValidationRule (DO NOT MIGRATE)

### ❌ ComponentExistenceValidationRule
**Location:** `src/anatomy/validation/rules/componentExistenceValidationRule.js`
**Pattern:** ValidationRule (graph validation)
**Current Usage:** Already used by RecipePreflightValidator via LoadTimeValidationContext adapter
**Status:** ✅ CORRECTLY IMPLEMENTED - Do not migrate

### ❌ PropertySchemaValidationRule
**Location:** `src/anatomy/validation/rules/propertySchemaValidationRule.js`
**Pattern:** ValidationRule (graph validation)
**Current Usage:** Already used by RecipePreflightValidator via LoadTimeValidationContext adapter
**Status:** ✅ CORRECTLY IMPLEMENTED - Do not migrate

## Implementation Pattern

Each validator should follow this structure:

```javascript
/**
 * @file [ValidatorName] - [Brief purpose]
 * @see ../../../docs/anatomy/[relevant-doc].md
 */

import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * [Validator description]
 *
 * Priority: [N] - [Rationale for priority order]
 * Fail Fast: [true|false] - [When to stop pipeline]
 */
export class [ValidatorName] extends BaseValidator {
  #dependency1;
  #dependency2;

  constructor({ logger, dependency1, dependency2 }) {
    super({
      name: 'validator-name',
      priority: N,
      failFast: boolean,
      logger,
    });

    // Validate dependencies
    validateDependency(dependency1, 'IDependency1', logger, {
      requiredMethods: ['method1', 'method2'],
    });

    this.#dependency1 = dependency1;
    this.#dependency2 = dependency2;
  }

  /**
   * Performs validation logic
   *
   * @param {object} recipe - Recipe to validate
   * @param {object} options - Validation options
   * @param {ValidationResultBuilder} builder - Result builder
   * @returns {Promise<void>}
   */
  async performValidation(recipe, options, builder) {
    // Validation logic here
    // Use builder.addError/addWarning/addSuggestion/addPassed

    try {
      // Extract data to validate
      const data = this.#extractData(recipe);

      // Perform validation
      const issues = this.#validate(data);

      // Record results
      if (issues.length === 0) {
        builder.addPassed(`[Success message]`);
      } else {
        for (const issue of issues) {
          builder.addError(issue.type, issue.message, issue.metadata);
        }
      }
    } catch (error) {
      // Let exception propagate to BaseValidator.validate()
      // which will wrap it in VALIDATOR_EXCEPTION error
      throw error;
    }
  }

  #extractData(recipe) {
    // Helper method for data extraction
  }

  #validate(data) {
    // Helper method for validation logic
  }
}
```

## Testing Requirements

Each validator needs:

### Test File Location
`tests/unit/anatomy/validation/validators/[ValidatorName].test.js`

### Test Structure
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { [ValidatorName] } from '../../../../../src/anatomy/validation/validators/[ValidatorName].js';
import { createMockLogger } from '../../../../common/mocks/mockLogger.js';

describe('[ValidatorName]', () => {
  let validator;
  let mockLogger;
  let mockDependency;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDependency = createMockDependency();

    validator = new [ValidatorName]({
      logger: mockLogger,
      dependency: mockDependency,
    });
  });

  describe('constructor', () => {
    it('should initialize with correct name and priority', () => {
      expect(validator.name).toBe('validator-name');
      expect(validator.priority).toBe(N);
      expect(validator.failFast).toBe(boolean);
    });

    it('should validate dependencies', () => {
      expect(() => new [ValidatorName]({ logger: null }))
        .toThrow();
    });
  });

  describe('validate', () => {
    it('should pass for valid recipe', async () => {
      const recipe = createValidRecipe();
      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toHaveLength(1);
      expect(result.isValid).toBe(true);
    });

    it('should detect [specific error condition]', async () => {
      const recipe = createInvalidRecipe();
      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('ERROR_TYPE');
      expect(result.isValid).toBe(false);
    });

    it('should handle edge case: [description]', async () => {
      // Edge case test
    });
  });
});
```

### Coverage Requirements
- 80%+ branch coverage minimum
- 90%+ function coverage target
- All error conditions tested
- Edge cases documented and tested

## Directory Structure

```
src/anatomy/validation/
├── validators/                    # Recipe validators (BaseValidator pattern)
│   ├── BaseValidator.js          ✅ EXISTS
│   ├── BlueprintExistenceValidator.js       # NEW
│   ├── RecipeBodyDescriptorValidator.js     # NEW
│   ├── SocketSlotCompatibilityValidator.js  # MIGRATE from external
│   ├── PatternMatchingValidator.js          # MIGRATE from external
│   ├── DescriptorCoverageValidator.js       # NEW
│   ├── PartAvailabilityValidator.js         # NEW
│   ├── GeneratedSlotPartsValidator.js       # NEW
│   ├── LoadFailureValidator.js              # NEW (consider pattern)
│   └── RecipeUsageValidator.js              # NEW
├── rules/                         # Graph validators (ValidationRule pattern)
│   ├── componentExistenceValidationRule.js  ✅ KEEP
│   ├── propertySchemaValidationRule.js      ✅ KEEP
│   └── [other graph validation rules]       ✅ KEEP
├── core/
│   ├── ValidationResultBuilder.js ✅ EXISTS
│   └── ValidatorRegistry.js       ✅ EXISTS
├── RecipePreflightValidator.js    # Will be refactored to use validators
├── socketSlotCompatibilityValidator.js  # Will be converted to class
└── patternMatchingValidator.js          # Will be converted to class

tests/unit/anatomy/validation/
├── validators/
│   ├── BaseValidator.test.js     ✅ EXISTS
│   ├── BlueprintExistenceValidator.test.js   # NEW
│   └── [8 more validator tests]              # NEW
└── rules/
    ├── componentExistenceValidationRule.test.js  ✅ KEEP
    └── propertySchemaValidationRule.test.js      ✅ KEEP
```

## Integration with RecipePreflightValidator

After all validators are created, RecipePreflightValidator will:

1. Instantiate validators in constructor
2. Call validators in priority order
3. Respect failFast settings
4. Aggregate results into ValidationReport

Example refactored orchestration:

```javascript
async #runValidationChecks(recipe, results, options) {
  const validators = [
    this.#blueprintExistenceValidator,      // Priority 10
    this.#recipeBodyDescriptorValidator,    // Priority 15
    this.#socketSlotCompatibilityValidator, // Priority 20
    this.#partAvailabilityValidator,        // Priority 25
    this.#generatedSlotPartsValidator,      // Priority 30
    this.#patternMatchingValidator,         // Priority 35
    this.#descriptorCoverageValidator,      // Priority 40
    this.#loadFailureValidator,             // Priority 50
    this.#recipeUsageValidator,             // Priority 60
  ].sort((a, b) => a.priority - b.priority);

  for (const validator of validators) {
    const result = await validator.validate(recipe, options);

    // Aggregate results
    results.errors.push(...result.errors);
    results.warnings.push(...result.warnings);
    results.suggestions.push(...result.suggestions);
    results.passed.push(...result.passed);

    // Stop if failFast and has errors
    if (validator.failFast && result.errors.length > 0) {
      break;
    }
  }
}
```

## Acceptance Criteria (per validator)

- [ ] Validator class created extending BaseValidator
- [ ] Inline method or external function migrated
- [ ] Dependencies injected via constructor with validation
- [ ] Uses ValidationResultBuilder for all results
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] All existing RecipePreflightValidator tests pass
- [ ] No changes to ValidationRule classes
- [ ] Integration test with RecipePreflightValidator passes

## Migration Strategy

For each validator:

1. **Create validator class** in `src/anatomy/validation/validators/[Name]Validator.js`
2. **Extract logic** from inline method or external function
3. **Write unit tests** following test pattern above
4. **Verify behavior** matches original implementation exactly
5. **Update RecipePreflightValidator** to use new validator
6. **Remove inline method** or external function call
7. **Run integration tests** to ensure no regression
8. **Update documentation** if behavior changes

## Special Considerations

### LoadFailureValidator
The `#checkEntityDefinitionLoadFailures` method accesses a stateful `loadFailures` map passed to RecipePreflightValidator constructor. This may require:
- Passing loadFailures as context in options
- Creating a stateful validator (breaks pattern)
- Or making it a service rather than validator

**Recommendation:** Analyze this validator separately and determine if it fits BaseValidator pattern or needs different approach.

### BodyDescriptorValidator Naming
To avoid confusion with existing `src/anatomy/validators/bodyDescriptorValidator.js` (system validator), use:
- `RecipeBodyDescriptorValidator` - Recipe-level validation against component schema
- Keep `BodyDescriptorValidator` - System-level registry consistency validation

## References

- **Base Class:** `src/anatomy/validation/validators/BaseValidator.js`
- **Result Builder:** `src/anatomy/validation/core/ValidationResultBuilder.js`
- **Validator Registry:** `src/anatomy/validation/core/ValidatorRegistry.js`
- **Current Orchestrator:** `src/anatomy/validation/RecipePreflightValidator.js` (1,064 lines)
- **Validation Report:** `reports/RECVALREF-011-validation-report.md`
- **Project Guidelines:** `CLAUDE.md` (500-line file limit)

## Sub-Tickets

Create individual tickets for each validator:
- RECVALREF-011-A: BlueprintExistenceValidator (P0)
- RECVALREF-011-B: RecipeBodyDescriptorValidator (P0)
- RECVALREF-011-C: SocketSlotCompatibilityValidator (P0)
- RECVALREF-011-D: PartAvailabilityValidator (P0)
- RECVALREF-011-E: GeneratedSlotPartsValidator (P0)
- RECVALREF-011-F: PatternMatchingValidator (P1)
- RECVALREF-011-G: RecipeUsageValidator (P1)
- RECVALREF-011-H: DescriptorCoverageValidator (P2)
- RECVALREF-011-I: LoadFailureValidator (P0 - special consideration)

**Total Sub-Tickets:** 9 (reduced from original 11)

## Success Metrics

- [ ] 8 new validator classes created (9 if LoadFailureValidator fits pattern)
- [ ] RecipePreflightValidator reduced to <500 lines
- [ ] 0 ValidationRule classes migrated (architectural boundary preserved)
- [ ] 80%+ test coverage for all new validators
- [ ] All existing tests pass without modification
- [ ] Clear documentation of ValidationRule vs BaseValidator patterns
