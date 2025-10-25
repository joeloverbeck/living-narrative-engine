# ACTDESC-007: Implement Dedicated Metadata Collection

## Status
🟡 **Pending**

## Phase
**Phase 2: Core Service Implementation** (Week 1-2)

## Description
Implement the `#collectDedicatedMetadata()` and `#parseDedicatedMetadata()` private methods to find and process `activity:description_metadata` components into standardized activity objects.

## Background
Dedicated metadata components provide more flexibility for complex scenarios requiring conditional visibility, multiple description modes, or rich metadata features.

**Reference**: Design document lines 1352-1417 (Collect Dedicated Metadata)

## Objectives
- Find all `activity:description_metadata` components on entity
- Parse dedicated metadata into standardized activity objects
- Link metadata to source components
- Support conditional logic and rich properties

## Technical Specification

### Methods to Implement

```javascript
/**
 * Collect dedicated metadata components.
 *
 * @param {object} entity - Entity instance
 * @returns {Array<object>} Dedicated metadata activities
 * @private
 */
#collectDedicatedMetadata(entity) {
  const activities = [];

  // Check if entity has dedicated metadata component type
  if (!entity.hasComponent('activity:description_metadata')) {
    return activities;
  }

  // Get all metadata components (there could be multiple)
  const metadataComponents = entity.getAllComponentsOfType?.('activity:description_metadata') || [];

  for (const metadata of metadataComponents) {
    try {
      const activity = this.#parseDedicatedMetadata(metadata, entity);
      if (activity) {
        activities.push(activity);
      }
    } catch (error) {
      this.#logger.error(`Failed to parse dedicated metadata`, error);
    }
  }

  return activities;
}

/**
 * Parse dedicated metadata component into activity object.
 *
 * @param {object} metadata - Metadata component data
 * @param {object} entity - Entity instance
 * @returns {object|null} Activity object or null if invalid
 * @private
 */
#parseDedicatedMetadata(metadata, entity) {
  const { sourceComponent, descriptionType, targetRole, priority = 50 } = metadata;

  if (!sourceComponent) {
    this.#logger.warn('Dedicated metadata missing sourceComponent');
    return null;
  }

  // Get source component data
  const sourceData = entity.getComponentData(sourceComponent);
  if (!sourceData) {
    this.#logger.warn(`Source component not found: ${sourceComponent}`);
    return null;
  }

  // Resolve target entity ID
  const targetEntityId = sourceData[targetRole || 'entityId'];

  return {
    type: 'dedicated',
    sourceComponent,
    descriptionType,
    metadata,
    sourceData,
    targetEntityId,
    priority,
    verb: metadata.verb,
    template: metadata.template,
    adverb: metadata.adverb,
    conditions: metadata.conditions,
    grouping: metadata.grouping,
  };
}
```

### Activity Object Structure (Dedicated)
```javascript
{
  type: 'dedicated',
  sourceComponent: 'kissing:kissing',
  descriptionType: 'verb',
  metadata: { /* full metadata object */ },
  sourceData: { partner: 'alicia', initiator: true },
  targetEntityId: 'alicia',
  priority: 90,
  verb: 'kissing',
  template: null,
  adverb: 'passionately',
  conditions: {
    showOnlyIfProperty: { property: 'initiator', equals: true }
  },
  grouping: { groupKey: 'intimate_contact', combineWith: ['hugging'] }
}
```

## Acceptance Criteria
- [ ] Methods implemented in ActivityDescriptionService
- [ ] Checks for `activity:description_metadata` component presence
- [ ] Retrieves all metadata components (supports multiple per entity)
- [ ] Validates `sourceComponent` field exists
- [ ] Retrieves source component data and validates it exists
- [ ] Resolves targetEntityId from source component using targetRole
- [ ] Includes all metadata properties in activity object
- [ ] Handles missing source component gracefully (logs warning, returns null)
- [ ] Handles malformed metadata without crashing
- [ ] Returns null for invalid metadata

