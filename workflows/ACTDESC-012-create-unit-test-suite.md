# ACTDESC-012: Create Comprehensive Unit Test Suite

## Status
🟡 **Pending**

## Phase
**Phase 4: Testing** (Week 2)

## Description
Create comprehensive unit test suite for ActivityDescriptionService covering all methods, edge cases, and failure scenarios.

## Background
Unit tests ensure the service behaves correctly in isolation, validates inputs properly, and handles edge cases gracefully.

**Reference**: Design document lines 1913-2024 (Testing Strategy, Unit Tests)

## Objectives
- Test all public and private methods
- Cover success paths and error conditions
- Validate edge cases and boundary conditions
- Ensure proper error handling and logging
- Achieve ≥90% code coverage

## Technical Specification

### Test File Organization
```
tests/unit/anatomy/services/
├── activityDescriptionService.test.js              # Main test suite
├── activityDescriptionService.metadata.test.js     # Metadata collection tests
├── activityDescriptionService.formatting.test.js   # Phrase generation tests
└── activityDescriptionService.resolution.test.js   # Name resolution tests
```

### Core Test Suites

#### Service Initialization
```javascript
describe('ActivityDescriptionService - Initialization', () => {
  it('should initialize with required dependencies', () => {
    const service = new ActivityDescriptionService({
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      logger: mockLogger,
    });

    expect(service).toBeDefined();
  });

  it('should validate entityManager dependency', () => {
    expect(() => {
      new ActivityDescriptionService({
        entityManager: null,
        anatomyFormattingService: mockFormattingService,
      });
    }).toThrow(/IEntityManager/);
  });

  it('should validate anatomyFormattingService dependency', () => {
    expect(() => {
      new ActivityDescriptionService({
        entityManager: mockEntityManager,
        anatomyFormattingService: null,
      });
    }).toThrow(/IAnatomyFormattingService/);
  });

  it('should use default logger if not provided', () => {
    const service = new ActivityDescriptionService({
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      logger: null,
    });

    expect(service).toBeDefined(); // Should not throw
  });

  it('should initialize private caches', () => {
    const service = new ActivityDescriptionService({
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
    });

    // Verify caches are empty on initialization
    const description = await service.generateActivityDescription('entity_id');
    expect(description).toBeDefined();
  });
});
```

#### Main Method Tests
```javascript
describe('ActivityDescriptionService - generateActivityDescription', () => {
  it('should return empty string for entity without activities', async () => {
    const mockEntity = createMockEntity({ components: {} });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const result = await service.generateActivityDescription('jon');
    expect(result).toBe('');
  });

  it('should generate description for entity with inline metadata', async () => {
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

    mockEntityManager.getEntityInstance.mockImplementation(id => {
      if (id === 'jon') return mockEntity;
      if (id === 'alicia') return createMockEntity({ name: 'Alicia Western' });
    });

    const result = await service.generateActivityDescription('jon');
    expect(result).toContain('Jon Ureña is kneeling before Alicia Western');
  });

  it('should handle entity not found gracefully', async () => {
    mockEntityManager.getEntityInstance.mockReturnValue(null);

    const result = await service.generateActivityDescription('unknown_entity');
    expect(result).toBe('');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Entity not found')
    );
  });

  it('should combine multiple activities with separator', async () => {
    const mockEntity = createMockEntity({
      components: {
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is kneeling before {target}',
            priority: 75,
          },
        },
        'intimacy:holding_hands': {
          partner: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is holding hands with {target}',
            targetRole: 'partner',
            priority: 80,
          },
        },
      },
    });

    const result = await service.generateActivityDescription('jon');
    expect(result).toMatch(/holding hands.*kneeling before/); // Higher priority first
  });
});
```

