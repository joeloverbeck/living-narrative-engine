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
  const componentIds = entity.componentTypeIds ?? [];

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

**Note**: All test examples below use the recommended approach of testing private methods through the public API. See "Testing Private Methods" in Implementation Notes for alternative approaches.

```javascript
describe('ActivityDescriptionService - Inline Metadata', () => {
  it('should collect inline metadata from components', () => {
    // Testing private #collectInlineMetadata through public generateActivityDescription()
    // Create mock entity with correct API (componentTypeIds getter + getComponentData method)
    const mockEntity = {
      id: 'jon',
      componentTypeIds: ['positioning:kneeling_before'],
      getComponentData: jest.fn((id) => {
        if (id === 'positioning:kneeling_before') {
          return {
            entityId: 'alicia',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is kneeling before {target}',
              targetRole: 'entityId',
              priority: 75,
            },
          };
        }
        return null;
      }),
    };

    // Test through public generateActivityDescription() which calls private #collectInlineMetadata
    const result = service.generateActivityDescription(mockEntity);

    // Verify inline metadata was collected and processed
    expect(result).toContain('kneeling before');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith('positioning:kneeling_before');
  });

  it('should skip components without activityMetadata', () => {
    const mockEntity = {
      id: 'jon',
      componentTypeIds: ['core:name', 'anatomy:body'],
      getComponentData: jest.fn((id) => {
        if (id === 'core:name') return { text: 'Jon' };
        if (id === 'anatomy:body') return { /* body data */ };
        return null;
      }),
    };

    const result = service.generateActivityDescription(mockEntity);

    // Should not include any activity descriptions from these components
    expect(mockEntity.getComponentData).toHaveBeenCalled();
  });

  it('should skip dedicated metadata components', () => {
    const mockEntity = {
      id: 'jon',
      componentTypeIds: ['activity:description_metadata'],
      getComponentData: jest.fn((id) => {
        if (id === 'activity:description_metadata') return { /* metadata */ };
        return null;
      }),
    };

    const result = service.generateActivityDescription(mockEntity);

    // Dedicated metadata components should be processed differently
    expect(mockEntity.getComponentData).not.toHaveBeenCalledWith('activity:description_metadata');
  });

  it('should handle missing template gracefully', () => {
    const mockLogger = testBed.createMockLogger();
    const service = new ActivityDescriptionService({ logger: mockLogger, /* ... */ });

    const mockEntity = {
      id: 'jon',
      componentTypeIds: ['bad:component'],
      getComponentData: jest.fn((id) => {
        if (id === 'bad:component') {
          return {
            activityMetadata: {
              shouldDescribeInActivity: true,
              // Missing template
            },
          };
        }
        return null;
      }),
    };

    const result = service.generateActivityDescription(mockEntity);

    // Should log warning about missing template
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing template')
    );
  });

  it('should use default values for optional properties', () => {
    const mockEntity = {
      id: 'jon',
      componentTypeIds: ['simple:activity'],
      getComponentData: jest.fn((id) => {
        if (id === 'simple:activity') {
          return {
            targetId: 'someone',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} waves',
              // No targetRole (should default to 'entityId')
              // No priority (should default to 50)
            },
          };
        }
        return null;
      }),
    };

    const result = service.generateActivityDescription(mockEntity);

    // Verify default priority (50) is used and template is processed
    expect(result).toContain('waves');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith('simple:activity');
  });

  it('should resolve targetEntityId from custom targetRole', () => {
    const mockEntity = {
      id: 'jon',
      componentTypeIds: ['companionship:following'],
      getComponentData: jest.fn((id) => {
        if (id === 'companionship:following') {
          return {
            leaderId: 'alicia',
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is following {target}',
              targetRole: 'leaderId',
              priority: 40,
            },
          };
        }
        return null;
      }),
    };

    const result = service.generateActivityDescription(mockEntity);

    // Verify custom targetRole (leaderId) is resolved correctly
    expect(result).toContain('following');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith('companionship:following');
  });
});
```

## Implementation Notes

### Code Implementation
1. Use nullish coalescing (`entity.componentTypeIds ?? []`) for safety (componentTypeIds is a getter property, not a method)
2. Always wrap parsing in try-catch to handle malformed data
3. Log warnings for invalid metadata but don't crash
4. Skip processing if `shouldDescribeInActivity` is false or missing
5. Default values: `targetRole='entityId'`, `priority=50`

### Testing Private Methods

**IMPORTANT**: JavaScript private fields (using `#` prefix) are truly private and **cannot be accessed** from outside the class, including tests. You have three options:

#### Option A: Test Through Public API (RECOMMENDED)
Test the private methods indirectly by calling the public `generateActivityDescription()` method:

```javascript
// ✅ CORRECT: Test through public API
const result = service.generateActivityDescription(mockEntity);
expect(result).toContain('expected text');
```

**Advantages**:
- Tests actual behavior users will experience
- Maintains encapsulation and class contract
- More maintainable (internal refactoring doesn't break tests)

#### Option B: Use Protected Methods (Testable)
Change from `#` private to `_` prefix convention for "protected" methods:

```javascript
// Change implementation from:
#collectInlineMetadata(entity) { ... }

// To:
_collectInlineMetadata(entity) { ... }  // Convention: protected, testable
```

**Advantages**:
- Direct testing of individual methods
- Easier to test edge cases in isolation

**Disadvantages**:
- Violates true encapsulation (can be accessed externally)
- Requires code change from design specification

#### Option C: Add Test-Only Helper
Create a test helper method that exposes private functionality:

```javascript
// In activityDescriptionService.js
#collectInlineMetadata(entity) { ... }  // Keep private

// Only in test builds
_testHelpers = {
  collectInlineMetadata: (entity) => this.#collectInlineMetadata(entity)
};
```

**Use in tests**:
```javascript
const activities = service._testHelpers.collectInlineMetadata(mockEntity);
```

**Disadvantages**:
- Adds test-specific code to production
- Test helpers can become outdated

### Recommendation
For this workflow, **use Option A** (test through public API) unless you have a specific reason to test private methods directly. This approach aligns with testing best practices and maintains clean encapsulation.

## Reference Files
- Service file: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1426-1489)
- Test utilities: `tests/common/testBed.js`
- Entity API reference: `src/entities/entity.js` (lines 148-161 for `componentTypeIds` getter)
- Mock factories: `tests/common/mockFactories/entities.js` (for test entity creation patterns)

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
