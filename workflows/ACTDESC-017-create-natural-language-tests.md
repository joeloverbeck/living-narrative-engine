# ACTDESC-017: Create Natural Language Enhancement Tests

## Status
🟡 **Pending**

## Phase
**Phase 5: Natural Language Enhancements** (Week 3)

## Description
Create comprehensive test suite validating pronoun resolution, smart grouping, and context-aware composition working together to produce natural, fluent activity descriptions.

## Background
Phase 5 features (pronouns, grouping, context) must work together seamlessly. These integration tests verify the complete natural language enhancement pipeline.

**Reference**: Design document lines 2181-2291 (Natural Language Testing Strategy)

## Technical Specification

### Test File Organization
```
tests/integration/anatomy/
├── activityNaturalLanguage.test.js           # Main NL tests
├── activityPronounIntegration.test.js        # Pronoun scenarios
├── activityGroupingIntegration.test.js       # Grouping scenarios
└── activityContextAwareness.test.js          # Context scenarios
```

### Core Natural Language Tests

```javascript
describe('Activity Description - Natural Language Integration', () => {
  it('should produce natural description with all enhancements', async () => {
    const container = createTestContainer();
    const service = container.resolve('IActivityDescriptionService');
    const entityManager = container.resolve('IEntityManager');

    // Create entities with relationships
    const jon = entityManager.createEntity('jon');
    entityManager.addComponent(jon.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jon.id, 'character:gender', { value: 'male' });

    const alicia = entityManager.createEntity('alicia');
    entityManager.addComponent(alicia.id, 'core:name', { text: 'Alicia Western' });
    entityManager.addComponent(alicia.id, 'character:gender', { value: 'female' });

    // Add partner relationship
    entityManager.addComponent(jon.id, 'relationships:partner', {
      entityId: 'alicia',
      intimacyLevel: 90,
    });

    // Add multiple activities with same target
    entityManager.addComponent(jon.id, 'positioning:kneeling_before', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        priority: 75,
      },
    });

    entityManager.addComponent(jon.id, 'intimacy:holding_hands', {
      partner: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is holding hands with {target}',
        targetRole: 'partner',
        priority: 85,
      },
    });

    entityManager.addComponent(jon.id, 'intimacy:gazing', {
      target: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is gazing at {target}',
        targetRole: 'target',
        priority: 87,
      },
    });

    const description = await service.generateActivityDescription('jon');

    // Should use pronouns, grouping, and context awareness
    // Expected: "Activity: Jon is gazing lovingly at Alicia, holding her hands tenderly and kneeling before her"
    expect(description).toContain('Jon'); // Actor name in first phrase
    expect(description).toMatch(/her|she/i); // Pronouns for target
    expect(description).toMatch(/and|while/); // Grouped with conjunctions
    expect(description).toMatch(/lovingly|tenderly/); // Context-aware language
    expect(description.split('.').length).toBe(1); // Single sentence (no periods)
  });

  it('should handle multiple targets with pronouns', async () => {
    const jon = createEntity('jon', 'male');
    const alicia = createEntity('alicia', 'female');
    const bobby = createEntity('bobby', 'male');

    addActivity(jon, '{actor} is embracing {target}', 'alicia', 90);
    addActivity(jon, '{actor} is waving at {target}', 'bobby', 70);

    const description = await service.generateActivityDescription('jon');

    // Should have two groups: one for Alicia, one for Bobby
    // Expected: "Jon is embracing Alicia. He is waving at Bobby"
    expect(description).toContain('Jon'); // First actor reference
    expect(description).toMatch(/\bhe\b/i); // Pronoun for second group
    expect(description).toMatch(/her|Alicia/i); // Female pronoun or name
    expect(description).toMatch(/him|Bobby/i); // Male pronoun or name
    expect(description.split('.').length).toBeGreaterThan(1); // Multiple sentences
  });

  it('should respect configuration to disable enhancements', async () => {
    const container = createTestContainer();
    const service = container.resolve('IActivityDescriptionService');
    const formattingService = container.resolve('IAnatomyFormattingService');

    // Disable all enhancements
    formattingService.setActivityIntegrationConfig({
      nameResolution: {
        usePronounsWhenAvailable: false,
      },
      enableContextAwareness: false,
      enableSmartGrouping: false,
    });

    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', 'alicia', 75);
    addActivity(jon, '{actor} is holding hands with {target}', 'alicia', 85);

    const description = await service.generateActivityDescription('jon');

    // Should use Phase 1 style (no pronouns, no grouping)
    expect(description).not.toMatch(/\bhe\b/i);
    expect(description).not.toMatch(/and/);
    expect(description).toMatch(/Jon.*Jon/); // Name repeated
  });
});

describe('Activity Description - Pronoun Edge Cases', () => {
  it('should use neutral pronouns for unknown gender', async () => {
    const entity = createEntity('entity', 'unknown');
    addActivity(entity, '{actor} is meditating', null, 50);
    addActivity(entity, '{actor} is standing', null, 60);

    const description = await service.generateActivityDescription('entity');

    expect(description).toMatch(/\bthey\b/i);
  });

  it('should handle missing gender gracefully', async () => {
    const entity = createEntity('entity'); // No gender component
    addActivity(entity, '{actor} is waving', null, 50);

    const description = await service.generateActivityDescription('entity');

    // Should use neutral pronouns as fallback
    expect(description).toBeDefined();
  });

  it('should cache pronoun sets for performance', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', null, 75);
    addActivity(jon, '{actor} is standing', null, 85);

    const description = await service.generateActivityDescription('jon');

    // Gender should only be detected once (cached)
    // Verify through spy or coverage
    expect(description).toBeDefined();
  });
});

describe('Activity Description - Grouping Edge Cases', () => {
  it('should not over-group unrelated activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is meditating', null, 90);
    addActivity(jon, '{actor} is walking', null, 80);

    const description = await service.generateActivityDescription('jon');

    // Solo activities shouldn't group meaningfully
    expect(description.split('.').length).toBeGreaterThan(1);
  });

  it('should limit activities per group for readability', async () => {
    const jon = createEntity('jon', 'male');

    // Add 10 activities with same target
    for (let i = 0; i < 10; i++) {
      addActivity(jon, `{actor} action${i} {target}`, 'alicia', 90 - i);
    }

    const description = await service.generateActivityDescription('jon');

    // Should split into multiple groups if too many
    // Exact behavior depends on config.maxActivitiesPerGroup
    expect(description).toBeDefined();
  });

  it('should handle activities with partial target overlap', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is embracing {target}', 'alicia', 90);
    addActivity(jon, '{actor} is waving at {target}', 'alicia', 85);
    addActivity(jon, '{actor} is nodding at {target}', 'bobby', 80);

    const description = await service.generateActivityDescription('jon');

    // Alicia activities should group, Bobby separate
    expect(description).toMatch(/embracing.*waving/);
    expect(description).toContain('nodding');
  });
});

describe('Activity Description - Context Edge Cases', () => {
  it('should handle missing relationship components', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is talking to {target}', 'stranger', 60);

    const description = await service.generateActivityDescription('jon');

    // Should use neutral language without relationship context
    expect(description).not.toMatch(/tenderly|lovingly|intimately/);
  });

  it('should prioritize explicit relationship over implicit', async () => {
    const jon = createEntity('jon', 'male');

    // Add both partner and family relationship (edge case)
    addComponent(jon, 'relationships:partner', {
      entityId: 'alicia',
      intimacyLevel: 90,
    });
    addComponent(jon, 'relationships:family', {
      entityId: 'alicia',
      intimacyLevel: 70,
    });

    addActivity(jon, '{actor} is embracing {target}', 'alicia', 85);

    const description = await service.generateActivityDescription('jon');

    // Should use partner context (first found or highest intimacy)
    expect(description).toBeDefined();
  });

  it('should scale context adjustments with intimacy level', async () => {
    const jonLowIntimacy = createEntity('jon1', 'male');
    const jonHighIntimacy = createEntity('jon2', 'male');

    addComponent(jonLowIntimacy, 'relationships:partner', {
      entityId: 'alicia',
      intimacyLevel: 30,
    });
    addComponent(jonHighIntimacy, 'relationships:partner', {
      entityId: 'alicia',
      intimacyLevel: 95,
    });

    addActivity(jonLowIntimacy, '{actor} is holding hands with {target}', 'alicia', 80);
    addActivity(jonHighIntimacy, '{actor} is holding hands with {target}', 'alicia', 80);

    const descLow = await service.generateActivityDescription('jon1');
    const descHigh = await service.generateActivityDescription('jon2');

    // High intimacy should have more intimate language
    expect(descHigh).toMatch(/tenderly|lovingly/);
  });
});
```