#### Metadata Collection Tests
```javascript
describe('ActivityDescriptionService - Metadata Collection', () => {
  it('should collect inline metadata from components', () => {
    const mockEntity = createMockEntity({
      components: {
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: { shouldDescribeInActivity: true },
        },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities).toHaveLength(1);
    expect(activities[0].sourceComponent).toBe('positioning:kneeling_before');
  });

  it('should skip components without activityMetadata', () => {
    const mockEntity = createMockEntity({
      components: {
        'positioning:kneeling_before': { entityId: 'alicia' }, // No metadata
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
  });

  it('should skip components with shouldDescribeInActivity=false', () => {
    const mockEntity = createMockEntity({
      components: {
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: { shouldDescribeInActivity: false },
        },
      },
    });

    const activities = service['#collectInlineMetadata'](mockEntity);
    expect(activities).toHaveLength(0);
  });

  it('should collect dedicated metadata components', () => {
    const mockEntity = createMockEntity({
      components: {
        'kissing:kissing': { partner: 'alicia' },
        'activity:description_metadata': {
          sourceComponent: 'kissing:kissing',
          verb: 'kissing',
          targetRole: 'partner',
          priority: 90,
        },
      },
    });

    mockEntity.hasComponent.mockReturnValue(true);
    mockEntity.getAllComponentsOfType.mockReturnValue([
      {
        sourceComponent: 'kissing:kissing',
        verb: 'kissing',
        targetRole: 'partner',
        priority: 90,
      },
    ]);

    const activities = service['#collectDedicatedMetadata'](mockEntity);
    expect(activities).toHaveLength(1);
    expect(activities[0].verb).toBe('kissing');
  });
});
```

#### Phrase Generation Tests
```javascript
describe('ActivityDescriptionService - Phrase Generation', () => {
  it('should generate phrase from inline template', () => {
    const activity = {
      type: 'inline',
      template: '{actor} is kneeling before {target}',
      targetEntityId: 'alicia',
    };

    mockEntityManager.getEntityInstance.mockReturnValue(
      createMockEntity({ name: 'Alicia Western' })
    );

    const phrase = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(phrase).toBe('Jon Ureña is kneeling before Alicia Western');
  });

  it('should generate phrase from dedicated verb', () => {
    const activity = {
      type: 'dedicated',
      verb: 'kissing',
      targetEntityId: 'alicia',
    };

    const phrase = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(phrase).toBe('Jon Ureña is kissing Alicia Western');
  });

  it('should include adverb in dedicated activity', () => {
    const activity = {
      type: 'dedicated',
      verb: 'hugging',
      adverb: 'tightly',
      targetEntityId: 'alicia',
    };

    const phrase = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(phrase).toBe('Jon Ureña is hugging Alicia Western tightly');
  });

  it('should handle activity without target', () => {
    const activity = {
      type: 'dedicated',
      verb: 'meditating',
    };

    const phrase = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(phrase).toBe('Jon Ureña is meditating');
  });

  it('should use default verb if missing', () => {
    const activity = {
      type: 'dedicated',
      targetEntityId: 'alicia',
    };

    const phrase = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(phrase).toContain('interacting with');
  });
});
```

#### Name Resolution Tests
```javascript
describe('ActivityDescriptionService - Name Resolution', () => {
  it('should resolve entity name from core:name component', () => {
    const mockEntity = createMockEntity({
      components: { 'core:name': { text: 'Jon Ureña' } },
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const name = service['#resolveEntityName']('jon');
    expect(name).toBe('Jon Ureña');
  });

  it('should cache resolved names', () => {
    const mockEntity = createMockEntity({
      components: { 'core:name': { text: 'Jon Ureña' } },
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    service['#resolveEntityName']('jon'); // First call
    service['#resolveEntityName']('jon'); // Second call (cached)

    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
  });

  it('should fallback to entityId if entity not found', () => {
    mockEntityManager.getEntityInstance.mockReturnValue(null);

    const name = service['#resolveEntityName']('unknown_entity');
    expect(name).toBe('unknown_entity');
  });

  it('should fallback to entityId if name component missing', () => {
    const mockEntity = createMockEntity({ components: {} });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const name = service['#resolveEntityName']('jon');
    expect(name).toBe('jon');
  });

  it('should fallback to entityId if name.text is empty', () => {
    const mockEntity = createMockEntity({
      components: { 'core:name': { text: '' } },
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const name = service['#resolveEntityName']('jon');
    expect(name).toBe('jon');
  });
});
```

