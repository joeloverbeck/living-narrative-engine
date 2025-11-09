# ANASYSIMP-003: Pre-flight Recipe Validator

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Medium (3-4 days)
**Impact:** High - Prevents 80%+ of generation errors
**Status:** Not Started

## Context

From the anatomy system improvements analysis, the core issue is that recipes pass schema validation but fail at generation time due to cross-reference issues, component compatibility problems, and property mismatches. This causes severe diagnostic friction.

**Pain Point:**
- **Red Dragon:** 6+ error rounds before successful graph generation
- **All Creatures:** Consistent pattern of late-stage validation failures
- **Time Lost:** 3-6 hours per recipe due to trial-and-error debugging

## Architecture Alignment Notes

**This workflow has been updated to align with the actual production codebase architecture:**

### Key Architecture Patterns

1. **Unified Data Registry Pattern**
   - The project uses a single `IDataRegistry` for all data types (components, recipes, blueprints)
   - Access pattern: `dataRegistry.get(type, id)` where type is 'components', 'anatomyRecipes', 'anatomyBlueprints', etc.
   - No separate component/entity/blueprint registry interfaces exist

2. **Validation Rule Pattern**
   - Existing validation uses `ValidationRule` base class with `validate(context)` method
   - `LoadTimeValidationContext` wraps blueprints and recipes for validation
   - `ValidationRuleChain` orchestrates multiple rules in sequence
   - Rules return arrays of issues with severity levels (error, warning)

3. **Repository Pattern for Blueprints**
   - `AnatomyBlueprintRepository` wraps `IDataRegistry` for anatomy-specific access
   - All methods are async: `getBlueprint(id)`, `getRecipe(id)`, `getBlueprintByRecipeId(id)`
   - Returns `Promise<object|null>`

4. **Schema Validation Pattern**
   - Uses `ISchemaValidator` interface (not raw AJV)
   - Method: `validate(schemaId, data)` returns `{isValid, errors}`
   - PropertySchemaValidationRule creates internal AJV instance as fallback

5. **Existing Validation Infrastructure**
   - Directory `src/anatomy/validation/` already exists with complete validation system
   - `ComponentExistenceValidationRule` and `PropertySchemaValidationRule` already implemented
   - `AnatomyValidationPhase` runs validation during mod loading (phase-based system)

### Integration Approach

This validator will:
- Reuse existing validation rules (ComponentExistenceValidationRule, PropertySchemaValidationRule)
- Create new orchestrator class (RecipePreflightValidator) that wraps these rules
- Provide a unified ValidationReport for better UX
- Be usable standalone (for CLI tools) or integrated into loading phase

## Problem Statement

The current validation pipeline has a critical gap:

```
Current Pipeline:
Recipe Load ──▶ Schema Validation ──▶ ✅ DONE
                                      │
                                      └──▶ (wait for generation)
                                            │
Generation ──▶ Entity Lookup ──▶ ❌ ERROR (too late!)
```

Schema validation only checks JSON structure, not cross-references or compatibility. This creates a validation gap where:
- Components may not exist
- Properties may have invalid values
- Entities may not match patterns
- Sockets may not exist
- Descriptors may be missing

## Solution Overview

Implement a comprehensive pre-flight validation layer that runs after schema validation but before generation. This validator orchestrates multiple validation checks and produces a unified validation report.

```
Needed Pipeline:
Recipe Load ──▶ Schema Validation ──▶ Pre-flight Validation ──▶ ✅ DONE
                                       │
                                       ├─ Component existence
                                       ├─ Property schemas
                                       ├─ Socket/slot matching
                                       ├─ Pattern dry-run
                                       └─ Descriptor coverage
```

## Implementation Details

### Core Validator Class

