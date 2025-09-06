# MOULOCSYS-005: Create Mouth Engagement Utility Functions

**Phase**: Core Infrastructure  
**Priority**: Critical  
**Complexity**: Medium  
**Dependencies**: MOULOCSYS-001 (component schema)  
**Estimated Time**: 4-5 hours

## Summary

Create the `mouthEngagementUtils.js` utility module that provides the core functionality for managing mouth engagement locks. This utility handles the complexity of both anatomy-based entities (with mouth parts) and legacy entities (with direct components), providing a unified interface for the lock/unlock handlers.

## Technical Requirements

### File to Create

`src/utils/mouthEngagementUtils.js`

### Utility Architecture

#### Main Function: updateMouthEngagementLock
```javascript
/**
 * @file Utility functions for managing mouth engagement locks.
 * @description Provides unified interface for locking/unlocking mouth engagement
 * across both anatomy-based and legacy entity structures.
 */

import { deepClone } from './cloneUtils.js';

/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/**
 * Result from updating mouth engagement lock.
 * @typedef {Object} MouthEngagementUpdateResult
 * @property {Array<{partId: string, engagement: object}>} [updatedParts] - Updated anatomy parts
 * @property {boolean} locked - The lock state that was applied
 */

/**
 * Update the locked state of an entity's mouth engagement component.
 * Handles both legacy entities with direct mouth engagement and anatomy-based mouth parts.
 *
 * @param {EntityManager} entityManager - Entity manager instance.
 * @param {string} entityId - ID of the entity to update.
 * @param {boolean} locked - Whether mouth engagement should be locked.
 * @returns {Promise<MouthEngagementUpdateResult|null>} Update result or null if no mouth found.
 */
export async function updateMouthEngagementLock(entityManager, entityId, locked) {
  // Validate inputs
  if (!entityManager) {
    throw new Error('EntityManager is required');
  }
  
  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Valid entityId string is required');
  }
  
  if (typeof locked !== 'boolean') {
    throw new Error('Locked parameter must be a boolean');
  }

  // Check if entity has anatomy:body component
  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.root) {
    // New anatomy-based path: find and update mouth parts
    return await updateAnatomyBasedMouthEngagement(
      entityManager,
      entityId,
      bodyComponent,
      locked
    );
  }

  // Legacy path: check entity directly for mouth engagement
  return await updateLegacyMouthEngagement(
    entityManager,
    entityId,
    locked
  );
}

/**
 * Update mouth engagement for anatomy-based entities.
 * @private
 */
async function updateAnatomyBasedMouthEngagement(
  entityManager,
  entityId,
  bodyComponent,
  locked
) {
  const updatedParts = [];

  // Look for mouth parts in the body.parts map
  if (bodyComponent.body.parts) {
    for (const [partType, partId] of Object.entries(
      bodyComponent.body.parts
    )) {
      // Check if this part is a mouth by looking for the anatomy:part component
      const partComponent = entityManager.getComponentData(
        partId,
        'anatomy:part'
      );
      
      if (partComponent && partComponent.subType === 'mouth') {
        // Get or create mouth engagement component
        let mouthEngagement = entityManager.getComponentData(
          partId,
          'core:mouth_engagement'
        );
        
        if (!mouthEngagement) {
          mouthEngagement = { locked: false, forcedOverride: false };
        }
        
        // Clone and update the mouth engagement component
        const updatedEngagement = cloneComponent(mouthEngagement);
        updatedEngagement.locked = locked;

        // Update the component
        await entityManager.addComponent(
          partId,
          'core:mouth_engagement',
          updatedEngagement
        );
        
        updatedParts.push({ 
          partId, 
          engagement: updatedEngagement 
        });
      }
    }
  }

  // Return summary of updates
  return updatedParts.length > 0 
    ? { updatedParts, locked } 
    : null;
}

/**
 * Update mouth engagement for legacy entities.
 * @private
 */
async function updateLegacyMouthEngagement(
  entityManager,
  entityId,
  locked
) {
  // Check for existing mouth engagement component
  const existing = entityManager.getComponentData(
    entityId, 
    'core:mouth_engagement'
  );
  
  const engagement = existing 
    ? cloneComponent(existing)
    : { locked: false, forcedOverride: false };
  
  engagement.locked = locked;
  
  await entityManager.addComponent(
    entityId, 
    'core:mouth_engagement', 
    engagement
  );
  
  return { locked };
}

/**
 * Clone a component object safely.
 * @private
 */
function cloneComponent(component) {
  // Use native structuredClone if available (Node 17+)
  if (typeof structuredClone === 'function') {
    return structuredClone(component);
  }
  // Fallback to utility function
  return deepClone(component);
}

/**
 * Check if an entity's mouth is currently locked.
 * Convenience function for read-only checks.
 *
 * @param {EntityManager} entityManager - Entity manager instance.
 * @param {string} entityId - ID of the entity to check.
 * @returns {boolean} True if mouth is locked, false otherwise.
 */
export function isMouthLocked(entityManager, entityId) {
  if (!entityManager || !entityId) {
    return false;
  }

  // Check anatomy-based path first
  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.parts) {
    // Check all mouth parts
    for (const [partType, partId] of Object.entries(
      bodyComponent.body.parts
    )) {
      const partComponent = entityManager.getComponentData(
        partId,
        'anatomy:part'
      );
      
      if (partComponent && partComponent.subType === 'mouth') {
        const engagement = entityManager.getComponentData(
          partId,
          'core:mouth_engagement'
        );
        
        if (engagement && engagement.locked) {
          return true; // At least one mouth is locked
        }
      }
    }
    return false; // No locked mouths found
  }

  // Check legacy path
  const engagement = entityManager.getComponentData(
    entityId,
    'core:mouth_engagement'
  );
  
  return engagement ? engagement.locked : false;
}

/**
 * Get all mouth parts for an entity.
 * Useful for debugging and testing.
 *
 * @param {EntityManager} entityManager - Entity manager instance.
 * @param {string} entityId - ID of the entity.
 * @returns {Array<{partId: string, partComponent: object, engagement: object|null}>} Array of mouth parts.
 */
export function getMouthParts(entityManager, entityId) {
  const mouthParts = [];
  
  if (!entityManager || !entityId) {
    return mouthParts;
  }

  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.parts) {
    for (const [partType, partId] of Object.entries(
      bodyComponent.body.parts
    )) {
      const partComponent = entityManager.getComponentData(
        partId,
        'anatomy:part'
      );
      
      if (partComponent && partComponent.subType === 'mouth') {
        const engagement = entityManager.getComponentData(
          partId,
          'core:mouth_engagement'
        );
        
        mouthParts.push({
          partId,
          partComponent,
          engagement
        });
      }
    }
  }
  
  return mouthParts;
}
```

