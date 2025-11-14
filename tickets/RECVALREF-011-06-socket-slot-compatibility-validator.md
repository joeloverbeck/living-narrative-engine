# RECVALREF-011-06: Implement SocketSlotCompatibilityValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 2 hours
**Complexity:** Medium

## Objective

Migrate the existing `validateSocketSlotCompatibility` helper from `src/anatomy/validation/socketSlotCompatibilityValidator.js` into a standalone `SocketSlotCompatibilityValidator` class that extends `BaseValidator`.

## Background

This validator ensures that blueprint `additionalSlots` reference valid sockets that exist in the blueprint's socket definitions. It uses Levenshtein distance for helpful suggestions when socket names are misspelled.

## Current Implementation

**Location:** `src/anatomy/validation/socketSlotCompatibilityValidator.js`
**Function:** `validateSocketSlotCompatibility(blueprint, dataRegistry)`

**Helper Functions:**
- `extractSocketsFromEntity(entity)` (lives in `src/anatomy/validation/socketExtractor.js`) - Extracts sockets from the root entity
- Local helpers `findSimilarSocketName` and `suggestSocketFix`
- Uses `levenshteinDistance` from `src/utils/stringUtils.js`

**Logic:**
- Looks up the root entity via `dataRegistry.get('entityDefinitions', blueprint.root)` and reports `ROOT_ENTITY_NOT_FOUND` when missing
- Extracts sockets from the root entity's `anatomy:sockets` component (see `docs/anatomy/blueprints-and-recipes.md`)
- Validates that each `additionalSlots.*.socket` references an available socket
- Skips optional slots (`slot.optional === true`) instead of erroring when sockets are missing (mirrors runtime `slotResolutionOrchestrator` behavior)
- Suggests similar socket names using Levenshtein distance
- Reports errors for invalid socket references and replays placeholder structure-template checks via `validateStructureTemplateSockets`

## Implementation Tasks

### 1. Create Validator Class (1.5 hours)

**File:** `src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { extractSocketsFromEntity } from '../../validation/socketExtractor.js';
import { levenshteinDistance } from '../../../utils/stringUtils.js';

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
      requiredMethods: ['getEntityDefinition'],
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
  }

  async performValidation(recipe, options, builder) {
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(
      recipe.blueprintId
    );

    if (!blueprint) {
      // BlueprintExistenceValidator runs first; skip quietly when it already reported the issue.
      return;
    }

    const rootEntity = this.#dataRegistry.getEntityDefinition(blueprint.root);

    if (!rootEntity) {
      builder.addError(
        'ROOT_ENTITY_NOT_FOUND',
        `Root entity '${blueprint.root}' not found`,
        {
          blueprintId: blueprint.id,
          rootEntityId: blueprint.root,
          fix: `Create entity at data/mods/*/entities/definitions/${blueprint.root.split(':')[1]}.entity.json`,
        }
      );
      return;
    }

    const sockets = extractSocketsFromEntity(rootEntity);

    // Port the rest of validateSocketSlotCompatibility: check additionalSlots, skip optional slots,
    // reuse findSimilarSocketName/suggestSocketFix for error payloads, and call validateStructureTemplateSockets when needed.
  }
}
```

**Key Migration Points:**
- Move the existing `validateSocketSlotCompatibility` logic into `performValidation`, including optional-slot handling
- Reuse `extractSocketsFromEntity` from `socketExtractor.js` instead of duplicating it
- Keep Levenshtein-based suggestions (`findSimilarSocketName` and `suggestSocketFix`)
- Maintain the `validateStructureTemplateSockets` placeholder logic so behavior stays identical until RECVALREF-011-10 removes the legacy file

### 2. Create Unit Tests (30 min)

**File:** `tests/unit/anatomy/validation/validators/SocketSlotCompatibilityValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate dataRegistry dependency (requires `getEntityDefinition`)
   - Should validate anatomyBlueprintRepository dependency

2. Basic validation scenarios
   - Should pass when all additionalSlots reference valid sockets on the root entity
   - Should error when additionalSlot references invalid socket
   - Should error for multiple invalid socket references
   - Should handle blueprint with no sockets
   - Should handle recipe with no additionalSlots
   - Should skip optional additionalSlots referencing missing sockets

3. Socket extraction (via `socketExtractor`)
   - Should extract sockets from entity with `anatomy:sockets`
   - Should handle entity without `anatomy:sockets`
   - Should collect all unique socket names

4. Suggestion generation
   - Should suggest similar socket names using Levenshtein
   - Should not suggest if distance too large
   - Should rank suggestions by similarity
   - Should handle no similar sockets

5. Blueprint integration
   - Should skip validation if the repository returns null (BlueprintExistenceValidator already emitted the error)
   - Should load blueprint via `anatomyBlueprintRepository.getBlueprint`
   - Should emit `ROOT_ENTITY_NOT_FOUND` when the blueprint root entity is missing

6. Edge cases
   - Should handle empty additionalSlots object
   - Should continue calling `validateStructureTemplateSockets` even though it currently returns an empty array
   - Should handle case-sensitive socket names

**Coverage Target:** 80%+ branch coverage

### 3. Deprecate Old File (Included in integration ticket)

**Action:** Mark `src/anatomy/validation/socketSlotCompatibilityValidator.js` for deletion in RECVALREF-011-10

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For accessing root entity definitions via `getEntityDefinition`
- `IAnatomyBlueprintRepository` - For loading blueprints
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation
- `extractSocketsFromEntity` - Socket extraction helper (`src/anatomy/validation/socketExtractor.js`)
- `levenshteinDistance` - String similarity (from utils/stringUtils.js)

## Acceptance Criteria

- [ ] SocketSlotCompatibilityValidator class created
- [ ] Extends BaseValidator with priority: 20, failFast: false
- [ ] All logic from external function migrated
- [ ] Validator reuses `extractSocketsFromEntity` helper from `socketExtractor.js` (do not duplicate logic)
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
- `validateSocketSlotCompatibility(blueprint, dataRegistry)` (main function)

**Key Logic to Preserve:**
- Socket extraction from `anatomy:sockets` components (via shared helper)
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
