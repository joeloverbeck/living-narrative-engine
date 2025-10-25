# ACTDESC-013: Create Integration Test Suite

## Status
🟡 **Pending**

## Phase
**Phase 4: Testing** (Week 2)

## Description
Create integration test suite that validates the complete activity description system working with real components, the description pipeline, and actual entity data.

## Background
Integration tests ensure all pieces work together correctly in realistic scenarios, validating the complete description generation flow from component metadata to formatted output.

**Reference**: Design document lines 2025-2180 (Integration Tests)

## Objectives
- Test complete description generation workflow
- Validate real component integration
- Test pipeline integration with BodyDescriptionComposer
- Verify configuration effects
- Test realistic multi-activity scenarios
- Ensure cross-component interactions work

## Technical Specification

### Test File Organization
```
tests/integration/anatomy/
├── activityDescriptionIntegration.test.js          # Main integration tests
├── activityDescriptionPipeline.test.js             # Pipeline integration
├── activityDescriptionRealComponents.test.js       # Real mod components
└── activityDescriptionConfiguration.test.js        # Config integration
```

### Core Integration Tests

#### Complete Workflow Test
```javascript
describe('Activity Description System - Complete Workflow', () => {
  let container;
  let entityManager;
  let activityDescriptionService;

  beforeEach(() => {
    container = createTestContainer();
    entityManager = container.resolve('IEntityManager');
    activityDescriptionService = container.resolve('IActivityDescriptionService');
  });

  it('should generate activity description from inline metadata', async () => {
    // Create entity with inline metadata
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        targetRole: 'entityId',
        priority: 75,
      },
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    // Generate description
    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toBe('Activity: Jon Ureña is kneeling before Alicia Western');
  });

  it('should generate activity description from dedicated metadata', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'kissing:kissing', {
      partner: 'alicia',
      initiator: true,
    });
    entityManager.addComponent(jonEntity.id, 'activity:description_metadata', {
      sourceComponent: 'kissing:kissing',
      descriptionType: 'verb',
      verb: 'kissing',
      adverb: 'passionately',
      targetRole: 'partner',
      priority: 90,
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain('kissing');
    expect(description).toContain('Alicia Western');
    expect(description).toContain('passionately');
  });

  it('should combine multiple activities with correct priority', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Lower priority activity
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        priority: 75,
      },
    });

    // Higher priority activity
    entityManager.addComponent(jonEntity.id, 'intimacy:holding_hands', {
      partner: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is holding hands with {target}',
        targetRole: 'partner',
        priority: 85,
      },
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    // Higher priority should appear first
    const holdingIndex = description.indexOf('holding hands');
    const kneelingIndex = description.indexOf('kneeling');
    expect(holdingIndex).toBeLessThan(kneelingIndex);
  });
});
```

#### Pipeline Integration Tests
```javascript
describe('Activity Description - Pipeline Integration', () => {
  let container;
  let bodyDescriptionOrchestrator;
  let entityManager;

  beforeEach(() => {
    container = createTestContainer();
    bodyDescriptionOrchestrator = container.resolve('BodyDescriptionOrchestrator');
    entityManager = container.resolve('IEntityManager');
  });

  it('should include activity section in body description', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'anatomy:body', {
      /* body data */
    });
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        priority: 75,
      },
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    const { bodyDescription } = await bodyDescriptionOrchestrator.generateAllDescriptions(
      jonEntity
    );

    expect(bodyDescription).toContain('Activity:');
    expect(bodyDescription).toContain('kneeling before');
  });

  it('should place activity section in correct order', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'anatomy:body', {
      height: { value: 180, unit: 'cm' },
    });
    entityManager.addComponent(jonEntity.id, 'items:wearing', {
      itemIds: ['shirt_001'],
    });
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
      },
    });

    const { bodyDescription } = await bodyDescriptionOrchestrator.generateAllDescriptions(
      jonEntity
    );

    // Activity should appear after equipment
    const equipmentIndex = bodyDescription.indexOf('Equipment:');
    const activityIndex = bodyDescription.indexOf('Activity:');

    if (equipmentIndex >= 0 && activityIndex >= 0) {
      expect(activityIndex).toBeGreaterThan(equipmentIndex);
    }
  });

  it('should not add activity section if no activities', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'anatomy:body', {
      height: { value: 180, unit: 'cm' },
    });

    const { bodyDescription } = await bodyDescriptionOrchestrator.generateAllDescriptions(
      jonEntity
    );

    expect(bodyDescription).not.toContain('Activity:');
  });
});
```

#### Real Component Tests
```javascript
describe('Activity Description - Real Mod Components', () => {
  let container;
  let activityDescriptionService;
  let entityManager;

  beforeEach(async () => {
    // Load real mods and schemas
    container = await createRealModContainer(['core', 'positioning', 'intimacy']);
    activityDescriptionService = container.resolve('IActivityDescriptionService');
    entityManager = container.resolve('IEntityManager');
  });

  it('should work with real positioning:kneeling_before component', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Use real component schema
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        targetRole: 'entityId',
        priority: 75,
      },
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain('kneeling before');
    expect(description).toContain('Alicia Western');
  });

  it('should work with real intimacy:kissing component', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Use real component schema with dedicated metadata
    entityManager.addComponent(jonEntity.id, 'intimacy:kissing', {
      partner: 'alicia',
      initiator: true,
    });
    entityManager.addComponent(jonEntity.id, 'activity:description_metadata', {
      sourceComponent: 'intimacy:kissing',
      descriptionType: 'verb',
      verb: 'kissing',
      targetRole: 'partner',
      priority: 90,
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain('kissing');
    expect(description).toContain('Alicia Western');
  });

  it('should handle multiple real components together', async () => {
    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        priority: 75,
      },
    });

    entityManager.addComponent(jonEntity.id, 'intimacy:holding_hands', {
      partner: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is holding hands with {target}',
        targetRole: 'partner',
        priority: 85,
      },
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western'
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain('holding hands');
    expect(description).toContain('kneeling before');
  });
});
```

