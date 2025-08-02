# POSMIG-11: Update Operation Handlers and Services

## Overview

Update all operation handlers and services that work with positioning components to ensure they use the correct component IDs after migration. This includes handlers for closeness circle operations and any services that manipulate positioning state. This ticket ensures that the business logic layer correctly references the migrated components.

## Priority

**High** - Operation handlers are core business logic that must work correctly with migrated components.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-03: Migrate Closeness Component (must be completed)
- POSMIG-04: Migrate Facing Away Component (must be completed)

## Estimated Effort

**2-3 hours** (focused updates to critical business logic)

## Acceptance Criteria

1. ✅ All operation handlers use correct positioning component IDs
2. ✅ Services reference positioning components correctly
3. ✅ Constants and configuration updated
4. ✅ All tests passing after updates
5. ✅ No hardcoded intimacy component references remaining
6. ✅ Operation handlers work correctly with new component structure
7. ✅ Error handling and logging updated
8. ✅ Performance impact assessed
9. ✅ Migration documented

## Implementation Steps

### Step 1: Identify Files to Update

Based on the migration report, the following files need updates:

**Operation Handlers**:

- `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`
- `src/logic/operationHandlers/mergeClosenessCircleHandler.js`

**Services**:

- `src/logic/services/closenessCircleService.js`

### Step 2: Update Remove From Closeness Circle Handler

Update `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`:

```javascript
/**
 * @file Operation handler for removing actors from closeness circles
 * @description Handles the remove_from_closeness_circle operation
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

// Updated component ID
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

/**
 * Handler for removing an actor from their closeness circle
 */
export class RemoveFromClosenessCircleHandler {
  #logger;
  #entityManager;
  #eventBus;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEntityManager} dependencies.entityManager
   * @param {ISafeEventDispatcher} dependencies.eventBus
   */
  constructor({ logger, entityManager, eventBus }) {
    this.#logger = ensureValidLogger(
      logger,
      'RemoveFromClosenessCircleHandler'
    );
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(eventBus, 'ISafeEventDispatcher');

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
  }

  /**
   * Execute the remove from closeness circle operation
   * @param {object} operation - The operation to execute
   * @param {string} operation.actor - The actor to remove from their circle
   * @returns {Promise<void>}
   */
  async execute(operation) {
    assertPresent(operation, 'Operation is required');
    assertPresent(operation.actor, 'Actor is required');

    const actorId = operation.actor;

    try {
      // Get actor's current closeness component
      const closenessComponent = await this.#entityManager.getComponent(
        actorId,
        CLOSENESS_COMPONENT_ID
      );

      if (!closenessComponent) {
        this.#logger.debug(
          `Actor ${actorId} has no closeness component to remove`
        );
        return;
      }

      const partners = closenessComponent.data.partners || [];

      // Remove actor from all partners' closeness circles
      for (const partnerId of partners) {
        if (partnerId !== actorId) {
          await this.#removeFromPartnerCircle(partnerId, actorId);
        }
      }

      // Remove the actor's own closeness component
      await this.#entityManager.removeComponent(
        actorId,
        CLOSENESS_COMPONENT_ID
      );

      this.#logger.info(
        `Removed actor ${actorId} from closeness circle with ${partners.length} partners`
      );

      // Dispatch event for other systems
      this.#eventBus.dispatch({
        type: 'CLOSENESS_CIRCLE_LEFT',
        payload: {
          actor: actorId,
          formerPartners: partners.filter((p) => p !== actorId),
        },
      });
    } catch (error) {
      this.#logger.error(
        `Failed to remove actor ${actorId} from closeness circle`,
        error
      );
      throw error;
    }
  }

  /**
   * Remove an actor from a partner's closeness circle
   * @private
   * @param {string} partnerId - Partner to update
   * @param {string} actorId - Actor to remove
   */
  async #removeFromPartnerCircle(partnerId, actorId) {
    try {
      const partnerCloseness = await this.#entityManager.getComponent(
        partnerId,
        CLOSENESS_COMPONENT_ID
      );

      if (!partnerCloseness) {
        this.#logger.debug(`Partner ${partnerId} has no closeness component`);
        return;
      }

      const partners = partnerCloseness.data.partners || [];
      const updatedPartners = partners.filter((p) => p !== actorId);

      if (updatedPartners.length === 1) {
        // Only the partner remains, remove their closeness component
        await this.#entityManager.removeComponent(
          partnerId,
          CLOSENESS_COMPONENT_ID
        );
        this.#logger.debug(
          `Removed closeness component from ${partnerId} (last remaining partner)`
        );
      } else if (updatedPartners.length > 1) {
        // Update partner's closeness circle
        await this.#entityManager.updateComponent(
          partnerId,
          CLOSENESS_COMPONENT_ID,
          {
            partners: updatedPartners,
          }
        );
        this.#logger.debug(
          `Updated ${partnerId} closeness circle, removed ${actorId}`
        );
      }
    } catch (error) {
      this.#logger.error(
        `Failed to update partner ${partnerId} closeness circle`,
        error
      );
      // Don't throw - try to continue with other partners
    }
  }
}

export default RemoveFromClosenessCircleHandler;
```