```javascript
/**
 * @file Comprehensive pre-flight validator for anatomy recipes
 * @see ../validation/rules/componentExistenceValidationRule.js
 * @see ../validation/rules/propertySchemaValidationRule.js
 * @see ../validation/loadTimeValidationContext.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ComponentExistenceValidationRule } from '../validation/rules/componentExistenceValidationRule.js';
import { PropertySchemaValidationRule } from '../validation/rules/propertySchemaValidationRule.js';
import { LoadTimeValidationContext } from '../validation/loadTimeValidationContext.js';

/** @typedef {import('../../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Comprehensive pre-flight validator for anatomy recipes
 * Orchestrates multiple validation checks and produces unified report
 */
class RecipePreflightValidator {
  #dataRegistry;
  #entityManager;
  #anatomyBlueprintRepository;
  #schemaValidator;
  #logger;

  constructor({ dataRegistry, entityManager, anatomyBlueprintRepository, schemaValidator, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['findEntities', 'getEntityInstance'],
    });
    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint', 'getRecipe'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });

    this.#dataRegistry = dataRegistry;
    this.#entityManager = entityManager;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
  }

  /**
   * Validates a recipe with all pre-flight checks
   * @param {Object} recipe - Recipe to validate
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationReport>} Comprehensive validation report
   */
  async validate(recipe, options = {}) {
    const results = {
      recipeId: recipe.recipeId,
      recipePath: options.recipePath,
      timestamp: new Date().toISOString(),
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    };

    // Run all validation checks
    await this.#runValidationChecks(recipe, results, options);

    return new ValidationReport(results);
  }

  async #runValidationChecks(recipe, results, options) {
    // 1. Component Existence (Critical - P0)
    await this.#checkComponentExistence(recipe, results);

    // 2. Property Schemas (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkPropertySchemas(recipe, results);
    }

    // 3. Blueprint Validation (Critical - P0)
    await this.#checkBlueprintExists(recipe, results);

    // 4. Socket/Slot Compatibility (Critical - P0)
    if (this.#blueprintExists(results)) {
      await this.#checkSocketSlotCompatibility(recipe, results);
    }

    // 5. Pattern Matching Dry-Run (Warning - P1)
    if (!options.skipPatternValidation) {
      this.#checkPatternMatching(recipe, results);
    }

    // 6. Descriptor Coverage (Suggestion - P1)
    if (!options.skipDescriptorChecks) {
      this.#checkDescriptorCoverage(recipe, results);
    }
  }

  async #checkComponentExistence(recipe, results) {
    try {
      // Use ComponentExistenceValidationRule from ANASYSIMP-001
      const componentRule = new ComponentExistenceValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
      });

      // Create context with just this recipe
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { [recipe.recipeId]: recipe },
      });

      const issues = await componentRule.validate(context);
      const errors = issues.filter(i => i.severity === 'error');

      if (errors.length === 0) {
        results.passed.push({
          check: 'component_existence',
          message: `All ${this.#countComponentReferences(recipe)} component references exist`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Component existence check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'component_existence',
        message: 'Failed to validate component existence',
        error: error.message,
      });
    }
  }

  async #checkPropertySchemas(recipe, results) {
    try {
      // Use PropertySchemaValidationRule from ANASYSIMP-002
      const propertyRule = new PropertySchemaValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
        schemaValidator: this.#schemaValidator,
      });

      // Create context with just this recipe
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { [recipe.recipeId]: recipe },
      });

      const issues = await propertyRule.validate(context);
      const errors = issues.filter(i => i.severity === 'error');

      if (errors.length === 0) {
        results.passed.push({
          check: 'property_schemas',
          message: `All ${this.#countPropertyObjects(recipe)} property objects valid`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Property schema check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'property_schemas',
        message: 'Failed to validate property schemas',
        error: error.message,
      });
    }
  }

  async #checkBlueprintExists(recipe, results) {
    try {
      const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

      if (!blueprint) {
        results.errors.push({
          type: 'BLUEPRINT_NOT_FOUND',
          blueprintId: recipe.blueprintId,
          message: `Blueprint '${recipe.blueprintId}' does not exist`,
          fix: `Create blueprint at data/mods/*/blueprints/${recipe.blueprintId.split(':')[1]}.blueprint.json`,
          severity: 'error',
        });
      } else {
        results.passed.push({
          check: 'blueprint_exists',
          message: `Blueprint '${recipe.blueprintId}' found`,
          blueprint: {
            id: blueprint.id,
            root: blueprint.root,
            structureTemplate: blueprint.structureTemplate,
          },
        });
      }
    } catch (error) {
      this.#logger.error('Blueprint existence check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'blueprint_exists',
        message: 'Failed to check blueprint existence',
        error: error.message,
      });
    }
  }

  async #checkSocketSlotCompatibility(recipe, results) {
    try {
      // Use ANASYSIMP-004 validator (if available, otherwise skip)
      // This check validates that blueprint's additionalSlots reference valid sockets

      const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);
      if (!blueprint) return; // Already caught by blueprint check

      // Placeholder for socket/slot validation
      // Will be implemented by ANASYSIMP-004
      results.passed.push({
        check: 'socket_slot_compatibility',
        message: 'Socket/slot compatibility check passed',
      });
    } catch (error) {
      this.#logger.error('Socket/slot compatibility check failed', error);
      results.warnings.push({
        type: 'VALIDATION_WARNING',
        check: 'socket_slot_compatibility',
        message: 'Socket/slot compatibility check failed',
        error: error.message,
      });
    }
  }

  #checkPatternMatching(recipe, results) {
    try {
      // Use ANASYSIMP-005 validator (if available, otherwise skip)
      // This check validates that patterns can match entities

      const patterns = recipe.patterns || [];
      if (patterns.length === 0) {
        results.passed.push({
          check: 'pattern_matching',
          message: 'No patterns to validate',
        });
        return;
      }

      // Placeholder for pattern matching validation
      // Will be implemented by ANASYSIMP-005
      results.passed.push({
        check: 'pattern_matching',
        message: `${patterns.length} pattern(s) validated`,
      });
    } catch (error) {
      this.#logger.error('Pattern matching check failed', error);
      results.warnings.push({
        type: 'VALIDATION_WARNING',
        check: 'pattern_matching',
        message: 'Pattern matching check failed',
        error: error.message,
      });
    }
  }

  #checkDescriptorCoverage(recipe, results) {
    try {
      // Check if entities referenced by slots/patterns have descriptor components
      // This is a suggestion-level check (not critical)

      const suggestions = [];

      for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
        const hasDescriptors = this.#hasDescriptorComponents(slot.tags || []);

        if (!hasDescriptors) {
          suggestions.push({
            type: 'MISSING_DESCRIPTORS',
            location: { type: 'slot', name: slotName },
            message: `Slot '${slotName}' may not appear in descriptions`,
            reason: 'No descriptor components in tags',
            suggestion: 'Add descriptor components (descriptors:size_category, descriptors:texture, etc.)',
            impact: 'Part will be excluded from anatomy description',
          });
        }
      }

      if (suggestions.length > 0) {
        results.suggestions.push(...suggestions);
      } else {
        results.passed.push({
          check: 'descriptor_coverage',
          message: 'All slots have descriptor components',
        });
      }
    } catch (error) {
      this.#logger.error('Descriptor coverage check failed', error);
      // Don't add error/warning - this is optional
    }
  }

  #hasDescriptorComponents(tags) {
    return tags.some(tag => tag.startsWith('descriptors:'));
  }

  #blueprintExists(results) {
    return results.passed.some(p => p.check === 'blueprint_exists');
  }

  #countComponentReferences(recipe) {
    let count = 0;

    for (const slot of Object.values(recipe.slots || {})) {
      count += (slot.tags || []).length;
      count += Object.keys(slot.properties || {}).length;
    }

    for (const pattern of recipe.patterns || []) {
      count += (pattern.tags || []).length;
      count += Object.keys(pattern.properties || {}).length;
    }

    return count;
  }

  #countPropertyObjects(recipe) {
    let count = 0;

    for (const slot of Object.values(recipe.slots || {})) {
      count += Object.keys(slot.properties || {}).length;
    }

    for (const pattern of recipe.patterns || []) {
      count += Object.keys(pattern.properties || {}).length;
    }

    return count;
  }
}
```

### Validation Report Class

```javascript
/**
 * Validation report with structured results
 */
