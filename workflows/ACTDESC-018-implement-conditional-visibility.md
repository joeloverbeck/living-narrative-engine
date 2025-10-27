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

Extend `ActivityDescriptionService`'s constructor to accept an injected `jsonLogicEvaluationService` (the existing `JsonLogicEvaluationService` from `src/logic/jsonLogicEvaluationService.js`). Store it in a new private field with validation similar to other dependencies. This keeps JSON Logic handling consistent with the rest of the codebase.

```javascript
/**
 * Filter activities based on visibility rules.
 *
 * @param {Array<object>} activities - Raw activity entries from collectors.
 * @param {object} entity - Entity instance requesting the description.
 * @returns {Array<object>} Only the activities that should remain visible.
 * @private
 */
#filterByConditions(activities, entity) {
  return activities.filter((activity) =>
    this.#evaluateActivityVisibility(activity, entity)
  );
}

/**
 * Determine whether a single activity should remain visible.
 *
 * @param {object} activity - Activity record produced by the collectors.
 * @param {object} entity - Entity instance requesting the description.
 * @returns {boolean} True when the activity should remain visible.
 * @private
 */
#evaluateActivityVisibility(activity, entity) {
  if (!activity || activity.visible === false) {
    return false;
  }

  if (typeof activity.condition === 'function') {
    try {
      return activity.condition(entity);
    } catch (error) {
      this.#logger.warn(
        'Condition evaluation failed for activity description entry',
        error
      );
      return false;
    }
  }

  const metadata = activity.metadata ?? activity.activityMetadata ?? {};
  const conditions = activity.conditions ?? metadata.conditions;

  if (!conditions || this.#isEmptyConditionsObject(conditions)) {
    return metadata.shouldDescribeInActivity !== false;
  }

  if (metadata.shouldDescribeInActivity === false) {
    return false;
  }

  if (
    conditions.showOnlyIfProperty &&
    !this.#matchesPropertyCondition(activity, conditions.showOnlyIfProperty)
  ) {
    return false;
  }

  if (
    conditions.requiredComponents &&
    !this.#hasRequiredComponents(entity, conditions.requiredComponents)
  ) {
    return false;
  }

  if (
    conditions.forbiddenComponents &&
    this.#hasForbiddenComponents(entity, conditions.forbiddenComponents)
  ) {
    return false;
  }

  if (conditions.customLogic) {
    const context = this.#buildLogicContext(activity, entity);

    try {
      const result = this.#jsonLogicEvaluationService.evaluate(
        conditions.customLogic,
        context
      );

      if (!result) {
        return false;
      }
    } catch (error) {
      this.#logger.warn('Failed to evaluate custom logic', error);
      return true; // Fail open for custom logic errors
    }
  }

  return true;
}

/**
 * Construct the data payload used for JSON Logic evaluation.
 *
 * @param {object} activity - Activity record.
 * @param {object} entity - Entity instance requesting the description.
 * @returns {object} Data for JSON Logic rules.
 * @private
 */
#buildLogicContext(activity, entity) {
  const targetEntity = activity.targetEntityId
    ? this.#entityManager.getEntityInstance(activity.targetEntityId)
    : null;

  return {
    entity: this.#extractEntityData(entity),
    activity: activity.sourceData ?? {},
    target: targetEntity ? this.#extractEntityData(targetEntity) : null,
  };
}

/**
 * Extract relevant component information for JSON Logic.
 *
 * @param {object|null} entity - Entity instance.
 * @returns {object|null} Simplified entity representation.
 * @private
 */
#extractEntityData(entity) {
  if (!entity) {
    return null;
  }

  const componentIds = entity.componentTypeIds ?? [];
  const components = {};

  for (const componentId of componentIds) {
    components[componentId] = entity.getComponentData(componentId);
  }

  return {
    id: entity.id,
    components,
  };
}

/**
 * Determine if the provided conditions object has no actionable rules.
 *
 * @param {object} conditions - Condition configuration from metadata.
 * @returns {boolean} True when the object contains no keys.
 * @private
 */
#isEmptyConditionsObject(conditions) {
  return !conditions || Object.keys(conditions).length === 0;
}

/**
 * Verify a `showOnlyIfProperty` rule against the activity source data.
 *
 * @param {object} activity - Activity record.
 * @param {object} rule - Rule with `property` and `equals` keys.
 * @returns {boolean} True when the activity satisfies the rule.
 * @private
 */
#matchesPropertyCondition(activity, rule) {
  if (!rule?.property) {
    return true;
  }

  const sourceData = activity.sourceData ?? {};
  return sourceData[rule.property] === rule.equals;
}

/**
 * Verify that the entity has all components listed in `requiredComponents`.
 *
 * @param {object} entity - Entity instance.
 * @param {Array<string>} required - Component identifiers.
 * @returns {boolean} True when every component exists.
 * @private
 */
#hasRequiredComponents(entity, required) {
  return required.every((componentId) => entity.hasComponent(componentId));
}

/**
 * Verify that the entity does **not** contain any forbidden components.
 *
 * @param {object} entity - Entity instance.
 * @param {Array<string>} forbidden - Component identifiers.
 * @returns {boolean} True when no forbidden component is present.
 * @private
 */
#hasForbiddenComponents(entity, forbidden) {
  return !forbidden.some((componentId) => entity.hasComponent(componentId));
}
```

Update `#parseInlineMetadata` so that the returned activity includes the raw
`activityMetadata` reference and a `conditions` field:

- `activityMetadata: metadata`
- `conditions: metadata.conditions ?? null`

Dedicated metadata parsing already exposes `metadata` and `conditions`; ensure
that structure is preserved so the visibility filter receives the data without
needing additional lookups.

### Updated Collection Methods
```javascript
/**
 * Collect inline metadata and attach visibility-aware payloads.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Inline activities (visibility handled later)
 * @private
 */
#collectInlineMetadata(entity) {
  const activities = [];
  const componentIds = entity.componentTypeIds ?? [];

  for (const componentId of componentIds) {
    if (componentId === 'activity:description_metadata') {
      continue; // Dedicated metadata handled separately
    }

    const componentData = entity.getComponentData(componentId);
    const metadata = componentData?.activityMetadata;

    if (metadata?.shouldDescribeInActivity) {
      try {
        const activity = this.#parseInlineMetadata(
          componentId,
          componentData,
          metadata
        );
        if (activity) {
          activities.push(activity);
        }
      } catch (error) {
        this.#logger.error(
          `Failed to parse inline metadata for ${componentId}`,
          error
        );
      }
    }
  }

  return activities;
}

/**
 * Collect dedicated metadata component (single instance per entity).
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Dedicated activities (visibility handled later)
 * @private
 */
#collectDedicatedMetadata(entity) {
  const activities = [];

  if (!entity.hasComponent('activity:description_metadata')) {
    return activities;
  }

  const metadata = entity.getComponentData('activity:description_metadata');

  if (!metadata) {
    return activities;
  }

  try {
    const activity = this.#parseDedicatedMetadata(metadata, entity);
    if (activity) {
      activities.push(activity);
    }
  } catch (error) {
    this.#logger.error('Failed to parse dedicated metadata', error);
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
4. **Dependency Wiring**: Update `worldAndEntityRegistrations` to supply the `JsonLogicEvaluationService` when constructing the activity description service.
5. **JSON Logic Safety**: Wrap in try-catch to prevent crashes and reuse `JsonLogicEvaluationService` safeguards
6. **Documentation**: Document all supported condition types

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