### Step 3: Update Merge Closeness Circle Handler

Update `src/logic/operationHandlers/mergeClosenessCircleHandler.js`:

```javascript
/**
 * @file Operation handler for merging closeness circles
 * @description Handles the merge_closeness_circle operation
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

// Updated component ID
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

/**
 * Handler for merging closeness circles when actors get close
 */
export class MergeClosenessCircleHandler {
  #logger;
  #entityManager;
  #eventBus;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEntityManager} dependencies.entityManager
   * @param {ISafeEventDispatcher} dependencies.eventBus
   */
  constructor({ logger, entityManager, eventBus }) {
    this.#logger = ensureValidLogger(logger, 'MergeClosenessCircleHandler');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(eventBus, 'ISafeEventDispatcher');

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
  }

  /**
   * Execute the merge closeness circle operation
   * @param {object} operation - The operation to execute
   * @param {string} operation.actor - The actor initiating closeness
   * @param {string} operation.entity - The entity being approached
   * @returns {Promise<void>}
   */
  async execute(operation) {
    assertPresent(operation, 'Operation is required');
    assertPresent(operation.actor, 'Actor is required');
    assertPresent(operation.entity, 'Entity is required');

    const actorId = operation.actor;
    const entityId = operation.entity;

    if (actorId === entityId) {
      this.#logger.debug('Cannot merge closeness circle with self');
      return;
    }

    try {
      // Get existing closeness components
      const actorCloseness = await this.#entityManager.getComponent(
        actorId,
        CLOSENESS_COMPONENT_ID
      );

      const entityCloseness = await this.#entityManager.getComponent(
        entityId,
        CLOSENESS_COMPONENT_ID
      );

      // Determine the merged circle
      const mergedCircle = await this.#calculateMergedCircle(
        actorId,
        entityId,
        actorCloseness,
        entityCloseness
      );

      // Update all actors in the merged circle
      await this.#updateAllActorsInCircle(mergedCircle);

      this.#logger.info(
        `Merged closeness circles: actor ${actorId}, entity ${entityId}, circle size: ${mergedCircle.size}`
      );

      // Dispatch event
      this.#eventBus.dispatch({
        type: 'CLOSENESS_CIRCLE_FORMED',
        payload: {
          initiator: actorId,
          target: entityId,
          circle: Array.from(mergedCircle),
        },
      });
    } catch (error) {
      this.#logger.error(
        `Failed to merge closeness circles for ${actorId} and ${entityId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculate the merged circle from existing closeness components
   * @private
   * @param {string} actorId - Actor ID
   * @param {string} entityId - Entity ID
   * @param {object|null} actorCloseness - Actor's closeness component
   * @param {object|null} entityCloseness - Entity's closeness component
   * @returns {Promise<Set<string>>} - Merged circle as a Set
   */
  async #calculateMergedCircle(
    actorId,
    entityId,
    actorCloseness,
    entityCloseness
  ) {
    const mergedCircle = new Set([actorId, entityId]);

    // Add partners from actor's existing circle
    if (actorCloseness?.data?.partners) {
      for (const partner of actorCloseness.data.partners) {
        mergedCircle.add(partner);
      }
    }

    // Add partners from entity's existing circle
    if (entityCloseness?.data?.partners) {
      for (const partner of entityCloseness.data.partners) {
        mergedCircle.add(partner);
      }
    }

    this.#logger.debug(
      `Calculated merged circle: ${Array.from(mergedCircle).join(', ')}`
    );
    return mergedCircle;
  }

  /**
   * Update all actors in the circle with the new partner list
   * @private
   * @param {Set<string>} circle - The complete circle
   */
  async #updateAllActorsInCircle(circle) {
    const partners = Array.from(circle);

    for (const actorId of circle) {
      try {
        await this.#entityManager.addOrUpdateComponent(
          actorId,
          CLOSENESS_COMPONENT_ID,
          {
            partners: partners,
          }
        );

        this.#logger.debug(`Updated closeness component for ${actorId}`);
      } catch (error) {
        this.#logger.error(
          `Failed to update closeness component for ${actorId}`,
          error
        );
        // Continue with other actors
      }
    }
  }
}

