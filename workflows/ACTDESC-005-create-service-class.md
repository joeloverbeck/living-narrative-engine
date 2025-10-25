# ACTDESC-005: Create ActivityDescriptionService Class Structure

## Status
🟡 **Pending**

## Phase
**Phase 2: Core Service Implementation** (Week 1-2)

## Description
Create the foundational `ActivityDescriptionService` class with proper dependency injection, logging, error handling, and the main `generateActivityDescription()` method stub. This establishes the service architecture that will be built upon in subsequent tickets.

## Background
The ActivityDescriptionService is the central component of the activity description system. It follows the Equipment service pattern and integrates into the body description pipeline as an optional extension point.

**Reference**: Design document lines 1227-1316, 1664-1662 (ActivityDescriptionService Architecture, Class Structure)

## Objectives
- Create service class file with proper structure
- Implement constructor with dependency validation
- Add main public method `generateActivityDescription(entityId)`
- Set up private fields and helper method stubs
- Implement comprehensive error handling

## Technical Specification

### File to Create
`src/anatomy/services/activityDescriptionService.js`

### Class Structure
```javascript
/**
 * @file Service for generating activity descriptions based on component metadata.
 *
 * Follows the Equipment service pattern from BODCLODES.
 * Integrates into BodyDescriptionComposer as an optional extension point.
 *
 * @see src/clothing/services/equipmentDescriptionService.js
 * @see reports/BODCLODES-body-description-composition-architecture.md
 * @see brainstorming/ACTDESC-activity-description-composition-design.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

class ActivityDescriptionService {
  #logger;
  #entityManager;
  #anatomyFormattingService;
  #entityNameCache = new Map();
  #activityIndex = null; // Phase 3: ACTDESC-020

  /**
   * @param {object} dependencies
   * @param {object} dependencies.logger - Logger service
   * @param {object} dependencies.entityManager - Entity manager for component access
   * @param {object} dependencies.anatomyFormattingService - Configuration service
   * @param {object} [dependencies.activityIndex] - Optional index for performance (Phase 3)
   */
  constructor({
    logger,
    entityManager,
    anatomyFormattingService,
    activityIndex = null,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(anatomyFormattingService, 'AnatomyFormattingService', logger);

    this.#logger = ensureValidLogger(logger, 'ActivityDescriptionService');
    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#activityIndex = activityIndex;
  }

  /**
   * Generate activity description for an entity.
   *
   * @param {string} entityId - Entity ID to generate activity description for
   * @returns {Promise<string>} Formatted activity description (empty string if no activities)
   *
   * @example
   * const description = await service.generateActivityDescription('character_1');
   * // Returns: "Activity: Jon Ureña is kneeling before Alicia Western."
   */
  async generateActivityDescription(entityId) {
    try {
      this.#logger.debug(`Generating activity description for entity: ${entityId}`);

      // TODO: ACTDESC-006, ACTDESC-007 - Implement metadata collection
      const activities = [];

      if (activities.length === 0) {
        this.#logger.debug(`No activities found for entity: ${entityId}`);
        return '';
      }

      // TODO: ACTDESC-018 - Implement conditional filtering (Phase 3)
      // TODO: ACTDESC-016 - Implement priority filtering (Phase 2)
      // TODO: ACTDESC-008 - Implement description formatting (Phase 1)

      return ''; // Placeholder

    } catch (error) {
      this.#logger.error(
        `Failed to generate activity description for entity ${entityId}`,
        error
      );
      return ''; // Fail gracefully
    }
  }

  // Stub methods - to be implemented in subsequent tickets
  #collectActivityMetadata(entityId) {
    // ACTDESC-006, ACTDESC-007
    return [];
  }

  #filterByConditions(activities, entity) {
    // ACTDESC-018 (Phase 3)
    return activities;
  }

  #sortByPriority(activities) {
    // ACTDESC-016 (Phase 2)
    return activities;
  }

  #formatActivityDescription(activities, entity) {
    // ACTDESC-008 (Phase 1)
    return '';
  }

  #resolveEntityName(entityId) {
    // ACTDESC-009
    return entityId;
  }
}

export default ActivityDescriptionService;
```

## Acceptance Criteria
- [ ] Class file created at correct location
- [ ] Constructor validates all dependencies with `validateDependency`
- [ ] All private fields declared with `#` prefix
- [ ] Main method has proper JSDoc documentation
- [ ] Error handling implemented with try-catch
- [ ] Graceful failure returns empty string (no crashes)
- [ ] Debug logging at key points
- [ ] All stub methods defined with TODO comments
- [ ] File imports are correct and minimal
- [ ] Code follows project naming conventions

## Dependencies
- **Requires**: ACTDESC-003 (AnatomyFormattingService config)
- **Blocks**: ACTDESC-006, ACTDESC-007, ACTDESC-008, ACTDESC-009 (All implement stubs)

## Testing Requirements
```javascript
describe('ActivityDescriptionService - Constructor', () => {
  it('should validate logger dependency', () => {
    expect(() => new ActivityDescriptionService({
      logger: null,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
    })).toThrow();
  });

  it('should validate entityManager dependency', () => {
    expect(() => new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: null,
      anatomyFormattingService: mockFormattingService,
    })).toThrow();
  });

  it('should accept optional activityIndex', () => {
    const service = new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      activityIndex: null,
    });
    expect(service).toBeDefined();
  });
});

describe('ActivityDescriptionService - generateActivityDescription', () => {
  it('should return empty string when no activities found', async () => {
    const result = await service.generateActivityDescription('entity_1');
    expect(result).toBe('');
  });

  it('should handle errors gracefully', async () => {
    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Database error');
    });

    const result = await service.generateActivityDescription('entity_1');
    expect(result).toBe('');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log debug information', async () => {
    await service.generateActivityDescription('entity_1');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Generating activity description')
    );
  });
});
```

## Implementation Notes
1. **Dependency Validation**: Use `validateDependency` for all injected services
2. **Logger Setup**: Use `ensureValidLogger` to ensure proper logger instance
3. **Error Handling**: All public methods must have try-catch with graceful failure
4. **Private Methods**: Use `#` prefix for all private methods and fields
5. **TODOs**: Include ticket references in TODO comments for traceability

## Reference Files
- Utility imports: `src/utils/dependencyUtils.js`, `src/utils/loggerUtils.js`
- Pattern reference: `src/clothing/services/equipmentDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1227-1662)

## Success Metrics
- Class instantiates without errors
- Dependency validation works correctly
- Method returns empty string (placeholder works)
- No runtime errors when called
- Code passes linting with no warnings

## Related Tickets
- **Requires**: ACTDESC-003 (Configuration service)
- **Blocks**: ACTDESC-006 (Inline metadata collection)
- **Blocks**: ACTDESC-007 (Dedicated metadata collection)
- **Blocks**: ACTDESC-008 (Phrase generation)
- **Blocks**: ACTDESC-009 (Entity name resolution)
- **Blocks**: ACTDESC-004 (DI registration)
