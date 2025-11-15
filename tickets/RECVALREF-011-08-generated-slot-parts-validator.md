# RECVALREF-011-08: Implement GeneratedSlotPartsValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 3 hours
**Complexity:** High

## Objective

Extract the `#checkGeneratedSlotPartAvailability` inline method from `RecipePreflightValidator` into a standalone `GeneratedSlotPartsValidator` class extending `BaseValidator`.

## Background

This is the most complex validator in the refactoring. It validates that entity definitions exist for pattern-matched slots (slots generated dynamically from patterns). It also handles dynamic SocketGenerator imports for structure templates. Per `docs/anatomy/anatomy-system-guide.md`, this logic is check #9 in the Recipe Pre-flight validation stage, immediately after the explicit part availability pass.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkGeneratedSlotPartAvailability` (lines 680-840)

**Complex Features:**
- Uses blueprint processing (`#ensureBlueprintProcessed`)
- Dynamically imports SocketGenerator if structure template exists
- Uses pattern matching helpers (`findMatchingSlots` from patternMatchingValidator.js)
- Calls entityMatcherService for each generated slot
- Uses the private `#getPatternDescription` helper (lines 849-857) for error messages

## Implementation Tasks

### 1. Create Validator Class (2 hours)

**File:** `src/anatomy/validation/validators/GeneratedSlotPartsValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';
import {
  findMatchingSlots,
  getPatternDescription,
} from './PatternMatchingValidator.js';

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
  #logger;

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

    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'generateBlueprintSlots',
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
      ],
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });

    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: ['findMatchingEntitiesForSlot', 'mergePropertyRequirements'],
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );

    this.#slotGenerator = slotGenerator;
    this.#dataRegistry = dataRegistry;
    this.#entityMatcherService = entityMatcherService;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
  }

  async performValidation(recipe, _options, builder) {
    const blueprintId = recipe?.blueprintId;
    const rawBlueprint = await this.#anatomyBlueprintRepository.getBlueprint(
      blueprintId
    );

    if (!rawBlueprint) {
      this.#logger.warn(
        `GeneratedSlotPartsValidator: Blueprint '${blueprintId}' not found, skipping generated slot checks`
      );
      return;
    }

    const blueprint = await ensureBlueprintProcessed({
      blueprint: rawBlueprint,
      dataRegistry: this.#dataRegistry,
      slotGenerator: this.#slotGenerator,
      logger: this.#logger,
    });

    const patterns = recipe?.patterns || [];
    if (patterns.length === 0) {
      builder.addPassed('No pattern-generated slots to validate', {
        check: 'generated_slot_part_availability',
      });
      return;
    }

    const generatedSockets = await this.#loadStructureTemplateSockets(blueprint);
    const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');
    const issues = [];
    let totalSlotsChecked = 0;

    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      const { matches } = findMatchingSlots(
        pattern,
        blueprint,
        this.#dataRegistry,
        this.#slotGenerator,
        this.#logger
      );

      for (const slotKey of matches) {
        totalSlotsChecked += 1;
        const blueprintSlot = blueprint.slots?.[slotKey] ?? generatedSockets[slotKey];
        if (!blueprintSlot) {
          this.#logger.warn(
            `GeneratedSlotPartsValidator: Slot '${slotKey}' matched by pattern but not found in blueprint or template`
          );
          continue;
        }

        const combinedRequirements = {
          partType: pattern.partType,
          allowedTypes: blueprintSlot.allowedTypes || ['*'],
          tags: [
            ...(pattern.tags || []),
            ...(blueprintSlot.requirements?.components || []),
          ],
          properties: this.#entityMatcherService.mergePropertyRequirements(
            pattern.properties || {},
            blueprintSlot.requirements?.properties || {}
          ),
        };

        const matchingEntities =
          this.#entityMatcherService.findMatchingEntitiesForSlot(
            combinedRequirements,
            allEntityDefs
          );

        if (matchingEntities.length === 0) {
          issues.push({
            type: 'GENERATED_SLOT_PART_UNAVAILABLE',
            severity: 'error',
            message: `No entity definitions found for generated slot '${slotKey}' (matched by pattern ${patternIndex})`,
            location: {
              type: 'generated_slot',
              slotKey,
              patternIndex,
              pattern: getPatternDescription(pattern),
            },
            details: {
              slotKey,
              patternIndex,
              partType: pattern.partType,
              allowedTypes: blueprintSlot.allowedTypes,
              requiredTags: combinedRequirements.tags,
              requiredProperties: Object.keys(combinedRequirements.properties),
              totalEntitiesChecked: allEntityDefs.length,
              blueprintRequiredComponents: blueprintSlot.requirements?.components || [],
              blueprintRequiredProperties: Object.keys(
                blueprintSlot.requirements?.properties || {}
              ),
            },
            fix:
              `Create an entity definition in data/mods/anatomy/entities/definitions/ with:\n` +
              `  - anatomy:part component with subType: "${pattern.partType}"\n` +
              `  - Required tags (pattern + blueprint): ${JSON.stringify(combinedRequirements.tags)}\n` +
              `  - Required property components: ${JSON.stringify(Object.keys(combinedRequirements.properties))}`,
          });
        }
      }
    }

    if (issues.length === 0) {
      builder.addPassed(
        `All ${totalSlotsChecked} generated slot(s) have matching entity definitions`,
        { check: 'generated_slot_part_availability' }
      );
      return;
    }

    builder.addIssues(issues);
  }

  async #loadStructureTemplateSockets(blueprint) {
    if (!blueprint.structureTemplate) {
      return {};
    }

    const structureTemplate = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!structureTemplate) {
      this.#logger.warn(
        `GeneratedSlotPartsValidator: Structure template '${blueprint.structureTemplate}' not found in data registry`
      );
      return {};
    }

    const { default: SocketGenerator } = await import('../../socketGenerator.js');
    const socketGenerator = new SocketGenerator({ logger: this.#logger });
    const sockets = socketGenerator.generateSockets(structureTemplate);

    return sockets.reduce((acc, socket) => {
      acc[socket.id] = socket;
      return acc;
    }, {});
  }
}
```