## Dependencies
- **Requires**: ACTDESC-005 (Service class structure)
- **Requires**: ACTDESC-001 (Metadata schema)
- **Blocks**: ACTDESC-008 (Needs activity objects for formatting)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Dedicated Metadata', () => {
  it('should collect dedicated metadata components', () => {
    const mockEntity = createMockEntity({
      id: 'jon',
      components: {
        'kissing:kissing': {
          partner: 'alicia',
          initiator: true,
        },
        'activity:description_metadata': {
          sourceComponent: 'kissing:kissing',
          descriptionType: 'verb',
          verb: 'kissing',
          targetRole: 'partner',
          priority: 90,
        },
      },
    });

    const activities = service['#collectDedicatedMetadata'](mockEntity);

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('dedicated');
    expect(activities[0].verb).toBe('kissing');
    expect(activities[0].targetEntityId).toBe('alicia');
  });

  it('should return empty array if no metadata components', () => {
    const mockEntity = createMockEntity({
      components: {
        'positioning:kneeling_before': { entityId: 'alicia' },
      },
    });
    mockEntity.hasComponent.mockReturnValue(false);

    const activities = service['#collectDedicatedMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
  });

  it('should handle multiple metadata components', () => {
    const mockEntity = createMockEntity({
      components: {
        'kissing:kissing': { partner: 'alicia' },
        'positioning:hugging': { embraced_entity_id: 'alicia' },
      },
    });
    mockEntity.hasComponent.mockReturnValue(true);
    mockEntity.getAllComponentsOfType.mockReturnValue([
      {
        sourceComponent: 'kissing:kissing',
        descriptionType: 'verb',
        verb: 'kissing',
        targetRole: 'partner',
        priority: 90,
      },
      {
        sourceComponent: 'positioning:hugging',
        descriptionType: 'verb',
        verb: 'hugging',
        targetRole: 'embraced_entity_id',
        priority: 85,
      },
    ]);

    const activities = service['#collectDedicatedMetadata'](mockEntity);
    expect(activities).toHaveLength(2);
  });

  it('should handle missing sourceComponent gracefully', () => {
    const mockEntity = createMockEntity({});
    mockEntity.hasComponent.mockReturnValue(true);
    mockEntity.getAllComponentsOfType.mockReturnValue([
      {
        // Missing sourceComponent
        descriptionType: 'verb',
        verb: 'doing something',
      },
    ]);

    const activities = service['#collectDedicatedMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing sourceComponent')
    );
  });

  it('should handle missing source component data', () => {
    const mockEntity = createMockEntity({});
    mockEntity.hasComponent.mockReturnValue(true);
    mockEntity.getAllComponentsOfType.mockReturnValue([
      {
        sourceComponent: 'nonexistent:component',
        descriptionType: 'verb',
        verb: 'doing',
      },
    ]);
    mockEntity.getComponentData.mockReturnValue(null);

    const activities = service['#collectDedicatedMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Source component not found')
    );
  });

  it('should include all metadata properties in activity object', () => {
    const mockEntity = createMockEntity({
      components: {
        'positioning:hugging': {
          embraced_entity_id: 'alicia',
          initiated: true,
        },
        'activity:description_metadata': {
          sourceComponent: 'positioning:hugging',
          descriptionType: 'verb',
          verb: 'hugging',
          adverb: 'tightly',
          targetRole: 'embraced_entity_id',
          priority: 85,
          conditions: { requiredComponents: ['positioning:standing'] },
          grouping: { groupKey: 'physical_contact' },
        },
      },
    });

    const activities = service['#collectDedicatedMetadata'](mockEntity);
    const activity = activities[0];

    expect(activity.adverb).toBe('tightly');
    expect(activity.conditions).toEqual({
      requiredComponents: ['positioning:standing'],
    });
    expect(activity.grouping).toEqual({ groupKey: 'physical_contact' });
  });
});
```

## Implementation Notes
1. Use `entity.hasComponent()` for quick check before expensive operations
2. Handle case where `getAllComponentsOfType` doesn't exist (fallback to empty array)
3. Always validate `sourceComponent` exists in metadata
4. Validate source component data exists on entity
5. Include all metadata properties for future features (conditions, grouping, etc.)
6. Default `priority` to 50 if not specified

## Reference Files
- Service file: `src/anatomy/services/activityDescriptionService.js`
- Schema file: `data/schemas/components/activity/description_metadata.component.json` (ACTDESC-001)
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1352-1417)

## Success Metrics
- Correctly parses dedicated metadata components
- Links metadata to source components
- Handles edge cases without crashing
- All tests pass with 100% coverage

## Related Tickets
- **Requires**: ACTDESC-001 (Metadata schema)
- **Requires**: ACTDESC-005 (Service class)
- **Blocks**: ACTDESC-008 (Phrase generation)
- **Blocks**: ACTDESC-018 (Conditional visibility needs metadata structure)
- **Related**: ACTDESC-006 (Inline metadata collection)
