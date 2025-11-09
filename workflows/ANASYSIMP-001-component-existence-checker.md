# ANASYSIMP-001: Component Existence Checker

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Low (1 day)
**Impact:** High - Prevents component existence errors
**Status:** Not Started

## Context

From the anatomy system improvements analysis, a critical validation gap exists: recipes can reference components that don't exist, with errors only surfacing at runtime during entity instantiation. This causes immediate generation failures with unclear error messages.

**Example Error from Red Dragon:**
```
Error: "No entity definitions found. Required components: [anatomy:part, anatomy:horned]"
Location: Part selection service
Issue: anatomy:horned component didn't exist in system
Root Cause: No component existence validation at recipe load
```

## Problem Statement

Recipes are accepted at load time even when they reference non-existent components. The validation only happens during generation when components are needed for entity instantiation, leading to:
- Late error discovery (after full rebuild/reload cycle)
- Unclear error context
- Trial-and-error component creation
- Poor developer experience

## Solution Overview

Implement component existence validation that runs after schema validation during recipe load. The validator should:
1. Extract all component references from recipe (slots and patterns)
2. Verify existence in component registry
3. Generate actionable error messages with file path suggestions
4. Block generation if critical components are missing

## Implementation Details

### Core Validation Function

```javascript
/**
 * Validates that all components referenced in the recipe exist in the data registry
 * @param {Object} recipe - The recipe to validate
 * @param {IDataRegistry} dataRegistry - Registry of loaded game data
 * @returns {Array<Object>} Array of errors found
 */
function validateComponentExistence(recipe, dataRegistry) {
  const errors = [];

  // Helper function to check component existence
  const componentExists = (componentId) => {
    return dataRegistry.get('components', componentId) !== undefined;
  };

  // Check slot component requirements
  for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
    // Check tags
    for (const componentId of slot.tags || []) {
      if (!componentExists(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'slot', name: slotName, field: 'tags' },
          componentId: componentId,
          message: `Component '${componentId}' does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }

    // Check notTags
    for (const componentId of slot.notTags || []) {
      if (!componentExists(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'slot', name: slotName, field: 'notTags' },
          componentId: componentId,
          message: `Component '${componentId}' does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }

    // Check slot property components (keys are component IDs)
    for (const componentId of Object.keys(slot.properties || {})) {
      if (!componentExists(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'slot', name: slotName, context: 'properties' },
          componentId: componentId,
          message: `Component '${componentId}' referenced in properties does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }
  }

  // Check pattern component requirements
  for (const pattern of recipe.patterns || []) {
    // Determine pattern identifier (supports v1 and v2 patterns)
    const patternId = pattern.matchesPattern || pattern.matchesGroup ||
                      (pattern.matches ? pattern.matches.join(',') : null) ||
                      (pattern.matchesAll ? 'matchesAll' : 'unknown');

    // Check tags
    for (const componentId of pattern.tags || []) {
      if (!componentExists(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'pattern', name: patternId, field: 'tags' },
          componentId: componentId,
          message: `Component '${componentId}' does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }

    // Check notTags
    for (const componentId of pattern.notTags || []) {
      if (!componentExists(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'pattern', name: patternId, field: 'notTags' },
          componentId: componentId,
          message: `Component '${componentId}' does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }

    // Check pattern property components (keys are component IDs)
    for (const componentId of Object.keys(pattern.properties || {})) {
      if (!componentExists(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'pattern', name: patternId, context: 'properties' },
          componentId: componentId,
          message: `Component '${componentId}' referenced in properties does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }
  }

  // Check constraint component requirements
  if (recipe.constraints) {
    // Check requires constraints
    for (const [index, requireGroup] of (recipe.constraints.requires || []).entries()) {
      for (const componentId of requireGroup.components || []) {
        if (!componentExists(componentId)) {
          errors.push({
            type: 'COMPONENT_NOT_FOUND',
            location: { type: 'constraint', name: 'requires', index, field: 'components' },
            componentId: componentId,
            message: `Component '${componentId}' does not exist`,
            fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
            severity: 'error',
          });
        }
      }
    }

    // Check excludes constraints
    for (const [index, excludeGroup] of (recipe.constraints.excludes || []).entries()) {
      for (const componentId of excludeGroup.components || []) {
        if (!componentExists(componentId)) {
          errors.push({
            type: 'COMPONENT_NOT_FOUND',
            location: { type: 'constraint', name: 'excludes', index, field: 'components' },
            componentId: componentId,
            message: `Component '${componentId}' does not exist`,
            fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
            severity: 'error',
          });
        }
      }
    }
  }

  return errors;
}
```

### Integration Points

1. **Validation Phase Integration**
   - File: `src/loaders/phases/anatomyValidationPhase.js`
   - Pattern: Chain of Responsibility (ValidationRuleChain)
   - Hook: Validation runs AFTER content loading phase
   - Existing: `BlueprintRecipeValidationRule` validates blueprint-recipe relationships
   - New: Add `ComponentExistenceValidationRule` to the validation chain
   - Action: Validation errors are logged but don't halt loading (development mode)

2. **Data Registry Access**
   - File: `src/data/inMemoryDataRegistry.js` - Core storage implementation
   - Wrapper: `src/data/gameDataRepository.js` - Facade with typed getters
   - Method: `dataRegistry.get('components', componentId)` - Returns component or undefined
   - Alternative: `gameDataRepository.getComponentDefinition(componentId)` - Returns component or null
   - Storage Key: Components stored under type `'components'`
   - Component ID Format: Namespaced (e.g., `'anatomy:part'`, `'anatomy:horned'`)

3. **Error Reporting**
   - Format errors for developer consumption via `LoadTimeValidationContext`
   - Include recipe ID and file context in error messages
   - Use structured error objects with type, location, severity
   - Suggest example component files for reference
   - Log warnings for non-blocking issues

### File Structure

```
src/anatomy/validation/
├── rules/
│   ├── blueprintRecipeValidationRule.js          # Existing: Blueprint-recipe validation
│   └── componentExistenceValidationRule.js       # New: Component existence validation
├── validationRuleChain.js                        # Existing: Chain of Responsibility
└── loadTimeValidationContext.js                  # Existing: Validation context

src/loaders/phases/
└── anatomyValidationPhase.js                     # Update: Add new rule to chain

tests/unit/anatomy/validation/rules/
└── componentExistenceValidationRule.test.js      # Unit tests for validation logic

tests/integration/anatomy/validation/
└── componentExistenceValidation.integration.test.js  # Integration tests with registry
```

## Acceptance Criteria

- [ ] Validator detects missing components in recipe slot `tags`
- [ ] Validator detects missing components in recipe slot `notTags`
- [ ] Validator detects missing components in recipe slot `properties` (component ID keys)
- [ ] Validator detects missing components in recipe pattern `tags`
- [ ] Validator detects missing components in recipe pattern `notTags`
- [ ] Validator detects missing components in recipe pattern `properties` (component ID keys)
- [ ] Validator detects missing components in `constraints.requires[].components`
- [ ] Validator detects missing components in `constraints.excludes[].components`
- [ ] Validator supports all pattern types (v1 `matches`, v2 `matchesPattern`, `matchesGroup`, `matchesAll`)
- [ ] Errors include component ID, location (slot/pattern/constraint), field, and fix suggestion
- [ ] Errors include file path suggestion for component creation
- [ ] Validation results are logged but don't halt loading (development mode)
- [ ] Error messages are clear and actionable
- [ ] Validator integrates with `AnatomyValidationPhase` via validation chain
- [ ] All existing recipes pass validation (no false positives)

## Testing Requirements

### Unit Tests

1. **Basic Component Detection**
   - Recipe with missing component in slot `tags`
   - Recipe with missing component in slot `notTags`
   - Recipe with missing component in slot `properties` (component ID key)
   - Recipe with missing component in pattern `tags`
   - Recipe with missing component in pattern `notTags`
   - Recipe with missing component in pattern `properties` (component ID key)
   - Recipe with missing component in `constraints.requires[].components`
   - Recipe with missing component in `constraints.excludes[].components`
   - Recipe with all components present (no errors)

2. **Pattern Type Support**
   - V1 pattern with `matches` array
   - V2 pattern with `matchesPattern` (wildcard)
   - V2 pattern with `matchesGroup` (slot group selector)
   - V2 pattern with `matchesAll` (property-based matching)
   - Pattern identifier correctly included in error location

3. **Error Message Format**
   - Error includes component ID
   - Error includes location context (type, name, field, index where applicable)
   - Error includes fix suggestion
   - Error includes severity level

4. **Edge Cases**
   - Recipe with no slots (empty slots object)
   - Recipe with no patterns (empty patterns array)
   - Recipe with no constraints
   - Recipe with empty tags/notTags arrays
   - Recipe with empty properties object
   - Recipe with empty constraints.requires/excludes
   - Component ID with namespace (e.g., "anatomy:horned")
   - Component ID without namespace (should still validate against registry)

### Integration Tests

1. **Validation Phase Integration**
   - Load recipe with missing component → validation logs errors
   - Load recipe with all components → validation passes
   - Validation errors include recipe ID and context
   - Validation results attached to load context

2. **Real Data Registry**
   - Test against actual `InMemoryDataRegistry` instance
   - Verify `dataRegistry.get('components', id)` calls work correctly
   - Test with multiple mods loaded (component namespace resolution)
   - Test component lookup with fully qualified IDs (e.g., `'anatomy:part'`)

3. **Validation Rule Chain**
   - `ComponentExistenceValidationRule` integrates with `ValidationRuleChain`
   - Rule receives `LoadTimeValidationContext` with blueprints and recipes
   - Rule adds issues to validation context
   - Issues are categorized by severity (error vs warning)

## Documentation Requirements

- [ ] Add JSDoc comments to validation function
- [ ] Document integration points in validation workflow docs
- [ ] Add example error messages to common errors catalog
- [ ] Update recipe creation checklist with component existence requirement

## Dependencies

**Required:**
- Component registry with `has(componentId)` method
- Recipe loader with validation hook
- Error handling infrastructure

**Depends On:**
- None (this is a foundational validator)

**Blocks:**
- ANASYSIMP-003 (Pre-flight Recipe Validator - uses this)
- ANASYSIMP-009 (Recipe Validation CLI Tool - uses this)

## Implementation Notes

### Data Registry Access

The validator needs access to the data registry for component lookups. The system uses dependency injection:

```javascript
/**
 * Validation rule for checking component existence
 * Implements the validation rule interface for use with ValidationRuleChain
 */
class ComponentExistenceValidationRule {
  #dataRegistry;
  #logger;

  /**
   * @param {object} deps
   * @param {IDataRegistry} deps.dataRegistry - Registry with component definitions
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Executes validation rule
   * @param {LoadTimeValidationContext} context - Validation context
   * @returns {Promise<void>}
   */
  async execute(context) {
    const recipes = context.getRecipes();

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const errors = this.#validateComponentExistence(recipe);

      for (const error of errors) {
        context.addIssue({
          recipeId,
          ...error,
        });
      }
    }
  }

  #validateComponentExistence(recipe) {
    // Core validation logic here
    // Returns array of error objects
  }
}
```

### Registry Lookup Pattern

```javascript
// Check if component exists in registry
const componentExists = (componentId) => {
  return this.#dataRegistry.get('components', componentId) !== undefined;
};

// Alternative using GameDataRepository
const componentExists = (componentId) => {
  return this.#gameDataRepository.getComponentDefinition(componentId) !== null;
};
```

### Recipe File Location

Recipes are stored in the following structure:
```
data/mods/
├── anatomy/
│   └── recipes/
│       ├── human_female.recipe.json
│       ├── red_dragon.recipe.json
│       └── ...
└── core/
    └── recipes/
        └── examples/
            └── ...
```

Loaded by: `src/loaders/anatomyRecipeLoader.js`
Stored as: Type `'anatomyRecipes'` in data registry

### Error Message Template

```
[ERROR] Component 'anatomy:horned' not found

Recipe:   anatomy:red_dragon (data/mods/anatomy/recipes/red_dragon.recipe.json)
Location: Slot 'head', field 'tags'
Problem:  Component 'anatomy:horned' does not exist in the component registry
Impact:   Head slot cannot be processed, anatomy generation will fail
Fix:      Create component at: data/mods/anatomy/components/horned.component.json

Example Component Structure:
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:horned",
  "description": "Marks an anatomy part as having horns",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}

References:
  - docs/anatomy/components.md
  - data/mods/anatomy/components/part.component.json (similar example)
  - data/mods/anatomy/components/scaled.component.json (similar example)
```

### Performance Considerations

- Validation runs once per recipe during the anatomy validation phase (after content loading)
- Component registry lookups are O(1) with Map internal storage
- Expected recipe size: 10-50 component references across slots, patterns, and constraints
- Performance impact: negligible (<5ms per recipe)
- Validation phase is non-blocking: errors are logged but don't halt application startup
- All validation happens synchronously in a single phase

## Success Metrics

- **Error Detection:** 100% of missing component errors caught at load time
- **False Positives:** 0% (all existing recipes pass)
- **Error Clarity:** >90% of errors actionable without documentation lookup
- **Time Savings:** 30-45 minutes per missing component error (eliminated runtime debugging)

## References

- **Report Section:** Category 1: Validation Enhancements → Recommendation 1.2
- **Report Pages:** Lines 444-496
- **Error Examples:** Red Dragon Error Round 5 (lines 217-225)
- **Related Validators:** Property Schema Validator (ANASYSIMP-002)