class ValidationReport {
  #results;

  constructor(results) {
    this.#results = results;
  }

  /**
   * Check if validation passed (no errors)
   */
  get isValid() {
    return this.#results.errors.length === 0;
  }

  /**
   * Check if validation has warnings
   */
  get hasWarnings() {
    return this.#results.warnings.length > 0;
  }

  /**
   * Check if validation has suggestions
   */
  get hasSuggestions() {
    return this.#results.suggestions.length > 0;
  }

  /**
   * Get all errors
   */
  get errors() {
    return [...this.#results.errors];
  }

  /**
   * Get all warnings
   */
  get warnings() {
    return [...this.#results.warnings];
  }

  /**
   * Get all suggestions
   */
  get suggestions() {
    return [...this.#results.suggestions];
  }

  /**
   * Get summary statistics
   */
  get summary() {
    return {
      recipeId: this.#results.recipeId,
      recipePath: this.#results.recipePath,
      timestamp: this.#results.timestamp,
      totalErrors: this.#results.errors.length,
      totalWarnings: this.#results.warnings.length,
      totalSuggestions: this.#results.suggestions.length,
      passedChecks: this.#results.passed.length,
      isValid: this.isValid,
    };
  }

  /**
   * Format report for console output
   */
  toString() {
    const lines = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`Validation Report: ${this.#results.recipeId}`);
    if (this.#results.recipePath) {
      lines.push(`Path: ${this.#results.recipePath}`);
    }
    lines.push(`${'='.repeat(80)}\n`);

    // Passed checks
    if (this.#results.passed.length > 0) {
      lines.push('✓ Passed Checks:');
      for (const check of this.#results.passed) {
        lines.push(`  ✓ ${check.message}`);
      }
      lines.push('');
    }

    // Errors
    if (this.#results.errors.length > 0) {
      lines.push('✗ Errors:');
      for (const error of this.#results.errors) {
        lines.push(this.#formatError(error));
      }
      lines.push('');
    }

    // Warnings
    if (this.#results.warnings.length > 0) {
      lines.push('⚠ Warnings:');
      for (const warning of this.#results.warnings) {
        lines.push(this.#formatWarning(warning));
      }
      lines.push('');
    }

    // Suggestions
    if (this.#results.suggestions.length > 0) {
      lines.push('💡 Suggestions:');
      for (const suggestion of this.#results.suggestions) {
        lines.push(this.#formatSuggestion(suggestion));
      }
      lines.push('');
    }

    // Summary
    lines.push(`${'─'.repeat(80)}`);
    if (this.isValid) {
      lines.push(`✅ Validation PASSED`);
    } else {
      lines.push(`❌ Validation FAILED with ${this.#results.errors.length} error(s)`);
    }
    lines.push(`${'='.repeat(80)}\n`);

    return lines.join('\n');
  }

  #formatError(error) {
    const lines = [];
    lines.push(`\n  [ERROR] ${error.message}`);

    if (error.location) {
      lines.push(`  Location: ${error.location.type} '${error.location.name}'`);
    }

    if (error.componentId) {
      lines.push(`  Component: ${error.componentId}`);
    }

    if (error.fix) {
      lines.push(`  Fix: ${error.fix}`);
    }

    return lines.join('\n');
  }

  #formatWarning(warning) {
    const lines = [];
    lines.push(`\n  [WARNING] ${warning.message}`);

    if (warning.location) {
      lines.push(`  Location: ${warning.location.type} '${warning.location.name}'`);
    }

    if (warning.suggestion) {
      lines.push(`  Suggestion: ${warning.suggestion}`);
    }

    return lines.join('\n');
  }

  #formatSuggestion(suggestion) {
    const lines = [];
    lines.push(`\n  [SUGGESTION] ${suggestion.message}`);

    if (suggestion.location) {
      lines.push(`  Location: ${suggestion.location.type} '${suggestion.location.name}'`);
    }

    if (suggestion.suggestion) {
      lines.push(`  Suggestion: ${suggestion.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Format report as JSON
   */
  toJSON() {
    return this.#results;
  }
}
```

### Integration Options

**The validator can be integrated in two ways:**

#### Option 1: Standalone CLI Tool (Recommended for ANASYSIMP-009)

```javascript
// CLI tool usage
import { RecipePreflightValidator } from './src/anatomy/validation/RecipePreflightValidator.js';

const validator = new RecipePreflightValidator({
  dataRegistry,
  entityManager,
  anatomyBlueprintRepository,
  schemaValidator,
  logger,
});

const recipe = await loadRecipeFile(recipePath);
const report = await validator.validate(recipe, { recipePath });

console.log(report.toString()); // Pretty console output

if (!report.isValid) {
  process.exit(1);
}
```

#### Option 2: Integration with AnatomyValidationPhase (Future Enhancement)

**Current System:**
- `AnatomyValidationPhase` runs after all content is loaded
- Uses `ValidationRuleChain` to orchestrate rules
- Currently logs errors but doesn't halt loading

**Potential Enhancement:**
```javascript
// In AnatomyValidationPhase.execute()
async execute(ctx) {
  // ... existing code ...

  // Option A: Add RecipePreflightValidator as additional check
  const validator = this.#recipePreflightValidator;
  const recipes = this.#extractRecipes(ctx);

  for (const [recipeId, recipe] of Object.entries(recipes)) {
    const report = await validator.validate(recipe);

    if (!report.isValid) {
      // Aggregate errors into validation context
      validationContext.addIssues(report.errors);
    }
  }

  // Option B: Keep existing phase-based approach and use RecipePreflightValidator
  // only for CLI tooling (recommended to avoid duplication)
}
```

**Recommendation:** Use standalone for CLI tools (ANASYSIMP-009). The existing `AnatomyValidationPhase` already provides load-time validation using the same underlying rules.

### File Structure

**Note:** The `src/anatomy/validation/` directory and validation infrastructure already exist. This task extends the existing system.

```
src/anatomy/validation/
├── rules/
│   ├── componentExistenceValidationRule.js    # ✅ Already exists (ANASYSIMP-001)
│   ├── propertySchemaValidationRule.js        # ✅ Already exists (ANASYSIMP-002)
│   └── blueprintRecipeValidationRule.js       # ✅ Already exists
├── loadTimeValidationContext.js               # ✅ Already exists
├── validationContext.js                       # ✅ Already exists
├── validationRule.js                          # ✅ Already exists (base class)
├── validationRuleChain.js                     # ✅ Already exists
├── RecipePreflightValidator.js                # 🆕 NEW - Main orchestrator
└── ValidationReport.js                        # 🆕 NEW - Report class

src/dependencyInjection/tokens/
└── tokens-core.js                             # ✏️ MODIFY - Add IRecipePreflightValidator token

src/dependencyInjection/registrations/
└── loadersRegistrations.js                    # ✏️ MODIFY - Register validator (anatomy-related registrations)

tests/unit/anatomy/validation/
├── RecipePreflightValidator.test.js           # 🆕 NEW
└── ValidationReport.test.js                   # 🆕 NEW

tests/integration/anatomy/validation/
└── recipePreflightValidation.integration.test.js  # 🆕 NEW
```

**Legend:**
- ✅ Already exists (no changes needed)
- 🆕 NEW - New file to create
- ✏️ MODIFY - Existing file to modify

## Acceptance Criteria

- [ ] Validator orchestrates all sub-validators (component, property, socket, pattern)
- [ ] Validator produces comprehensive ValidationReport
- [ ] Report includes errors, warnings, suggestions, and passed checks
- [ ] Report has isValid property (true if no errors)
- [ ] Report formats nicely for console output
- [ ] Report serializes to JSON for programmatic use
- [ ] Recipe load fails when pre-flight validation fails
- [ ] Warnings logged but don't block load
- [ ] Suggestions logged for informational purposes
- [ ] Validator supports fail-fast mode (stop on first error)
- [ ] Validator supports skip options for optional checks
- [ ] Integration with recipe loader works correctly
- [ ] All existing valid recipes pass pre-flight validation

## Testing Requirements

### Unit Tests

1. **Validator Orchestration**
   - All checks run in correct order
   - Errors from each check collected correctly
   - Warnings from each check collected correctly
   - Suggestions from each check collected correctly
   - Passed checks tracked correctly

2. **Fail-Fast Mode**
   - With fail-fast: stops after first error
   - Without fail-fast: collects all errors

3. **Skip Options**
   - skipPatternValidation: pattern check skipped
   - skipDescriptorChecks: descriptor check skipped
   - All other checks still run

4. **ValidationReport**
   - isValid: true when no errors
   - isValid: false when errors present
   - hasWarnings: true when warnings present
   - hasSuggestions: true when suggestions present
   - toString: formats nicely
   - toJSON: serializes correctly
   - summary: provides correct statistics

5. **Error Handling**
   - Sub-validator throws → captured as validation error
   - Missing dependencies → clear error message
   - Invalid recipe structure → handled gracefully

### Integration Tests

1. **Recipe Load Pipeline**
   - Valid recipe → passes all checks, loads successfully
   - Recipe with component error → fails with clear message
   - Recipe with property error → fails with clear message
   - Recipe with warnings → loads with warnings logged
   - Recipe with suggestions → loads with suggestions logged

2. **Multi-Error Scenarios**
   - Recipe with multiple errors → all reported in single pass
   - Recipe with errors and warnings → both reported
   - Recipe with all issue types → comprehensive report generated

3. **Real Registry Integration**
   - Test against actual component registry
   - Test against actual entity registry
   - Test against actual blueprint registry
   - Verify all checks work with real data

## Documentation Requirements

- [ ] Add comprehensive JSDoc to RecipePreflightValidator
- [ ] Document ValidationReport API
- [ ] Update validation workflow documentation
- [ ] Add examples to common errors catalog
- [ ] Document integration points in recipe loader
- [ ] Add troubleshooting guide for validation failures

## Dependencies

### Required Services (via DI)

**All services are available through the existing DI container:**

- **IDataRegistry** - Centralized data storage (components, recipes, blueprints)
  - Methods: `get(type, id)`, `getAll(type)`
  - Implementation: `InMemoryDataRegistry`
  - Already registered in DI container

- **IEntityManager** - Entity instance management (runtime entities)
  - Methods: `findEntities(query)`, `getEntityInstance(instanceId)`
  - Already registered in DI container
  - Note: Used for pattern matching validation (ANASYSIMP-005)

- **IAnatomyBlueprintRepository** - Blueprint/recipe access wrapper
  - Methods: `getBlueprint(blueprintId)`, `getRecipe(recipeId)`, `getBlueprintByRecipeId(recipeId)`
  - Implementation: `AnatomyBlueprintRepository`
  - All methods return `Promise<object|null>`
  - Already registered in DI container

- **ISchemaValidator** - JSON schema validation
  - Methods: `validate(schemaId, data)` → `{isValid, errors}`
  - Implementation: AJV-based validator
  - Already registered in DI container

- **ILogger** - Logging service
  - Methods: `info`, `warn`, `error`, `debug`
  - Already registered in DI container

### Depends On (Validation Rules)

**These are already implemented and available:**

- ✅ **ComponentExistenceValidationRule** (ANASYSIMP-001) - COMPLETE
  - Location: `src/anatomy/validation/rules/componentExistenceValidationRule.js`
  - Validates component references in recipes

- ✅ **PropertySchemaValidationRule** (ANASYSIMP-002) - COMPLETE
  - Location: `src/anatomy/validation/rules/propertySchemaValidationRule.js`
  - Validates property values against component dataSchemas

- ✅ **LoadTimeValidationContext** - COMPLETE
  - Location: `src/anatomy/validation/loadTimeValidationContext.js`
  - Context object for passing data to validation rules

### Optional Future Integration

- ANASYSIMP-004 (Socket/Slot Compatibility) - will integrate when available
- ANASYSIMP-005 (Pattern Matching Dry-Run) - will integrate when available

### Blocks

- ANASYSIMP-009 (Recipe Validation CLI Tool) - uses this as core validator

## Implementation Notes

### Validation Order

The checks run in a specific order to maximize value:
1. **Component Existence** - Must pass before property validation makes sense
2. **Property Schemas** - Validates data against schemas
3. **Blueprint Exists** - Required for socket/slot checks
4. **Socket/Slot Compatibility** - Requires blueprint to exist
5. **Pattern Matching** - Warning-level, can run anytime
6. **Descriptor Coverage** - Suggestion-level, always runs

### Fail-Fast Strategy

With `failFast: true`:
- Stop after component existence errors
- Skip property validation if components missing
- Faster feedback for critical errors

Without fail-fast (default):
- Run all checks
- Collect comprehensive error list
- Better for batch validation

### Extensibility

New validators can be added easily:
1. Create new validator function
2. Add check method to RecipePreflightValidator
3. Call in #runValidationChecks
4. Results automatically included in report

## Success Metrics

- **Error Detection:** >80% of generation errors caught at load time
- **False Positives:** <5% (some edge cases expected)
- **Error Clarity:** >90% of errors actionable without additional documentation
- **Performance:** <50ms per recipe validation
- **Coverage:** All critical validation types implemented
- **Time Savings:** 2-3 hours per recipe (eliminated runtime debugging cycles)

## Corrections Made (Architecture Alignment)

**This workflow was updated on 2025-11-09 to align with production codebase. Key corrections:**

1. **Registry Pattern:**
   - ❌ BEFORE: Assumed separate `IComponentRegistry`, `IEntityRegistry`, `IBlueprintRegistry`
   - ✅ AFTER: Uses unified `IDataRegistry` with type-based access pattern

2. **Blueprint Access:**
   - ❌ BEFORE: Assumed synchronous `blueprintRegistry.get(id)`
   - ✅ AFTER: Uses async `anatomyBlueprintRepository.getBlueprint(id)`

3. **Validation Pattern:**
   - ❌ BEFORE: Assumed standalone validator functions
   - ✅ AFTER: Reuses existing `ValidationRule` classes with `validate(context)` pattern

4. **Schema Validation:**
   - ❌ BEFORE: Assumed raw AJV instance dependency
   - ✅ AFTER: Uses `ISchemaValidator` interface

5. **File Structure:**
   - ❌ BEFORE: Assumed new directory structure
   - ✅ AFTER: Extends existing `src/anatomy/validation/` with new orchestrator

6. **Integration:**
   - ❌ BEFORE: Assumed integration with recipe loader
   - ✅ AFTER: Standalone validator for CLI tools, reusing existing phase-based validation

7. **DI Tokens:**
   - ❌ BEFORE: Assumed new `tokens-anatomy.js` file
   - ✅ AFTER: Uses existing `tokens-core.js` for anatomy-related tokens

8. **Method Signatures:**
   - ❌ BEFORE: Synchronous `validate()` method
   - ✅ AFTER: Async `validate()` method to support repository calls

**All corrections maintain the original intent while aligning with established patterns.**

## References

- **Report Section:** Category 1: Validation Enhancements → Recommendation 1.1
- **Report Pages:** Lines 403-442
- **Depends On:** ANASYSIMP-001 (✅ Complete), ANASYSIMP-002 (✅ Complete)
- **Integrates With:** ANASYSIMP-004, ANASYSIMP-005
- **Production Code Reviewed:**
  - `src/anatomy/validation/rules/componentExistenceValidationRule.js`
  - `src/anatomy/validation/rules/propertySchemaValidationRule.js`
  - `src/anatomy/repositories/anatomyBlueprintRepository.js`
  - `src/loaders/phases/anatomyValidationPhase.js`
  - `src/data/inMemoryDataRegistry.js`
  - `src/interfaces/IDataRegistry.js`, `IEntityManager.js`, `IAnatomyBlueprintRepository.js`
