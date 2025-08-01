# Ticket 06: TargetDisplayNameResolver Implementation

**Epic**: MultiTargetResolutionStage Decomposition  
**Phase**: 2 - Context & Display Services  
**Priority**: Medium  
**Estimated Time**: 3 hours  
**Dependencies**: Ticket 01 (Project Setup & Service Interfaces)  
**Assignee**: Developer

## 📋 Summary

Extract and implement the `TargetDisplayNameResolver` service from the existing `MultiTargetResolutionStage` class. This service handles resolving entity display names for target presentation, including batch processing and configurable fallback handling.

## 🎯 Objectives

- Extract display name resolution logic from `MultiTargetResolutionStage.js` lines 713-730
- Implement consistent display name resolution with fallback handling
- Add batch processing support for multiple entities
- Create configurable fallback naming strategies
- Integrate with EntityManager for entity data access

## 📝 Requirements Analysis

From the specification:

> "**TargetDisplayNameResolver**: Resolve entity display names for target presentation."

**Extracted Code**: Lines 713-730 from `#getEntityDisplayName(entityId)`

Current implementation shows simple display name resolution with fallback to entity ID.

## 🏗️ Implementation Tasks

### Task 6.1: Implement Core Service Class (1.5 hours)

**File to Create**: `src/actions/pipeline/services/implementations/TargetDisplayNameResolver.js`

**Implementation Details**:

```javascript
/**
 * @file TargetDisplayNameResolver - Service for resolving entity display names
 */

import { BaseService } from '../base/BaseService.js';
import { ServiceError } from '../base/ServiceError.js';
import { validateDependency } from '../../../../utils/dependencyUtils.js';

/**
 * Service for resolving entity display names for target presentation
 *
 * Provides:
 * - Consistent display name resolution
 * - Batch processing support for multiple entities
 * - Configurable fallback handling
 * - Entity manager integration
 */
export class TargetDisplayNameResolver extends BaseService {
  #entityManager;
  #fallbackName = 'Unknown Entity';

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    super({ logger });

    validateDependency(entityManager, 'IEntityManager');
    this.#entityManager = entityManager;

    this.logOperation('initialized', {
      service: 'TargetDisplayNameResolver',
      entityManager: entityManager.constructor.name,
    });
  }

  /**
   * Get display name for entity
   *
   * Extracted from MultiTargetResolutionStage.js lines 713-730
   *
   * @param {string} entityId - Entity identifier
   * @returns {string} Display name or fallback
   */
  getEntityDisplayName(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      this.logOperation(
        'getEntityDisplayName',
        {
          entityId,
          result: 'invalid_id',
        },
        'warn'
      );
      return this.#fallbackName;
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);

      if (!entity) {
        this.logOperation(
          'getEntityDisplayName',
          {
            entityId,
            result: 'entity_not_found',
          },
          'debug'
        );
        return entityId; // Fallback to ID as in original implementation
      }

      // Try to get display name from various components
      const displayName = this.#extractDisplayName(entity);

      this.logOperation(
        'getEntityDisplayName',
        {
          entityId,
          result: 'success',
          displayName,
        },
        'debug'
      );

      return displayName || entityId;
    } catch (error) {
      this.logger.warn('Failed to get entity display name', {
        entityId,
        error: error.message,
      });
      return entityId;
    }
  }

  /**
   * Get display names for multiple entities
   *
   * @param {string[]} entityIds - Entity identifiers
   * @returns {Object.<string, string>} Map of ID to display name
   */
  getEntityDisplayNames(entityIds) {
    this.validateParams({ entityIds }, ['entityIds']);

    if (!Array.isArray(entityIds)) {
      throw new ServiceError(
        'Entity IDs must be an array',
        'INVALID_ENTITY_IDS'
      );
    }

    const result = {};

    this.logOperation('getEntityDisplayNames', {
      count: entityIds.length,
    });

    for (const entityId of entityIds) {
      result[entityId] = this.getEntityDisplayName(entityId);
    }

    return result;
  }

  /**
   * Set fallback name for unknown entities
   *
   * @param {string} fallbackName - Default name to use
   */
  setFallbackName(fallbackName) {
    if (typeof fallbackName !== 'string') {
      throw new ServiceError(
        'Fallback name must be a string',
        'INVALID_FALLBACK_NAME'
      );
    }

    this.#fallbackName = fallbackName;
    this.logOperation('setFallbackName', { fallbackName });
  }

  /**
   * Extract display name from entity using various strategies
   *
   * @param {object} entity - Entity instance
   * @returns {string|null} Display name or null
   * @private
   */
  #extractDisplayName(entity) {
    // Strategy 1: Check for explicit display name
    const displayNameComponent = entity.getComponentData?.('core:display');
    if (displayNameComponent?.name) {
      return displayNameComponent.name;
    }

    // Strategy 2: Check core name
    const coreComponent = entity.getComponentData?.('core');
    if (coreComponent?.name) {
      return coreComponent.name;
    }

    // Strategy 3: Check character name
    const characterComponent = entity.getComponentData?.('core:character');
    if (characterComponent?.name) {
      return characterComponent.name;
    }

    return null;
  }
}
```

### Task 6.2: Create Unit Tests (1 hour)

**File to Create**: `tests/unit/actions/pipeline/services/implementations/TargetDisplayNameResolver.test.js`

### Task 6.3: Integration Setup (0.5 hours)

**File to Modify**: `src/dependencyInjection/containerConfig.js`

Configure service in DI container with EntityManager dependency.

## 📊 Success Criteria

- [ ] Exact logic extracted from lines 713-730
- [ ] Batch processing functionality implemented
- [ ] Configurable fallback handling working
- [ ] ≥95% code coverage achieved
- [ ] Integration with EntityManager verified

---

**Created**: 2025-01-08  
**Status**: Ready for Implementation