## Implementation Details

### Function Responsibilities

#### updateMouthEngagementLock (Main Export)
- **Purpose**: Single entry point for all mouth lock operations
- **Handles**: Both anatomy-based and legacy entities
- **Returns**: Detailed result object or null
- **Async**: Supports future async operations

#### updateAnatomyBasedMouthEngagement (Private)
- **Purpose**: Handle modern anatomy-based entities
- **Process**: Iterate through body parts, find mouths, update each
- **Returns**: Array of updated parts with details

#### updateLegacyMouthEngagement (Private)
- **Purpose**: Handle legacy entities with direct components
- **Process**: Update or create component on entity directly
- **Returns**: Simple locked state confirmation

#### isMouthLocked (Helper Export)
- **Purpose**: Read-only check for mouth lock status
- **Use Case**: Condition checks, debugging, testing
- **Returns**: Boolean locked state

#### getMouthParts (Debug Export)
- **Purpose**: Get all mouth parts for debugging/testing
- **Use Case**: Tests, debugging, inspection tools
- **Returns**: Detailed mouth part information

### Error Handling Strategy

```javascript
// Input validation with clear error messages
if (!entityManager) {
  throw new Error('EntityManager is required');
}

// Graceful handling of missing components
if (!bodyComponent) {
  // Try legacy path instead of erroring
}

// Return null for "no mouth" case (not an error)
if (mouthParts.length === 0) {
  return null;
}
```

## Acceptance Criteria

### Core Functionality
- [ ] **Main Function**: updateMouthEngagementLock works correctly
- [ ] **Anatomy Support**: Handles anatomy-based entities
- [ ] **Legacy Support**: Handles direct component entities
- [ ] **Lock Setting**: Correctly sets locked = true
- [ ] **Unlock Setting**: Correctly sets locked = false
- [ ] **Component Creation**: Creates component if missing

### Helper Functions
- [ ] **Lock Check**: isMouthLocked returns correct state
- [ ] **Parts Retrieval**: getMouthParts finds all mouths
- [ ] **Multiple Mouths**: Handles entities with multiple mouths
- [ ] **No Mouth Handling**: Returns null/empty appropriately

### Error Handling
- [ ] **Input Validation**: Validates all parameters
- [ ] **Clear Errors**: Error messages are descriptive
- [ ] **Graceful Degradation**: Handles missing components
- [ ] **No Crashes**: Never throws for valid operations

## Testing Strategy

### Unit Tests