#### Configuration Integration Tests
```javascript
describe('Activity Description - Configuration Integration', () => {
  let container;
  let activityDescriptionService;
  let anatomyFormattingService;
  let entityManager;

  beforeEach(() => {
    container = createTestContainer();
    activityDescriptionService = container.resolve('IActivityDescriptionService');
    anatomyFormattingService = container.resolve('IAnatomyFormattingService');
    entityManager = container.resolve('IEntityManager');
  });

  it('should respect custom prefix configuration', async () => {
    anatomyFormattingService.setActivityIntegrationConfig({
      prefix: '>>> ',
      suffix: '',
      separator: '. ',
    });

    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling',
      },
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toMatch(/^>>> /);
  });

  it('should respect custom separator configuration', async () => {
    anatomyFormattingService.setActivityIntegrationConfig({
      prefix: '',
      suffix: '',
      separator: ' | ',
    });

    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon' });
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: 'kneeling',
        priority: 1,
      },
    });
    entityManager.addComponent(jonEntity.id, 'intimacy:holding_hands', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: 'holding hands',
        priority: 2,
      },
    });

    const description = await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain(' | ');
  });

  it('should respect maxActivities limit', async () => {
    anatomyFormattingService.setActivityIntegrationConfig({
      maxActivities: 2,
    });

    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon' });

    // Add 5 activities
    for (let i = 0; i < 5; i++) {
      entityManager.addComponent(jonEntity.id, `activity_${i}`, {
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: `activity ${i}`,
          priority: i,
        },
      });
    }

    const description = await activityDescriptionService.generateActivityDescription('jon');

    // Count activities (split by separator and filter non-empty)
    const activities = description.split('.').filter(s => s.trim());
    expect(activities.length).toBeLessThanOrEqual(3); // Prefix + 2 activities
  });
});
```

#### Cross-Feature Integration Tests
```javascript
describe('Activity Description - Cross-Feature Integration', () => {
  it('should work alongside equipment descriptions', async () => {
    const container = createTestContainer();
    const orchestrator = container.resolve('BodyDescriptionOrchestrator');
    const entityManager = container.resolve('IEntityManager');

    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon' });
    entityManager.addComponent(jonEntity.id, 'anatomy:body', {});

    // Equipment
    entityManager.addComponent(jonEntity.id, 'items:wearing', {
      itemIds: ['shirt_001'],
    });

    // Activity
    entityManager.addComponent(jonEntity.id, 'positioning:standing', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is standing',
      },
    });

    const { bodyDescription } = await orchestrator.generateAllDescriptions(jonEntity);

    expect(bodyDescription).toContain('Equipment:');
    expect(bodyDescription).toContain('Activity:');
  });

  it('should handle entity names with special characters', async () => {
    const container = createTestContainer();
    const service = container.resolve('IActivityDescriptionService');
    const entityManager = container.resolve('IEntityManager');

    const jonEntity = entityManager.createEntity('jon');
    entityManager.addComponent(jonEntity.id, 'core:name', {
      text: "Jon \"Red\" Ureña"
    });
    entityManager.addComponent(jonEntity.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
      },
    });

    const aliciaEntity = entityManager.createEntity('alicia');
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: "Alicia \"Blue\" Western"
    });

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('Jon "Red" Ureña');
    expect(description).toContain('Alicia "Blue" Western');
  });
});
```

## Acceptance Criteria
- [ ] Complete workflow tests passing
- [ ] Pipeline integration validated
- [ ] Real component integration confirmed
- [ ] Configuration effects verified
- [ ] Multi-activity scenarios tested
- [ ] Cross-feature integration works
- [ ] Edge cases covered
- [ ] All tests pass consistently
- [ ] Tests complete in <10 seconds

## Dependencies
- **Requires**: ACTDESC-010, ACTDESC-011 (Integration complete)
- **Requires**: ACTDESC-012 (Unit tests complete)
- **Blocks**: Phase 5+ features (need stable foundation)

## Testing Requirements

### Test Environment Setup
```javascript
// tests/common/integrationTestContainer.js
export async function createRealModContainer(mods = ['core', 'positioning']) {
  const container = new DependencyContainer();

  // Load real schemas
  const schemaLoader = new SchemaLoader();
  await schemaLoader.loadSchemas();

  // Load real mods
  const modLoader = new ModLoader({ schemaLoader });
  await modLoader.loadMods(mods);

  // Register all services
  registerAllServices(container);

  return container;
}
```

### Performance Targets
```yaml
execution_time:
  complete_workflow: < 100ms
  pipeline_integration: < 200ms
  real_components: < 500ms
  configuration: < 50ms

total_suite_time: < 10 seconds
```

## Implementation Notes
1. **Real Components**: Use actual mod data for realistic testing
2. **Container Setup**: Full DI container with real services
3. **Cleanup**: Properly clean up entities between tests
4. **Isolation**: Each test should be independent
5. **Assertions**: Verify both structure and content

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Composer: `src/anatomy/bodyDescriptionComposer.js`
- Test helpers: `tests/common/integrationTestContainer.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2025-2180)

## Success Metrics
- All integration tests pass
- <10 second total execution time
- Real mod integration confirmed
- Pipeline integration validated
- Cross-feature compatibility verified

## Related Tickets
- **Requires**: ACTDESC-010, ACTDESC-011, ACTDESC-012
- **Validates**: Complete Phase 1-3 implementation
- **Enables**: Phase 5+ feature development
