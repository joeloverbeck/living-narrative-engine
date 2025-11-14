# RECVALREF-011-08: Implement GeneratedSlotPartsValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 3 hours
**Complexity:** High

## Objective

Extract the `#checkGeneratedSlotPartAvailability` inline method from `RecipePreflightValidator` into a standalone `GeneratedSlotPartsValidator` class extending `BaseValidator`.

## Background

This is the most complex validator in the refactoring. It validates that entity definitions exist for pattern-matched slots (slots generated dynamically from patterns). It also handles dynamic SocketGenerator imports for structure templates.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkGeneratedSlotPartAvailability` (lines 717-842)

**Complex Features:**
- Uses blueprint processing (`#ensureBlueprintProcessed`)
- Dynamically imports SocketGenerator if structure template exists
- Uses pattern matching helpers (`findMatchingSlots` from patternMatchingValidator.js)
- Calls entityMatcherService for each generated slot
- Uses `getPatternDescription` for error messages

## Implementation Tasks

### 1. Create Validator Class (2 hours)

**File:** `src/anatomy/validation/validators/GeneratedSlotPartsValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';
import { getPatternDescription } from './PatternMatchingValidator.js';

/**
 * Validates entity availability for pattern-matched (generated) slots
 *
 * Most complex validator - handles dynamic slot generation and validation
 *
 * Priority: 30 - After part availability for direct slots
 * Fail Fast: false - Report all missing generated parts
 */
export class GeneratedSlotPartsValidator extends BaseValidator {
  #slotGenerator;
  #dataRegistry;
  #entityMatcherService;
  #anatomyBlueprintRepository;

  constructor({
    logger,
    slotGenerator,
    dataRegistry,
    entityMatcherService,
    anatomyBlueprintRepository
  }) {
    super({
      name: 'generated-slot-parts',
      priority: 30,
      failFast: false,
      logger,
    });

    // Validate all dependencies
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: ['extractSlotsFromBlueprint'],
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAllEntityDefinitions'],
    });

    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: ['findMatchingEntities'],
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });

    this.#slotGenerator = slotGenerator;
    this.#dataRegistry = dataRegistry;
    this.#entityMatcherService = entityMatcherService;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
  }

  async performValidation(recipe, options, builder) {
    // Get and process blueprint
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

    if (!blueprint) {
      return; // Skip if blueprint missing
    }

    const processedBlueprint = ensureBlueprintProcessed(blueprint);

    // Extract logic from lines 680-842
    // Handle dynamic SocketGenerator import
    // Validate each pattern-matched slot
    // Use builder.addError() for missing entities
    // Use builder.addPassed() when all slots have matches
  }

  async #handleStructureTemplate(blueprint) {
    // Lines 685-715: Dynamic SocketGenerator import
    // Only import if blueprint has structure template
  }

  #findMatchingSlots(pattern, blueprint) {
    // Import from patternMatchingValidator.js or implement
    // Lines 730-747: Find slots matching pattern
  }

  #validateSlotEntities(slot, pattern, entityDefs) {
    // Lines 754-803: Validate entities for a single slot
    // Returns { hasEntities, error }
  }
}
```

**Key Extraction Points:**
- Lines 680-715: Structure template and SocketGenerator handling
- Lines 717-729: Get blueprint and process
- Lines 730-747: Pattern matching to find slots
- Lines 754-803: Entity validation per slot
- Lines 805-840: Error aggregation and reporting

### 2. Create Unit Tests (1 hour)

**File:** `tests/unit/anatomy/validation/validators/GeneratedSlotPartsValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate all 4 dependencies

2. Basic validation scenarios
   - Should pass when all generated slots have entities
   - Should error when generated slot lacks entities
   - Should error for multiple slots without entities
   - Should handle recipe with no patterns

3. Pattern slot generation
   - Should find slots matching pattern
   - Should handle multiple patterns
   - Should handle patterns with no matches

4. Structure template handling
   - Should dynamically import SocketGenerator when template exists
   - Should skip SocketGenerator when no template
   - Should handle SocketGenerator import errors
   - Should use SocketGenerator for socket generation

5. Entity matching
   - Should call entityMatcherService for each slot
   - Should use correct criteria from pattern
   - Should handle entityMatcherService returning empty
   - Should handle entity matching errors

6. Blueprint processing
   - Should process blueprint before validation
   - Should skip if blueprint is null
   - Should use shared blueprintProcessingUtils

7. Error reporting
   - Should include pattern description in errors
   - Should include slot identifier in errors
   - Should aggregate multiple errors
   - Should use getPatternDescription utility

8. Edge cases
   - Should handle empty patterns array
   - Should handle malformed pattern objects
   - Should handle slots with partial criteria
   - Should handle blueprint with no base slots

**Coverage Target:** 80%+ branch coverage

## Dependencies

**Service Dependencies:**
- `ISlotGenerator` - For extracting slots from blueprints
- `IDataRegistry` - For accessing entity definitions
- `IEntityMatcherService` - For finding matching entities
- `IAnatomyBlueprintRepository` - For loading blueprints
- `ILogger` - For logging (inherited)

**Dynamic Dependencies:**
- `SocketGenerator` - Dynamically imported if structure template exists

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation
- `blueprintProcessingUtils` - Shared blueprint processing
- `PatternMatchingValidator` - getPatternDescription utility

## Acceptance Criteria

- [ ] GeneratedSlotPartsValidator class created
- [ ] Extends BaseValidator with priority: 30, failFast: false
- [ ] Constructor validates all 4 dependencies
- [ ] Dynamic SocketGenerator import logic preserved
- [ ] Pattern matching logic migrated correctly
- [ ] Entity validation logic matches original
- [ ] Uses shared blueprintProcessingUtils
- [ ] Uses getPatternDescription from PatternMatchingValidator
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error messages match original format exactly
- [ ] Handles all edge cases from original
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/GeneratedSlotPartsValidator.test.js

# Check coverage
npm run test:unit -- validators/GeneratedSlotPartsValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/GeneratedSlotPartsValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:717-842`

**Key Logic Sections:**
- Lines 680-715: Structure template handling
- Lines 717-729: Blueprint loading and processing
- Lines 730-747: Pattern slot matching
- Lines 749-753: Entity definitions retrieval
- Lines 754-803: Per-slot entity validation
- Lines 805-840: Error aggregation and reporting

**External Dependencies:**
- `findMatchingSlots` from patternMatchingValidator.js (line 730)
- `getPatternDescription` from patternMatchingValidator.js (line 815)
- `#ensureBlueprintProcessed` from RecipePreflightValidator (line 721)

## Critical Notes

- **Most Complex Validator**: Handle with care
- **Dynamic Import**: SocketGenerator only imported when needed
- **Depends on PatternMatchingValidator**: Must use getPatternDescription
- **Blueprint Processing**: Uses shared utility from blueprintProcessingUtils
- Reports ALL missing generated parts (failFast: false)
- May have performance implications for large blueprints with many patterns

## Success Metrics

- GeneratedSlotPartsValidator: ~250-300 lines
- Test file: ~350-400 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Dynamic import handling preserved
- Pattern matching integration working