#### Priority Sorting Tests
```javascript
describe('ActivityDescriptionService - Priority Sorting', () => {
  it('should sort activities by priority descending', () => {
    const activities = [
      { priority: 50, template: 'low' },
      { priority: 90, template: 'high' },
      { priority: 70, template: 'medium' },
    ];

    const sorted = service['#sortActivitiesByPriority'](activities);
    expect(sorted[0].priority).toBe(90);
    expect(sorted[1].priority).toBe(70);
    expect(sorted[2].priority).toBe(50);
  });

  it('should default missing priority to 50', () => {
    const activities = [
      { template: 'no priority' },
      { priority: 60, template: 'has priority' },
    ];

    const sorted = service['#sortActivitiesByPriority'](activities);
    expect(sorted[0].priority).toBe(60);
  });
});
```

#### Configuration Tests
```javascript
describe('ActivityDescriptionService - Configuration', () => {
  it('should use config prefix and suffix', () => {
    mockFormattingService.getActivityIntegrationConfig.mockReturnValue({
      prefix: '>>> ',
      suffix: ' <<<',
      separator: ' | ',
    });

    const activities = [{ type: 'inline', template: '{actor} waves' }];
    const result = service['#formatActivityDescription'](activities, mockEntity);

    expect(result).toMatch(/^>>> .*<<</);
  });

  it('should respect maxActivities limit', () => {
    mockFormattingService.getActivityIntegrationConfig.mockReturnValue({
      maxActivities: 2,
    });

    // Create 5 activities
    const activities = Array(5).fill(null).map((_, i) => ({
      type: 'inline',
      template: `activity ${i}`,
      priority: i,
    }));

    const result = service['#formatActivityDescription'](activities, mockEntity);

    // Should only include top 2
    expect(result.split('.').length).toBeLessThanOrEqual(2);
  });
});
```

## Acceptance Criteria
- [ ] All public methods have test coverage
- [ ] All private methods tested through public API
- [ ] Edge cases covered (null, undefined, empty, invalid)
- [ ] Error conditions tested and verified
- [ ] Cache behavior validated
- [ ] Priority sorting verified
- [ ] Configuration respect confirmed
- [ ] ≥90% code coverage achieved
- [ ] All tests pass consistently
- [ ] Tests follow project conventions

## Dependencies
- **Requires**: ACTDESC-005 through ACTDESC-009 (Service implementation)
- **Blocks**: ACTDESC-013 (Integration tests need unit tests complete)

## Testing Requirements

### Test Utilities Needed
```javascript
// tests/common/activityDescriptionTestHelpers.js
export function createMockEntity({ id = 'test_entity', components = {}, name = '' }) {
  const mockEntity = {
    id,
    getComponentData: jest.fn((componentId) => components[componentId]),
    hasComponent: jest.fn((componentType) => {
      return Object.keys(components).some(key => key.startsWith(componentType));
    }),
    getAllComponentsOfType: jest.fn(() => []),
  };

  // Setup name component if provided
  if (name) {
    components['core:name'] = { text: name };
  }

  return mockEntity;
}

export function createMockFormattingService() {
  return {
    getActivityIntegrationConfig: jest.fn(() => ({
      prefix: 'Activity: ',
      suffix: '',
      separator: '. ',
      maxActivities: 10,
    })),
  };
}

export function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn(),
  };
}
```

### Coverage Requirements
```yaml
targets:
  branches: 90%
  functions: 95%
  lines: 90%
  statements: 90%

focus_areas:
  - Metadata collection logic
  - Template replacement
  - Name resolution caching
  - Priority sorting
  - Configuration handling
  - Error scenarios
```

## Implementation Notes
1. **Test Organization**: Group related tests in describe blocks
2. **Mock Strategy**: Use test helpers for consistent mock creation
3. **Coverage Gaps**: Identify and test all code paths
4. **Private Method Testing**: Test through public API where possible
5. **Error Validation**: Verify error messages and logging calls
6. **Cache Testing**: Verify cache hits and misses with spy counts

## Reference Files
- Service file: `src/anatomy/services/activityDescriptionService.js`
- Test utilities: `tests/common/activityDescriptionTestHelpers.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1913-2024)

## Success Metrics
- All tests pass with ≥90% coverage
- No flaky or intermittent failures
- Tests complete in <5 seconds
- Clear test failure messages
- Comprehensive edge case coverage

## Related Tickets
- **Requires**: ACTDESC-005 to ACTDESC-009 (Service implementation)
- **Blocks**: ACTDESC-013 (Integration tests)
- **Validates**: All Phase 2 Core Service tickets
