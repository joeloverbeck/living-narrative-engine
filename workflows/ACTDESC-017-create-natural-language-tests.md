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
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

const ACTIVITY_COMPONENTS = {
  'core:gender': {
    id: 'core:gender',
    dataSchema: { type: 'object', properties: { value: { type: 'string' } } },
  },
  'positioning:closeness': {
    id: 'positioning:closeness',
    dataSchema: {
      type: 'object',
      properties: {
        partners: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  'test:activity_kneeling': {
    id: 'test:activity_kneeling',
    dataSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:activity_holding_hands': {
    id: 'test:activity_holding_hands',
    dataSchema: {
      type: 'object',
      properties: {
        partner: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:activity_gazing': {
    id: 'test:activity_gazing',
    dataSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:activity_generic': {
    id: 'test:activity_generic',
    dataSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
};

function registerActivityComponents(testBed) {
  testBed.loadComponents(ACTIVITY_COMPONENTS);
}

async function createActor(entityManager, { id, name, gender }) {
  const entity = await entityManager.createEntityInstance('core:actor', {
    instanceId: id,
  });

  if (name) {
    entityManager.addComponent(entity.id, 'core:name', { text: name });
  }

  if (gender) {
    entityManager.addComponent(entity.id, 'core:gender', { value: gender });
  }

  return entity;
}

function addInlineActivity(
  entityManager,
  actorId,
  componentId,
  { targetId, template, priority, grouping, targetRole = 'entityId' }
) {
  const componentData = {};

  if (targetId && targetRole) {
    componentData[targetRole] = targetId;
  }

  componentData.activityMetadata = {
    shouldDescribeInActivity: true,
    template,
    priority,
    targetRole,
    grouping,
  };

  entityManager.addComponent(actorId, componentId, componentData);
}

describe('Activity Description - Natural Language Integration', () => {
  let testBed;
  let entityManager;
  let formattingService;
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    formattingService = testBed.mockAnatomyFormattingService;
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: formattingService,
    });
  });

  afterEach(() => testBed.cleanup());

  it('should produce natural description with pronouns, grouping, and context', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    entityManager.addComponent(jon.id, 'positioning:closeness', {
      partners: [alicia.id],
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_gazing', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is gazing at {target}',
      priority: 87,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_holding_hands', {
      targetId: alicia.id,
      targetRole: 'partner',
      template: '{actor} is holding hands with {target}',
      priority: 85,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_kneeling', {
      targetId: alicia.id,
      targetRole: 'entityId',
      template: '{actor} is kneeling before {target}',
      priority: 75,
    });

    const description = await service.generateActivityDescription(jon.id);
    const words = description.toLowerCase().split(/\W+/);

    expect(description).toContain('Activity:');
    expect(description).toContain('Jon');
    expect(words).toContain('her');
    expect(description).toMatch(/and|while/);
    expect(description).toMatch(/tenderly|fiercely/);
    expect(description.split('.').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle multiple targets with pronouns', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });
    const bobby = await createActor(entityManager, {
      id: 'bobby',
      name: 'Bobby Draper',
      gender: 'male',
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_holding_hands', {
      targetId: alicia.id,
      targetRole: 'partner',
      template: '{actor} is embracing {target}',
      priority: 90,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_gazing', {
      targetId: bobby.id,
      targetRole: 'target',
      template: '{actor} is waving at {target}',
      priority: 70,
    });

    const description = await service.generateActivityDescription(jon.id);
    const words = description.toLowerCase().split(/\W+/);

    expect(description).toContain('Jon');
    expect(words).toContain('he');
    expect(description).toMatch(/Alicia|her/i);
    expect(words).toContain('her');
    expect(description).toMatch(/Bobby|him/i);
    expect(words).toContain('him');
    expect(description.split('.').length).toBeGreaterThan(1);
  });

  it('should respect configuration toggles for pronouns and context', async () => {
    formattingService.getActivityIntegrationConfig = () => ({
      prefix: 'Activity: ',
      separator: '. ',
      suffix: '',
      maxActivities: 10,
      enableContextAwareness: false,
      nameResolution: {
        usePronounsWhenAvailable: false,
        fallbackToNames: true,
      },
    });

    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_holding_hands', {
      targetId: alicia.id,
      targetRole: 'partner',
      template: '{actor} is holding hands with {target}',
      priority: 85,
    });

    const description = await service.generateActivityDescription(jon.id);
    const words = description.toLowerCase().split(/\W+/);

    expect(description).toContain('Jon');
    expect(description).toContain('Alicia');
    expect(words).not.toContain('he');
    expect(words).not.toContain('her');
  });
});
```


> **Note:** Hoist `registerActivityComponents`, `createActor`, and `addInlineActivity` helpers at module scope so the suites below can reuse them without redefining duplicates.

### Pronoun Edge Cases

```javascript
describe('Activity Description - Pronoun Edge Cases', () => {
  let testBed;
  let entityManager;
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
    });
  });

  afterEach(() => testBed.cleanup());

  it('should use neutral pronouns for unknown gender', async () => {
    const actor = await createActor(entityManager, {
      id: 'entity',
      name: 'Mystery Figure',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is meditating',
      priority: 50,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is standing quietly',
      priority: 60,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).toContain('they');
  });

  it('should handle missing gender gracefully', async () => {
    const actor = await createActor(entityManager, {
      id: 'entity',
      name: 'Mystery Figure',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is waving',
      priority: 50,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBeTruthy();
  });

  it('should avoid repeated target lookups when pronouns enabled', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    const getEntityInstanceSpy = jest.spyOn(entityManager, 'getEntityInstance');

    addInlineActivity(entityManager, jon.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is gazing at {target}',
      priority: 80,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is whispering to {target}',
      priority: 70,
    });

    await service.generateActivityDescription(jon.id);

    const targetCalls = getEntityInstanceSpy.mock.calls.filter(
      ([id]) => id === alicia.id
    );
    expect(targetCalls.length).toBe(1);
  });
});
```

### Grouping Edge Cases

```javascript
describe('Activity Description - Grouping Edge Cases', () => {
  let testBed;
  let entityManager;
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
    });
  });

  afterEach(() => testBed.cleanup());

  it('should not over-group unrelated activities', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is meditating',
      priority: 90,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is walking away',
      priority: 80,
    });

    const description = await service.generateActivityDescription(actor.id);
    const segments = description.replace(/^Activity: /, '').split('. ');
    expect(segments.length).toBeGreaterThan(1);
  });

  it('should group activities that share an explicit group key', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: "{actor} is brushing {target}'s hair",
      priority: 85,
      grouping: { groupKey: 'grooming' },
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: "{actor} is braiding {target}'s hair",
      priority: 83,
      grouping: { groupKey: 'grooming' },
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toMatch(/brushing/i);
    expect(description).toMatch(/braiding/i);
    expect(description).toMatch(/and/);
  });

  it('should choose "while" for near-simultaneous priorities', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is gazing at {target}',
      priority: 90,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: "{actor} is holding {target}'s hand",
      priority: 82,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toMatch(/while/i);
  });
});
```

### Context Edge Cases

```javascript
describe('Activity Description - Context Edge Cases', () => {
  let testBed;
  let entityManager;
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
    });
  });

  afterEach(() => testBed.cleanup());

  it('should handle missing relationship components', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const stranger = await createActor(entityManager, {
      id: 'stranger',
      name: 'Stranger',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: stranger.id,
      targetRole: 'target',
      template: '{actor} is talking to {target}',
      priority: 60,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).not.toContain('tenderly');
    expect(description.toLowerCase()).not.toContain('fiercely');
  });

  it('should prioritize closeness partners for intimate tone', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    entityManager.addComponent(actor.id, 'positioning:closeness', {
      partners: [alicia.id],
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is embracing {target}',
      priority: 85,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).toContain('tenderly');
  });

  it('should scale context adjustments with intensity', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is sparring with {target}',
      priority: 95,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).toContain('fiercely');
  });
});
```


## Performance Benchmarks

```javascript
describe('Activity Description - Performance', () => {
  let testBed;
  let entityManager;
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
    });
  });

  afterEach(() => testBed.cleanup());

  it('should generate simple description under 10ms', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_kneeling', {
      targetId: alicia.id,
      targetRole: 'entityId',
      template: '{actor} is kneeling',
      priority: 75,
    });

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });

  it('should handle 10 activities under 50ms', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    for (let i = 0; i < 10; i += 1) {
      addInlineActivity(entityManager, jon.id, 'test:activity_generic', {
        targetId: alicia.id,
        targetRole: 'target',
        template: `{actor} action${i} {target}`,
        priority: 90 - i,
      });
    }

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should reuse cached name resolutions on subsequent calls', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    for (let i = 0; i < 5; i += 1) {
      addInlineActivity(entityManager, jon.id, 'test:activity_generic', {
        targetId: alicia.id,
        targetRole: 'target',
        template: `{actor} action${i} with {target}`,
        priority: 90 - i,
      });
    }

    await service.generateActivityDescription(jon.id);

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

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
