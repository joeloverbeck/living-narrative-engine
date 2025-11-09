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
 * Validates that all components referenced in the recipe exist in the component registry
 * @param {Object} recipe - The recipe to validate
 * @param {Object} componentRegistry - Registry of loaded components
 * @returns {Array<Object>} Array of errors found
 */
function validateComponentExistence(recipe, componentRegistry) {
  const errors = [];

  // Check slot component requirements
  for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
    for (const componentId of slot.tags || []) {
      if (!componentRegistry.has(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'slot', name: slotName },
          componentId: componentId,
          message: `Component '${componentId}' does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }

    // Check slot property components
    for (const componentId of Object.keys(slot.properties || {})) {
      if (!componentRegistry.has(componentId)) {
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
    const patternId = pattern.matchesPattern || pattern.matchesGroup || 'unknown';

    for (const componentId of pattern.tags || []) {
      if (!componentRegistry.has(componentId)) {
        errors.push({
          type: 'COMPONENT_NOT_FOUND',
          location: { type: 'pattern', name: patternId },
          componentId: componentId,
          message: `Component '${componentId}' does not exist`,
          fix: `Create component at data/mods/*/components/${componentId.split(':')[1]}.component.json`,
          severity: 'error',
        });
      }
    }

    // Check pattern property components
    for (const componentId of Object.keys(pattern.properties || {})) {
      if (!componentRegistry.has(componentId)) {
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

  return errors;
}
```

### Integration Points

1. **Recipe Loader Hook**
   - File: `src/loaders/recipeLoader.js` or similar
   - Hook: After schema validation, before storing in registry
   - Action: Run component existence check, throw on errors

2. **Component Registry Access**
   - File: `src/entities/componentRegistry.js` or similar
   - Method: `has(componentId)` - Check if component exists
   - Method: `get(componentId)` - Retrieve component metadata (for future use)

3. **Error Reporting**
   - Format errors for developer consumption
   - Include recipe file path in error context
   - Suggest example component files for reference

### File Structure

```
src/anatomy/validation/
├── componentExistenceValidator.js  # Main validator
└── validationErrors.js             # Error class definitions

tests/unit/anatomy/validation/
└── componentExistenceValidator.test.js

tests/integration/anatomy/validation/
└── recipeLoadValidation.integration.test.js
```

## Acceptance Criteria

- [ ] Validator detects missing components in recipe slots
- [ ] Validator detects missing components in recipe patterns
- [ ] Validator detects missing components in slot properties
- [ ] Validator detects missing components in pattern properties
- [ ] Errors include component ID, location (slot/pattern name), and fix suggestion
- [ ] Errors include file path suggestion for component creation
- [ ] Recipe load fails when critical components are missing
- [ ] Error messages are clear and actionable
- [ ] Validator integrates with recipe load pipeline
- [ ] All existing recipes pass validation (no false positives)

## Testing Requirements

### Unit Tests

1. **Basic Component Detection**
   - Recipe with missing component in slot tags
   - Recipe with missing component in pattern tags
   - Recipe with missing component in slot properties
   - Recipe with missing component in pattern properties
   - Recipe with all components present (no errors)

2. **Error Message Format**
   - Error includes component ID
   - Error includes location context
   - Error includes fix suggestion
   - Error includes severity level

3. **Edge Cases**
   - Recipe with no slots (empty slots object)
   - Recipe with no patterns (empty patterns array)
   - Recipe with empty tags array
   - Recipe with empty properties object
   - Component ID with namespace (e.g., "anatomy:horned")
   - Component ID without namespace (invalid, should error)

### Integration Tests

1. **Recipe Load Pipeline**
   - Load recipe with missing component → should fail
   - Load recipe with all components → should succeed
   - Error thrown during load includes recipe file path

2. **Real Component Registry**
   - Test against actual component registry
   - Verify registry.has() calls work correctly
   - Test with multiple mods loaded

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

### Component Registry Access

The validator needs access to the component registry. Depending on the current architecture:

1. **If registry is global/singleton:**
   ```javascript
   import { componentRegistry } from '../entities/componentRegistry.js';
   ```

2. **If registry is dependency-injected:**
   ```javascript
   class ComponentExistenceValidator {
     constructor({ componentRegistry }) {
       this.#componentRegistry = componentRegistry;
     }
   }
   ```

### Error Message Template

```
[ERROR] Component 'anatomy:horned' not found

Context:  Recipe 'red_dragon.recipe.json', Slot 'head'
Problem:  Component 'anatomy:horned' does not exist in the component registry
Impact:   Head slot cannot be processed, anatomy generation will fail
Fix:      Create component at: data/mods/anatomy/components/horned.component.json

Example Component Structure:
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:horned",
  "description": "Marks an anatomy part as having horns",
  "dataSchema": { ... }
}

References:
  - docs/anatomy/components.md
  - data/mods/anatomy/components/scaled.component.json (similar example)
```

### Performance Considerations

- Validation runs once per recipe at load time
- Component registry lookups are O(1) with Map/Set
- Expected recipe size: 10-50 component references
- Performance impact: negligible (<5ms per recipe)

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