## Performance Benchmarks

```javascript
describe('Activity Description - Performance', () => {
  it('should generate simple description under 10ms', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', 'alicia', 75);

    const start = performance.now();
    await service.generateActivityDescription('jon');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });

  it('should handle 10 activities under 50ms', async () => {
    const jon = createEntity('jon', 'male');

    for (let i = 0; i < 10; i++) {
      addActivity(jon, `{actor} action${i}`, 'alicia', 90 - i);
    }

    const start = performance.now();
    await service.generateActivityDescription('jon');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should cache name resolutions for performance', async () => {
    const jon = createEntity('jon', 'male');

    for (let i = 0; i < 5; i++) {
      addActivity(jon, `{actor} action${i}`, 'alicia', 90 - i);
    }

    // Generate twice to test caching
    await service.generateActivityDescription('jon');
    const start = performance.now();
    await service.generateActivityDescription('jon');
    const duration = performance.now() - start;

    // Second call should be faster due to caching
    expect(duration).toBeLessThan(20);
  });
});
```

## Acceptance Criteria
- [ ] All natural language features tested together
- [ ] Pronoun edge cases covered
- [ ] Grouping scenarios validated
- [ ] Context awareness verified
- [ ] Configuration flags tested
- [ ] Performance benchmarks met
- [ ] Edge cases handled gracefully
- [ ] All tests pass consistently
- [ ] Tests complete in <15 seconds

## Dependencies
- **Requires**: ACTDESC-014, ACTDESC-015, ACTDESC-016
- **Blocks**: Phase 6 development
- **Validates**: Complete Phase 5 implementation

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2181-2291)

## Success Metrics
- Complete natural language pipeline tested
- Performance targets met (<50ms for 10 activities)
- Edge cases handled correctly
- Configuration flexibility validated
- All integration tests passing

## Related Tickets
- **Requires**: ACTDESC-014, ACTDESC-015, ACTDESC-016
- **Validates**: Phase 5 Natural Language Enhancements
- **Enables**: Phase 6 Advanced Features development
