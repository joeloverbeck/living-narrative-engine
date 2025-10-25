# ACTDESC-018: Implement Conditional Visibility System

## Status
🟡 **Pending**

## Phase
**Phase 6: Advanced Features** (Week 4)

## Description
Implement conditional visibility system allowing activities to appear/disappear in descriptions based on component states, JSON Logic conditions, and dynamic requirements.

## Background
Some activities should only appear under specific conditions (e.g., "kneeling" only shows if `shouldDescribeInActivity` is true and actor isn't standing). This enables dynamic, state-aware descriptions.

**Reference**: Design document lines 2292-2393 (Conditional Visibility)

## Technical Specification

### Condition Evaluation Method
```javascript
/**
 * Evaluate whether activity should be visible.
 *
 * @param {object} activity - Activity object with metadata
 * @param {object} entity - Entity instance
 * @returns {boolean} Should be visible
 * @private
 */
#evaluateActivityVisibility(activity, entity) {
  const metadata = activity.metadata || activity.activityMetadata;
  if (!metadata) {
    return true; // No metadata = always visible
  }

  // Check shouldDescribeInActivity flag
  if (metadata.shouldDescribeInActivity === false) {
    return false;
  }

  // Evaluate conditions if present
  if (metadata.conditions) {
    return this.#evaluateConditions(metadata.conditions, activity, entity);
  }

  return true; // Default to visible
}

/**
 * Evaluate condition object using JSON Logic.
 *
 * @param {object} conditions - Condition configuration
 * @param {object} activity - Activity object
 * @param {object} entity - Entity instance
 * @returns {boolean} Condition result
 * @private
 */
#evaluateConditions(conditions, activity, entity) {
  // showOnlyIfProperty condition
  if (conditions.showOnlyIfProperty) {
    const { property, equals } = conditions.showOnlyIfProperty;
    const sourceData = activity.sourceData || {};

    if (sourceData[property] !== equals) {
      return false;
    }
  }

  // requiredComponents condition
  if (conditions.requiredComponents) {
    for (const requiredComp of conditions.requiredComponents) {
      if (!entity.hasComponent(requiredComp)) {
        return false;
      }
    }
  }

  // forbiddenComponents condition
  if (conditions.forbiddenComponents) {
    for (const forbiddenComp of conditions.forbiddenComponents) {
      if (entity.hasComponent(forbiddenComp)) {
        return false;
      }
    }
  }

  // customLogic condition (JSON Logic)
  if (conditions.customLogic) {
    const logicData = {
      entity: this.#createEntityDataForLogic(entity),
      activity: activity.sourceData || {},
      target: activity.targetEntityId
        ? this.#createEntityDataForLogic(
            this.#entityManager.getEntityInstance(activity.targetEntityId)
          )
        : null,
    };

    try {
      const result = jsonLogic.apply(conditions.customLogic, logicData);
      if (!result) {
        return false;
      }
    } catch (err) {
      this.#logger.warn('Failed to evaluate custom logic', err);
      return true; // Fail open for custom logic
    }
  }

  return true; // All conditions passed
}

/**
 * Create entity data object for JSON Logic evaluation.
 *
 * @param {object} entity - Entity instance
 * @returns {object} Entity data for logic
 * @private
 */
#createEntityDataForLogic(entity) {
  if (!entity) {
    return null;
  }

  // Extract relevant component data
  const components = {};
  const allComponents = entity.getAllComponents?.() || [];

  for (const [compId, compData] of Object.entries(allComponents)) {
    components[compId] = compData;
  }

  return {
    id: entity.id,
    components,
  };
}
```

### Updated Collection Methods
```javascript
/**
 * Collect inline metadata with visibility filtering.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Visible inline activities
 * @private
 */
#collectInlineMetadata(entity) {
  const activities = [];

  const allComponents = entity.getAllComponents?.() || {};
  for (const [componentId, componentData] of Object.entries(allComponents)) {
    const metadata = componentData.activityMetadata;

    if (metadata && metadata.shouldDescribeInActivity) {
      try {
        const activity = this.#parseInlineMetadata(componentId, componentData, entity);
        if (activity && this.#evaluateActivityVisibility(activity, entity)) {
          activities.push(activity);
        }
      } catch (error) {
        this.#logger.error(`Failed to parse inline metadata for ${componentId}`, error);
      }
    }
  }

  return activities;
}

/**
 * Collect dedicated metadata with visibility filtering.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Visible dedicated activities
 * @private
 */
#collectDedicatedMetadata(entity) {
  const activities = [];

  if (!entity.hasComponent('activity:description_metadata')) {
    return activities;
  }

  const metadataComponents = entity.getAllComponentsOfType?.('activity:description_metadata') || [];

  for (const metadata of metadataComponents) {
    try {
      const activity = this.#parseDedicatedMetadata(metadata, entity);
      if (activity && this.#evaluateActivityVisibility(activity, entity)) {
        activities.push(activity);
      }
    } catch (error) {
      this.#logger.error('Failed to parse dedicated metadata', error);
    }
  }

  return activities;
}
```

## Example Metadata with Conditions

### Show Only If Property
```json
{
  "sourceComponent": "intimacy:kissing",
  "verb": "kissing",
  "targetRole": "partner",
  "priority": 90,
  "conditions": {
    "showOnlyIfProperty": {
      "property": "initiator",
      "equals": true
    }
  }
}
```

### Required Components
```json
{
  "activityMetadata": {
    "shouldDescribeInActivity": true,
    "template": "{actor} is kneeling before {target}",
    "priority": 75,
    "conditions": {
      "requiredComponents": ["positioning:kneeling_before"],
      "forbiddenComponents": ["positioning:standing"]
    }
  }
}
```

### Custom JSON Logic
```json
{
  "activityMetadata": {
    "shouldDescribeInActivity": true,
    "template": "{actor} is embracing {target} tightly",
    "priority": 85,
    "conditions": {
      "customLogic": {
        "and": [
          { ">=": [{ "var": "activity.intensity" }, 80] },
          { "in": [{ "var": "target.id" }, { "var": "entity.components.relationships:partner.entityId" }] }
        ]
      }
    }
  }
}
```

## Acceptance Criteria
- [ ] Visibility evaluation implemented
- [ ] showOnlyIfProperty condition works
- [ ] requiredComponents filtering works
- [ ] forbiddenComponents filtering works
- [ ] Custom JSON Logic evaluation works
- [ ] Visibility filtering in collection methods
- [ ] Graceful handling of evaluation errors
- [ ] Tests verify all condition types
- [ ] Performance impact minimal
- [ ] Documentation complete

## Dependencies
- **Requires**: ACTDESC-006, ACTDESC-007 (Metadata collection)
- **Blocks**: Phase 7 (Production needs conditional system)
- **Enhances**: Dynamic state-aware descriptions

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Conditional Visibility', () => {
  it('should show activity when showOnlyIfProperty condition met', async () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, 'intimacy:kissing', {
      partner: 'alicia',
      initiator: true,
    });
    addComponent(jon, 'activity:description_metadata', {
      sourceComponent: 'intimacy:kissing',
      verb: 'kissing',
      targetRole: 'partner',
      conditions: {
        showOnlyIfProperty: {
          property: 'initiator',
          equals: true,
        },
      },
    });

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('kissing');
  });

  it('should hide activity when showOnlyIfProperty condition not met', async () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, 'intimacy:kissing', {
      partner: 'alicia',
      initiator: false, // Condition not met
    });
    addComponent(jon, 'activity:description_metadata', {
      sourceComponent: 'intimacy:kissing',
      verb: 'kissing',
      targetRole: 'partner',
      conditions: {
        showOnlyIfProperty: {
          property: 'initiator',
          equals: true,
        },
      },
    });

    const description = await service.generateActivityDescription('jon');

    expect(description).not.toContain('kissing');
  });

  it('should require components for visibility', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', null, 75, {
      conditions: {
        requiredComponents: ['positioning:kneeling_before'],
      },
    });

    // Without required component
    let description = await service.generateActivityDescription('jon');
    expect(description).not.toContain('kneeling');

    // With required component
    addComponent(jon, 'positioning:kneeling_before', { entityId: 'alicia' });
    description = await service.generateActivityDescription('jon');
    expect(description).toContain('kneeling');
  });

  it('should forbid components for visibility', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is meditating', null, 75, {
      conditions: {
        forbiddenComponents: ['positioning:standing'],
      },
    });

    // Without forbidden component
    let description = await service.generateActivityDescription('jon');
    expect(description).toContain('meditating');

    // With forbidden component
    addComponent(jon, 'positioning:standing', {});
    description = await service.generateActivityDescription('jon');
    expect(description).not.toContain('meditating');
  });

  it('should evaluate custom JSON Logic', async () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, 'relationships:partner', { entityId: 'alicia' });
    addActivity(jon, '{actor} is embracing {target}', 'alicia', 85, {
      conditions: {
        customLogic: {
          in: ['alicia', { var: 'entity.components.relationships:partner.entityId' }],
        },
      },
    });

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('embracing');
  });

  it('should handle missing conditions gracefully', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is waving', null, 50); // No conditions

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('waving');
  });

  it('should fail open on JSON Logic errors', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is waving', null, 50, {
      conditions: {
        customLogic: { invalid: 'logic' },
      },
    });

    const description = await service.generateActivityDescription('jon');

    // Should still appear despite invalid logic
    expect(description).toContain('waving');
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
```

## Implementation Notes
1. **Fail Open**: If condition evaluation errors, activity still appears
2. **Performance**: Condition evaluation should be fast (<1ms per activity)
3. **Caching**: Consider caching component existence checks
4. **JSON Logic Safety**: Wrap in try-catch to prevent crashes
5. **Documentation**: Document all supported condition types

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2292-2393)

## Success Metrics
- Conditional visibility working correctly
- All condition types supported
- Performance impact <5% on generation
- Tests verify all scenarios
- Graceful error handling

## Related Tickets
- **Requires**: ACTDESC-006, ACTDESC-007
- **Enhances**: Dynamic state-aware descriptions
- **Enables**: Complex activity scenarios