File: `tests/unit/utils/mouthEngagementUtils.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  updateMouthEngagementLock,
  isMouthLocked,
  getMouthParts
} from '../../../src/utils/mouthEngagementUtils.js';
import { createMockEntityManager } from '../../common/mocks/mockEntityManager.js';

describe('mouthEngagementUtils', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
  });

  describe('updateMouthEngagementLock', () => {
    describe('Input Validation', () => {
      it('should throw if entityManager is missing', async () => {
        await expect(
          updateMouthEngagementLock(null, 'entity_1', true)
        ).rejects.toThrow('EntityManager is required');
      });

      it('should throw if entityId is invalid', async () => {
        await expect(
          updateMouthEngagementLock(mockEntityManager, '', true)
        ).rejects.toThrow('Valid entityId string is required');
      });

      it('should throw if locked is not boolean', async () => {
        await expect(
          updateMouthEngagementLock(mockEntityManager, 'entity_1', 'yes')
        ).rejects.toThrow('Locked parameter must be a boolean');
      });
    });

    describe('Anatomy-Based Entities', () => {
      it('should lock mouth part in anatomy-based entity', async () => {
        // Setup anatomy structure
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ // anatomy:body
            body: {
              root: 'torso_1',
              parts: { mouth: 'mouth_1' }
            }
          })
          .mockReturnValueOnce({ // anatomy:part
            subType: 'mouth'
          })
          .mockReturnValueOnce(null); // No existing engagement

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify
        expect(result).toEqual({
          updatedParts: [{
            partId: 'mouth_1',
            engagement: { locked: true, forcedOverride: false }
          }],
          locked: true
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'mouth_1',
          'core:mouth_engagement',
          { locked: true, forcedOverride: false }
        );
      });

      it('should handle multiple mouth parts', async () => {
        // Setup entity with two mouths
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ // anatomy:body
            body: {
              root: 'torso_1',
              parts: { 
                mouth: 'mouth_1',
                secondary_mouth: 'mouth_2'
              }
            }
          })
          .mockReturnValueOnce({ subType: 'mouth' }) // mouth_1 part
          .mockReturnValueOnce(null) // mouth_1 engagement
          .mockReturnValueOnce({ subType: 'mouth' }) // mouth_2 part
          .mockReturnValueOnce(null); // mouth_2 engagement

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify both mouths updated
        expect(result.updatedParts).toHaveLength(2);
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
      });

      it('should return null if no mouth parts found', async () => {
        // Setup entity without mouth
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ // anatomy:body
            body: {
              root: 'torso_1',
              parts: { head: 'head_1' } // No mouth
            }
          });

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify
        expect(result).toBeNull();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });
    });

    describe('Legacy Entities', () => {
      it('should update existing component on legacy entity', async () => {
        // Setup legacy entity
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // No anatomy:body
          .mockReturnValueOnce({ // Existing engagement
            locked: false,
            forcedOverride: false
          });

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'legacy_entity',
          true
        );

        // Verify
        expect(result).toEqual({ locked: true });
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'legacy_entity',
          'core:mouth_engagement',
          { locked: true, forcedOverride: false }
        );
      });

      it('should create component if missing on legacy entity', async () => {
        // Setup
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // No anatomy:body
          .mockReturnValueOnce(null); // No existing component

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'legacy_entity',
          false
        );

        // Verify
        expect(result).toEqual({ locked: false });
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'legacy_entity',
          'core:mouth_engagement',
          { locked: false, forcedOverride: false }
        );
      });
    });
  });

  describe('isMouthLocked', () => {
    it('should return true if anatomy mouth is locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' }
          }
        })
        .mockReturnValueOnce({ subType: 'mouth' })
        .mockReturnValueOnce({ locked: true });

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(true);
    });

    it('should return false if no mouths are locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' }
          }
        })
        .mockReturnValueOnce({ subType: 'mouth' })
        .mockReturnValueOnce({ locked: false });

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(isMouthLocked(null, 'entity_1')).toBe(false);
      expect(isMouthLocked(mockEntityManager, null)).toBe(false);
    });
  });

  describe('getMouthParts', () => {
    it('should return all mouth parts with details', () => {
      const partComponent = { subType: 'mouth', name: 'mouth' };
      const engagement = { locked: false, forcedOverride: false };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' }
          }
        })
        .mockReturnValueOnce(partComponent)
        .mockReturnValueOnce(engagement);

      const result = getMouthParts(mockEntityManager, 'entity_1');
      
      expect(result).toEqual([{
        partId: 'mouth_1',
        partComponent,
        engagement
      }]);
    });

    it('should return empty array for entity without mouths', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ // anatomy:body
          body: {
            root: 'torso_1',
            parts: { head: 'head_1' }
          }
        });

      const result = getMouthParts(mockEntityManager, 'entity_1');
      expect(result).toEqual([]);
    });
  });
});
```

## Performance Considerations

### Optimization Strategies
- **Early Exit**: Return immediately when no mouth found
- **Single Pass**: Iterate body parts only once
- **Minimal Cloning**: Clone only when updating
- **Cache Results**: Consider caching mouth part lookups

### Performance Metrics
- **Target Time**: < 5ms for typical entity
- **Memory**: Minimal allocations
- **Complexity**: O(n) where n = number of body parts

## Definition of Done

- [ ] Main utility function implemented
- [ ] Anatomy-based path working
- [ ] Legacy path working
- [ ] Helper functions implemented
- [ ] Input validation complete
- [ ] Error handling robust
- [ ] Unit tests written (>95% coverage)
- [ ] JSDoc comments complete
- [ ] Performance acceptable
- [ ] Code follows project standards