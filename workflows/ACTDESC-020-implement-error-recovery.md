# ACTDESC-020: Implement Error Recovery and Resilience

## Status
🟡 **Pending**

## Phase
**Phase 6: Advanced Features** (Week 4)

## Description
Implement comprehensive error recovery mechanisms to handle malformed metadata, missing entities, evaluation errors, and edge cases gracefully without breaking description generation.

## Background
Production systems must handle errors gracefully. This ticket ensures the activity description system never crashes the game, always produces some output, and logs issues for debugging.

**Reference**: Design document lines 2484-2574 (Error Handling and Recovery)

## Technical Specification

### Error Recovery Wrapper
```javascript
/**
 * Generate activity description with comprehensive error recovery.
 *
 * @param {string} entityId - Entity ID
 * @returns {Promise<string>} Description or empty string on failure
 */
async generateActivityDescription(entityId) {
  try {
    // Validate input
    assertNonBlankString(entityId, 'Entity ID', 'generateActivityDescription', this.#logger);

    // Get entity with error handling
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.warn(`Entity not found: ${entityId}`);
      return '';
    }

    // Collect activities with individual error recovery
    const inlineActivities = this.#collectInlineMetadataSafe(entity);
    const dedicatedActivities = this.#collectDedicatedMetadataSafe(entity);
    const allActivities = [...inlineActivities, ...dedicatedActivities];

    if (allActivities.length === 0) {
      return '';
    }

    // Sort and filter with error handling
    const sortedActivities = this.#sortActivitiesSafe(allActivities);
    const filteredActivities = this.#filterActivitiesSafe(sortedActivities, entity);

    if (filteredActivities.length === 0) {
      return '';
    }

    // Format with error recovery
    return this.#formatActivityDescriptionSafe(filteredActivities, entity);
  } catch (err) {
    this.#logger.error('Failed to generate activity description', err);

    // Dispatch error event
    if (this.#eventBus) {
      this.#eventBus.dispatch({
        type: 'ACTIVITY_DESCRIPTION_ERROR',
        payload: {
          entityId,
          error: err.message,
          timestamp: Date.now(),
        },
      });
    }

    return ''; // Fail gracefully
  }
}
```

### Safe Collection Methods
```javascript
/**
 * Collect inline metadata with individual error recovery.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Activities (partial results on errors)
 * @private
 */
#collectInlineMetadataSafe(entity) {
  const activities = [];

  try {
    const allComponents = entity.getAllComponents?.() || {};

    for (const [componentId, componentData] of Object.entries(allComponents)) {
      try {
        const metadata = componentData.activityMetadata;

        if (metadata && metadata.shouldDescribeInActivity) {
          const activity = this.#parseInlineMetadata(componentId, componentData, entity);

          if (activity) {
            // Validate activity structure
            if (this.#isValidActivity(activity)) {
              activities.push(activity);
            } else {
              this.#logger.warn(`Invalid activity structure from ${componentId}`, activity);
            }
          }
        }
      } catch (err) {
        // Log but continue processing other components
        this.#logger.error(`Failed to parse inline metadata for ${componentId}`, err);
      }
    }
  } catch (err) {
    this.#logger.error('Failed to collect inline metadata', err);
  }

  return activities;
}

/**
 * Collect dedicated metadata with individual error recovery.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Activities (partial results on errors)
 * @private
 */
#collectDedicatedMetadataSafe(entity) {
  const activities = [];

  try {
    if (!entity.hasComponent('activity:description_metadata')) {
      return activities;
    }

    const metadataComponents = entity.getAllComponentsOfType?.('activity:description_metadata') || [];

    for (const metadata of metadataComponents) {
      try {
        const activity = this.#parseDedicatedMetadata(metadata, entity);

        if (activity && this.#isValidActivity(activity)) {
          activities.push(activity);
        }
      } catch (err) {
        this.#logger.error('Failed to parse dedicated metadata', err);
      }
    }
  } catch (err) {
    this.#logger.error('Failed to collect dedicated metadata', err);
  }

  return activities;
}

/**
 * Validate activity structure.
 *
 * @param {object} activity - Activity object
 * @returns {boolean} Is valid
 * @private
 */
#isValidActivity(activity) {
  if (!activity || typeof activity !== 'object') {
    return false;
  }

  // Must have type
  if (!activity.type || !['inline', 'dedicated'].includes(activity.type)) {
    return false;
  }

  // Must have source component
  if (!activity.sourceComponent || typeof activity.sourceComponent !== 'string') {
    return false;
  }

  // Inline must have template
  if (activity.type === 'inline' && !activity.template) {
    return false;
  }

  // Dedicated must have verb or template
  if (activity.type === 'dedicated' && !activity.verb && !activity.template) {
    return false;
  }

  return true;
}
```

