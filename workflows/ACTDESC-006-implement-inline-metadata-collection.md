# ACTDESC-006: Implement Inline Metadata Collection

## Status
🟡 **Pending**

## Phase
**Phase 2: Core Service Implementation** (Week 1-2)

## Description
Implement the `#collectInlineMetadata()` and `#parseInlineMetadata()` private methods in ActivityDescriptionService to scan entity components for inline activity metadata and convert them into standardized activity objects.

## Background
Inline metadata allows simple components to include activity description data directly. This is the simpler of the two metadata approaches and will handle 80% of activity description use cases.

**Reference**: Design document lines 1426-1489 (Collect Inline Metadata)

## Objectives
- Implement component scanning for `activityMetadata` property
- Parse inline metadata into standardized activity objects
- Skip dedicated metadata components (avoid double-processing)
- Handle malformed metadata gracefully

## Technical Specification

### Methods to Implement

```javascript
/**
 * Collect inline metadata from components.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Inline metadata activities
 * @private
 */
#collectInlineMetadata(entity) {
  const activities = [];
  const componentIds = entity.getComponentIds?.() || [];

  for (const componentId of componentIds) {
    // Skip dedicated metadata components (already processed)
    if (componentId === 'activity:description_metadata') {
      continue;
    }

    const componentData = entity.getComponentData(componentId);
    const activityMetadata = componentData?.activityMetadata;

    if (activityMetadata?.shouldDescribeInActivity) {
      try {
        const activity = this.#parseInlineMetadata(
          componentId,
          componentData,
          activityMetadata
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
 * Parse inline metadata into activity object.
 *
 * @param {string} componentId - Component ID
 * @param {object} componentData - Full component data
 * @param {object} activityMetadata - Activity metadata from component
 * @returns {object|null} Activity object or null if invalid
 * @private
 */
#parseInlineMetadata(componentId, componentData, activityMetadata) {
  const { template, targetRole = 'entityId', priority = 50 } = activityMetadata;

  if (!template) {
    this.#logger.warn(`Inline metadata missing template for ${componentId}`);
    return null;
  }

  // Resolve target entity ID
  const targetEntityId = componentData[targetRole];

  return {
    type: 'inline',
    sourceComponent: componentId,
    sourceData: componentData,
    targetEntityId,
    priority,
    template,
  };
}
```

### Activity Object Structure
```javascript
{
  type: 'inline',
  sourceComponent: 'positioning:kneeling_before',
  sourceData: { entityId: 'alicia', /* ... */ },
  targetEntityId: 'alicia',
  priority: 75,
  template: '{actor} is kneeling before {target}'
}
```

## Acceptance Criteria
- [ ] Methods implemented in ActivityDescriptionService
- [ ] Scans all components on entity
- [ ] Skips `activity:description_metadata` components
- [ ] Correctly identifies components with `activityMetadata.shouldDescribeInActivity === true`
- [ ] Parses template, targetRole, and priority
- [ ] Returns standardized activity objects
- [ ] Handles missing template gracefully (logs warning, returns null)
- [ ] Handles malformed metadata without crashing
- [ ] Resolves targetEntityId from specified targetRole property

## Dependencies
- **Requires**: ACTDESC-005 (Service class structure)
- **Requires**: ACTDESC-002 (Inline metadata pattern defined)
- **Blocks**: ACTDESC-008 (Needs activity objects for formatting)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Inline Metadata', () => {
  it('should collect inline metadata from components', () => {
    const mockEntity = createMockEntity({
      id: 'jon',
      components: {
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is kneeling before {target}',
            targetRole: 'entityId',
            priority: 75,
          },
        },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('inline');
    expect(activities[0].template).toBe('{actor} is kneeling before {target}');
    expect(activities[0].priority).toBe(75);
  });

  it('should skip components without activityMetadata', () => {
    const mockEntity = createMockEntity({
      components: {
        'core:name': { text: 'Jon' },
        'anatomy:body': { /* body data */ },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
  });

  it('should skip dedicated metadata components', () => {
    const mockEntity = createMockEntity({
      components: {
        'activity:description_metadata': { /* metadata */ },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
  });

  it('should handle missing template gracefully', () => {
    const mockEntity = createMockEntity({
      components: {
        'bad:component': {
          activityMetadata: {
            shouldDescribeInActivity: true,
            // Missing template
          },
        },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should use default values for optional properties', () => {
    const mockEntity = createMockEntity({
      components: {
        'simple:activity': {
          targetId: 'someone',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} waves',
            // No targetRole (should default to 'entityId')
            // No priority (should default to 50)
          },
        },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities[0].priority).toBe(50);
    expect(activities[0].targetEntityId).toBeUndefined(); // 'entityId' property doesn't exist
  });

  it('should resolve targetEntityId from custom targetRole', () => {
    const mockEntity = createMockEntity({
      components: {
        'companionship:following': {
          leaderId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is following {target}',
            targetRole: 'leaderId',
            priority: 40,
          },
        },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities[0].targetEntityId).toBe('alicia');
  });
});
```

## Implementation Notes
1. Use optional chaining (`entity.getComponentIds?.()`) for safety
2. Always wrap parsing in try-catch to handle malformed data
3. Log warnings for invalid metadata but don't crash
4. Skip processing if `shouldDescribeInActivity` is false or missing
5. Default values: `targetRole='entityId'`, `priority=50`

## Reference Files
- Service file: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1426-1489)
- Test utilities: `tests/common/testBed.js`

## Success Metrics
- Correctly parses inline metadata from components
- Handles edge cases without crashing
- Returns standardized activity objects
- All tests pass with 100% coverage

## Related Tickets
- **Requires**: ACTDESC-002 (Inline pattern definition)
- **Requires**: ACTDESC-005 (Service class)
- **Blocks**: ACTDESC-008 (Phrase generation)
- **Related**: ACTDESC-007 (Dedicated metadata collection)