export default MergeClosenessCircleHandler;
```

### Step 4: Update Closeness Circle Service

Update `src/logic/services/closenessCircleService.js`:

```javascript
/**
 * @file Closeness circle service
 * @description Service for managing closeness circle operations
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

// Updated component ID
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

/**
 * Service for managing closeness circles
 */
export class ClosenessCircleService {
  #logger;
  #entityManager;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEntityManager} dependencies.entityManager
   */
  constructor({ logger, entityManager }) {
    this.#logger = ensureValidLogger(logger, 'ClosenessCircleService');
    validateDependency(entityManager, 'IEntityManager');

    this.#entityManager = entityManager;
  }

  /**
   * Get all actors in the same closeness circle as the given actor
   * @param {string} actorId - The actor ID
   * @returns {Promise<string[]>} - Array of actor IDs in the same circle
   */
  async getClosenessPartners(actorId) {
    assertNonBlankString(actorId, 'Actor ID');

    try {
      const closenessComponent = await this.#entityManager.getComponent(
        actorId,
        CLOSENESS_COMPONENT_ID
      );

      if (!closenessComponent?.data?.partners) {
        return [];
      }

      // Return partners excluding the actor themselves
      return closenessComponent.data.partners.filter(
        (partnerId) => partnerId !== actorId
      );
    } catch (error) {
      this.#logger.error(
        `Failed to get closeness partners for ${actorId}`,
        error
      );
      return [];
    }
  }

  /**
   * Check if two actors are in the same closeness circle
   * @param {string} actor1Id - First actor ID
   * @param {string} actor2Id - Second actor ID
   * @returns {Promise<boolean>} - True if they are close
   */
  async areActorsClose(actor1Id, actor2Id) {
    assertNonBlankString(actor1Id, 'Actor 1 ID');
    assertNonBlankString(actor2Id, 'Actor 2 ID');

    if (actor1Id === actor2Id) {
      return false; // Same actor
    }

    try {
      const partners = await this.getClosenessPartners(actor1Id);
      return partners.includes(actor2Id);
    } catch (error) {
      this.#logger.error(
        `Failed to check if actors ${actor1Id} and ${actor2Id} are close`,
        error
      );
      return false;
    }
  }

  /**
   * Get the size of an actor's closeness circle
   * @param {string} actorId - The actor ID
   * @returns {Promise<number>} - Number of actors in the circle (including the actor)
   */
  async getCircleSize(actorId) {
    assertNonBlankString(actorId, 'Actor ID');

    try {
      const partners = await this.getClosenessPartners(actorId);
      return partners.length + 1; // Include the actor themselves
    } catch (error) {
      this.#logger.error(`Failed to get circle size for ${actorId}`, error);
      return 0;
    }
  }

  /**
   * Check if an actor is in any closeness circle
   * @param {string} actorId - The actor ID
   * @returns {Promise<boolean>} - True if actor has closeness component
   */
  async isActorInCloseness(actorId) {
    assertNonBlankString(actorId, 'Actor ID');

    try {
      const closenessComponent = await this.#entityManager.getComponent(
        actorId,
        CLOSENESS_COMPONENT_ID
      );

      return (
        closenessComponent !== null &&
        closenessComponent.data?.partners?.length > 0
      );
    } catch (error) {
      this.#logger.error(
        `Failed to check closeness status for ${actorId}`,
        error
      );
      return false;
    }
  }
}

export default ClosenessCircleService;
```

### Step 5: Create Validation Script

Create `scripts/validate-handlers-services.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates operation handlers and services updates
 * @description Ensures all handlers use correct component IDs
 */

import { promises as fs } from 'fs';
import path from 'path';

const FILES_TO_CHECK = [
  'src/logic/operationHandlers/removeFromClosenessCircleHandler.js',
  'src/logic/operationHandlers/mergeClosenessCircleHandler.js',
  'src/logic/services/closenessCircleService.js',
];