### Safe Formatting Methods
```javascript
/**
 * Format description with error recovery.
 *
 * @param {Array<object>} activities - Activities
 * @param {object} entity - Entity
 * @returns {string} Description
 * @private
 */
#formatActivityDescriptionSafe(activities, entity) {
  try {
    const config = this.#getConfigSafe();
    const actorName = this.#resolveEntityNameSafe(entity.id);
    const actorGender = this.#detectEntityGenderSafe(entity.id);
    const actorPronouns = this.#getPronounSet(actorGender);

    // Group activities with error recovery
    const groups = this.#groupActivitiesSafe(activities);

    // Format each group with error recovery
    const descriptions = [];
    for (let i = 0; i < groups.length; i++) {
      try {
        const actorRef = i === 0 ? actorName : (
          config.nameResolution?.usePronounsWhenAvailable
            ? actorPronouns.subject
            : actorName
        );

        const groupDesc = this.#formatGroupSafe(actorRef, groups[i], entity);
        if (groupDesc) {
          descriptions.push(groupDesc);
        }
      } catch (err) {
        this.#logger.error(`Failed to format activity group ${i}`, err);
        // Continue with other groups
      }
    }

    if (descriptions.length === 0) {
      return '';
    }

    const prefix = config.prefix || '';
    const suffix = config.suffix || '';
    const separator = config.separator || '. ';

    return `${prefix}${descriptions.join(separator)}${suffix}`;
  } catch (err) {
    this.#logger.error('Failed to format activity description', err);
    return '';
  }
}

/**
 * Resolve entity name safely.
 *
 * @param {string} entityId - Entity ID
 * @returns {string} Name or fallback
 * @private
 */
#resolveEntityNameSafe(entityId) {
  try {
    // Check cache first
    if (this.#entityNameCache.has(entityId)) {
      return this.#entityNameCache.get(entityId);
    }

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#entityNameCache.set(entityId, entityId);
      return entityId;
    }

    const nameComponent = entity.getComponentData('core:name');
    const name = nameComponent?.text || entityId;

    this.#entityNameCache.set(entityId, name);
    return name;
  } catch (err) {
    this.#logger.error(`Failed to resolve name for ${entityId}`, err);
    return entityId; // Fallback to ID
  }
}

/**
 * Get configuration safely.
 *
 * @returns {object} Config with fallbacks
 * @private
 */
#getConfigSafe() {
  try {
    return this.#anatomyFormattingService.getActivityIntegrationConfig();
  } catch (err) {
    this.#logger.warn('Failed to get config, using defaults', err);

    // Return default config
    return {
      prefix: 'Activity: ',
      suffix: '',
      separator: '. ',
      maxActivities: 10,
      nameResolution: {
        usePronounsWhenAvailable: false,
        fallbackToNames: true,
      },
    };
  }
}
```

