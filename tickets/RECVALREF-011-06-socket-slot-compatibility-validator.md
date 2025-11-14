# RECVALREF-011-06: Implement SocketSlotCompatibilityValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 2 hours
**Complexity:** Medium

## Objective

Migrate the external `validateSocketSlotCompatibility` function from `socketSlotCompatibilityValidator.js` into a standalone `SocketSlotCompatibilityValidator` class extending `BaseValidator`.

## Background

This validator ensures that blueprint `additionalSlots` reference valid sockets that exist in the blueprint's socket definitions. It uses Levenshtein distance for helpful suggestions when socket names are misspelled.

## Current Implementation

**Location:** `src/anatomy/validation/socketSlotCompatibilityValidator.js`
**Function:** `validateSocketSlotCompatibility(recipe, blueprint, dataRegistry, logger)`

**Helper Functions in Same File:**
- `extractSocketsFromEntity(entityDef, dataRegistry)` - Extracts sockets from entity definitions
- Uses `levenshteinDistance` from utils

**Logic:**
- Extracts all valid sockets from blueprint entities
- Validates each additionalSlot references a valid socket
- Suggests similar socket names using Levenshtein distance
- Reports errors for invalid socket references

## Implementation Tasks

### 1. Create Validator Class (1.5 hours)

**File:** `src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { levenshteinDistance } from '../../../utils/stringUtils.js';

/**
 * Validates that blueprint additionalSlots reference valid sockets
 *
 * Priority: 20 - After blueprint existence check
 * Fail Fast: false - Report all socket issues
 */
export class SocketSlotCompatibilityValidator extends BaseValidator {
  #dataRegistry;
  #anatomyBlueprintRepository;

  constructor({ logger, dataRegistry, anatomyBlueprintRepository }) {
    super({
      name: 'socket-slot-compatibility',
      priority: 20,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getComponent', 'getEntityDefinition'],
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
  }

  async performValidation(recipe, options, builder) {
    // Get blueprint first
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

    if (!blueprint) {
      // Blueprint should have been validated by BlueprintExistenceValidator
      // Skip this validation if blueprint is missing
      return;
    }

    // Extract logic from validateSocketSlotCompatibility function
    // Use builder.addError() for invalid socket references
    // Use builder.addPassed() when all valid
  }

  #extractSocketsFromEntity(entityDef) {
    // Migrate from external helper function
    // Extract sockets from entity anatomy:socket_provider component
  }

  #findSimilarSockets(invalidSocket, validSockets) {
    // Use Levenshtein distance to find similar socket names
    // For suggestions in error messages
  }
}
```

**Key Migration Points:**
- External function `validateSocketSlotCompatibility` → `performValidation` method
- Helper function `extractSocketsFromEntity` → private method
- Levenshtein distance logic for suggestions
- Error message formatting with suggestions

### 2. Create Unit Tests (30 min)

**File:** `tests/unit/anatomy/validation/validators/SocketSlotCompatibilityValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate dataRegistry dependency
   - Should validate anatomyBlueprintRepository dependency

2. Basic validation scenarios
   - Should pass when all additionalSlots reference valid sockets
   - Should error when additionalSlot references invalid socket
   - Should error for multiple invalid socket references
   - Should handle blueprint with no sockets
   - Should handle recipe with no additionalSlots

3. Socket extraction
   - Should extract sockets from entity with anatomy:socket_provider
   - Should handle entity without socket_provider component
   - Should handle multiple entities with sockets
   - Should collect all unique socket names

4. Suggestion generation
   - Should suggest similar socket names using Levenshtein
   - Should not suggest if distance too large
   - Should rank suggestions by similarity
   - Should handle no similar sockets

5. Blueprint integration
   - Should skip validation if blueprint is null
   - Should load blueprint via repository
   - Should handle blueprint loading errors gracefully

6. Edge cases
   - Should handle empty additionalSlots array
   - Should handle malformed socket definitions
   - Should handle case-sensitive socket names

**Coverage Target:** 80%+ branch coverage

### 3. Deprecate Old File (Included in integration ticket)

**Action:** Mark `src/anatomy/validation/socketSlotCompatibilityValidator.js` for deletion in RECVALREF-011-10

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For accessing components and entity definitions
- `IAnatomyBlueprintRepository` - For loading blueprints
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation
- `levenshteinDistance` - String similarity (from utils/stringUtils.js)

## Acceptance Criteria

- [ ] SocketSlotCompatibilityValidator class created
- [ ] Extends BaseValidator with priority: 20, failFast: false
- [ ] All logic from external function migrated
- [ ] Helper function `extractSocketsFromEntity` migrated as private method
- [ ] Levenshtein distance suggestions work correctly
- [ ] Constructor validates all dependencies
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error messages with suggestions match original format
- [ ] Handles missing blueprint gracefully
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/SocketSlotCompatibilityValidator.test.js

# Check coverage
npm run test:unit -- validators/SocketSlotCompatibilityValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js
```

## Code Reference

**Original File:**
`src/anatomy/validation/socketSlotCompatibilityValidator.js`

**Functions to Migrate:**
- `validateSocketSlotCompatibility(recipe, blueprint, dataRegistry, logger)` (main function)
- `extractSocketsFromEntity(entityDef, dataRegistry)` (helper)

**Key Logic to Preserve:**
- Socket extraction from anatomy:socket_provider components
- Validation of additionalSlots against extracted sockets
- Levenshtein distance for suggestions (threshold ~3)
- Error message format with suggestions

**Usage in RecipePreflightValidator:**
- Line 124: Import statement
- Line 381-410: Call site in `#checkSocketSlotCompatibility`

## Critical Notes

- Must load blueprint (dependency on BlueprintExistenceValidator running first)
- Socket names may be case-sensitive
- Levenshtein suggestions improve UX significantly
- Reports ALL invalid sockets, not just first

## Success Metrics

- SocketSlotCompatibilityValidator: ~180-220 lines
- Test file: ~250-300 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Old external file marked for deletion