const OLD_COMPONENT_ID = 'intimacy:closeness';
const NEW_COMPONENT_ID = 'positioning:closeness';

async function validateFiles() {
  console.log('🔍 Validating operation handlers and services...\\n');

  const errors = [];

  for (const filePath of FILES_TO_CHECK) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Check for old component ID
      if (content.includes(OLD_COMPONENT_ID)) {
        errors.push(`${filePath} still contains ${OLD_COMPONENT_ID}`);
      }

      // Check for new component ID
      if (!content.includes(NEW_COMPONENT_ID)) {
        errors.push(`${filePath} missing ${NEW_COMPONENT_ID}`);
      }

      // Check for updated constant
      if (
        content.includes('CLOSENESS_COMPONENT_ID') &&
        !content.includes(`'${NEW_COMPONENT_ID}'`)
      ) {
        errors.push(`${filePath} CLOSENESS_COMPONENT_ID constant not updated`);
      }

      console.log(`✅ ${path.basename(filePath)} updated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${filePath}: ${error.message}`);
    }
  }

  // Check for any remaining old references in src/
  console.log('\\n🔍 Checking for remaining old component references...');

  // This would need to be implemented with a proper file walking mechanism
  // For now, we'll just report what we checked

  if (errors.length > 0) {
    console.log('\\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\\n✨ All handlers and services updated correctly!');
  }
}

validateFiles().catch(console.error);
```

### Step 6: Update Any Additional References

Search for any other files that might reference the old component IDs:

```bash
# Search for remaining references
grep -r "intimacy:closeness\\|intimacy:facing_away" src/ --exclude-dir=node_modules

# Update any found references
```

### Step 7: Run Tests

```bash
# Run tests for updated handlers and services
npm test src/logic/operationHandlers/
npm test src/logic/services/

# Run integration tests
npm test tests/integration/
```

## Validation Steps

### 1. Run Validation Script

```bash
node scripts/validate-handlers-services.js
```

### 2. Unit Test Verification

```bash
# Test specific handlers
npm test src/logic/operationHandlers/removeFromClosenessCircleHandler.test.js
npm test src/logic/operationHandlers/mergeClosenessCircleHandler.test.js
npm test src/logic/services/closenessCircleService.test.js
```

### 3. Integration Testing

```bash
# Run integration tests that use these handlers
npm test tests/integration/rules/getCloseRule.integration.test.js
npm test tests/integration/rules/stepBackRule.integration.test.js
```

### 4. Manual Testing

Create a simple test to verify the handlers work:

```javascript
// test-handlers.js
import { Container } from '../src/dependencyInjection/container.js';
import { MergeClosenessCircleHandler } from '../src/logic/operationHandlers/mergeClosenessCircleHandler.js';

const container = new Container();
// Set up dependencies...

const handler = new MergeClosenessCircleHandler(/* dependencies */);

// Test merge operation
await handler.execute({
  actor: 'actor1',
  entity: 'actor2',
});

console.log('✅ Merge operation completed successfully');
```

## Common Issues and Solutions

### Issue 1: Component ID Mismatches

**Problem**: Handlers still reference old component IDs.

**Solution**: Use the validation script to find all references and update them systematically.

### Issue 2: Test Failures

**Problem**: Unit tests fail due to component ID changes.

**Solution**: Update test mocks and fixtures to use new component IDs.

### Issue 3: Service Method Failures

**Problem**: Service methods can't find components.

**Solution**: Verify entityManager is properly configured to work with positioning mod.

## Rollback Plan

If handlers fail:

1. Revert handler files using git
2. Re-run tests to verify stability
3. Check for any data corruption in test environments

## Completion Checklist

- [ ] Remove from closeness circle handler updated
- [ ] Merge closeness circle handler updated
- [ ] Closeness circle service updated
- [ ] All component ID constants updated
- [ ] Validation script created and passing
- [ ] Unit tests updated and passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] No old component references remaining
- [ ] Error handling and logging preserved
- [ ] Performance impact assessed
- [ ] Migration documented

## Next Steps

After successful updates:

- POSMIG-12: Update Test Files
- Continue with comprehensive testing

## Notes for Implementer

- These are critical business logic files - test thoroughly
- Preserve all error handling and logging
- Update constants at the top of files
- Verify no hardcoded strings remain
- Consider adding performance monitoring
- Update any JSDoc comments that reference old components