**Key Extraction Points:**
- Lines 682-693: Blueprint loading plus `#ensureBlueprintProcessed` call
- Lines 700-737: Structure template + SocketGenerator handling
- Lines 744-757: Pattern matching to find slots via `findMatchingSlots`
- Lines 758-821: Entity validation per slot and issue assembly
- Lines 824-834: Pass/fail aggregation and error fallback

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
   - Should handle recipe with no patterns (emits pass result)
   - Should skip gracefully when the blueprint cannot be loaded (blueprint check already fails earlier)

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
- `ISlotGenerator` - Provides `generateBlueprintSlots`, `extractSlotKeysFromLimbSet`, and `extractSlotKeysFromAppendage` for blueprint processing and matcher helpers
- `IDataRegistry` - Supplies `get` (structure templates) and `getAll` (entity definitions)
- `IEntityMatcherService` - Supplies `findMatchingEntitiesForSlot` + `mergePropertyRequirements`
- `IAnatomyBlueprintRepository` - For loading blueprints via `getBlueprint`
- `ILogger` - For logging (inherited)

**Dynamic Dependencies:**
- `SocketGenerator` - Dynamically imported if structure template exists

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation
- `blueprintProcessingUtils` - Shared blueprint processing helper
- `PatternMatchingValidator` - `findMatchingSlots` + `getPatternDescription`

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
npm run test:unit -- --runTestsByPath tests/unit/anatomy/validation/validators/GeneratedSlotPartsValidator.test.js

# Check coverage
npm run test:unit -- --coverage --runTestsByPath tests/unit/anatomy/validation/validators/GeneratedSlotPartsValidator.test.js

# Lint
npx eslint src/anatomy/validation/validators/GeneratedSlotPartsValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:680-840`

**Key Logic Sections:**
- Lines 682-693: Blueprint loading and processing via `#ensureBlueprintProcessed`
- Lines 700-737: Structure template handling + SocketGenerator import
- Lines 700-703: Entity definitions retrieval (`getAll('entityDefinitions')`)
- Lines 744-757: Pattern slot matching
- Lines 758-821: Per-slot entity validation
- Lines 824-834: Error aggregation and reporting

**External Dependencies:**
- `findMatchingSlots` from patternMatchingValidator.js (lines 744-753 call site)
- `getPatternDescription` private helper inside RecipePreflightValidator (lines 849-857)
- `#ensureBlueprintProcessed` from RecipePreflightValidator (lines 411-456)

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