### Error Event Dispatching
```javascript
/**
 * Dispatch error event with context.
 *
 * @param {string} errorType - Error type
 * @param {object} context - Error context
 * @private
 */
#dispatchError(errorType, context) {
  if (!this.#eventBus) {
    return;
  }

  try {
    this.#eventBus.dispatch({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: {
        errorType,
        ...context,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    // Even error dispatching can fail - just log
    this.#logger.error('Failed to dispatch error event', err);
  }
}
```

## Acceptance Criteria
- [ ] Main method has comprehensive error handling
- [ ] Collection methods recover from individual failures
- [ ] Formatting methods handle partial failures
- [ ] Invalid activity structures detected and skipped
- [ ] Entity name resolution fallbacks to ID
- [ ] Configuration fallbacks to defaults
- [ ] Error events dispatched
- [ ] Graceful degradation (partial results on errors)
- [ ] No crashes on malformed data
- [ ] Tests verify error scenarios

## Dependencies
- **Requires**: All Phase 5 features
- **Blocks**: Phase 7 (Production needs resilience)
- **Enhances**: System reliability

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Error Recovery', () => {
  it('should return empty string for missing entity', async () => {
    mockEntityManager.getEntityInstance.mockReturnValue(null);

    const description = await service.generateActivityDescription('missing_entity');

    expect(description).toBe('');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Entity not found')
    );
  });

  it('should continue processing on individual activity parse error', async () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, 'comp1', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        // Invalid: missing template
      },
    });
    addComponent(jon, 'comp2', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is valid',
        priority: 75,
      },
    });

    const description = await service.generateActivityDescription('jon');

    // Should include valid activity despite invalid one
    expect(description).toContain('valid');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should validate activity structure', () => {
    expect(service['#isValidActivity'](null)).toBe(false);
    expect(service['#isValidActivity']({})).toBe(false);
    expect(service['#isValidActivity']({ type: 'invalid' })).toBe(false);
    expect(service['#isValidActivity']({ type: 'inline' })).toBe(false); // Missing template

    expect(service['#isValidActivity']({
      type: 'inline',
      sourceComponent: 'comp',
      template: '{actor} waves',
    })).toBe(true);
  });

  it('should fallback to default config on error', async () => {
    mockFormattingService.getActivityIntegrationConfig.mockImplementation(() => {
      throw new Error('Config error');
    });

    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} waves', null, 75);

    const description = await service.generateActivityDescription('jon');

    // Should use default prefix
    expect(description).toMatch(/^Activity:/);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get config')
    );
  });

  it('should fallback to entityId on name resolution error', () => {
    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Entity manager error');
    });

    const name = service['#resolveEntityNameSafe']('entity_id');

    expect(name).toBe('entity_id');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should dispatch error events', async () => {
    const mockEventBus = createMockEventBus();
    service = new ActivityDescriptionService({
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      eventBus: mockEventBus,
    });

    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Critical error');
    });

    await service.generateActivityDescription('jon');

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTIVITY_DESCRIPTION_ERROR',
        payload: expect.objectContaining({
          entityId: 'jon',
          error: expect.any(String),
        }),
      })
    );
  });

  it('should not crash on deeply nested errors', async () => {
    // Mock everything to throw errors
    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Entity error');
    });
    mockFormattingService.getActivityIntegrationConfig.mockImplementation(() => {
      throw new Error('Config error');
    });

    const description = await service.generateActivityDescription('jon');

    // Should return empty string without crashing
    expect(description).toBe('');
  });
});
```

## Implementation Notes
1. **Fail Gracefully**: Always return something (empty string > crash)
2. **Partial Results**: Process what we can, skip failures
3. **Logging**: Log all errors for debugging
4. **Event Dispatching**: Notify system of errors for monitoring
5. **Validation**: Validate structures before processing

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2484-2574)

## Success Metrics
- No crashes on malformed data
- Partial results on partial failures
- All errors logged
- Error events dispatched
- Graceful degradation verified

## Related Tickets
- **Requires**: All Phase 5 features
- **Enhances**: System reliability and production readiness
- **Enables**: Safe production deployment
