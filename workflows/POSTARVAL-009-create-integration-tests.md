# POSTARVAL-009: Create Integration Tests

## Overview
Create comprehensive integration tests that validate the entire target validation system working together, including action discovery, positioning scenarios, and complex multi-actor interactions.

## Prerequisites
- POSTARVAL-001 through POSTARVAL-005: Core system implemented
- POSTARVAL-006 & 007: Actions updated
- POSTARVAL-008: Unit tests created

## Objectives
1. Test full action discovery pipeline with target validation
2. Validate positioning scenario prevention
3. Test multi-actor interaction scenarios
4. Verify circular dependency prevention
5. Ensure LLM-controlled character compliance

## Implementation Steps

### 1. Action Discovery Integration Tests
Create `tests/integration/actions/targetForbiddenComponentsDiscovery.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { createTestActor } from '../../common/testDataFactory.js';

describe('Action Discovery with Target Forbidden Components', () => {
  let testBed;
  let actionDiscovery;
  let entityManager;

  beforeEach(() => {
    testBed = createTestBed();
    actionDiscovery = testBed.getService('IActionDiscovery');
    entityManager = testBed.getService('IEntityManager');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('single-target validation in discovery', () => {
    it('should filter out kneel_before when target is kneeling', async () => {
      // Setup
      const actor = createTestActor('actor1');
      const target = createTestActor('target1');

      // Place in same location
      entityManager.addComponent(actor.id, 'core:position', {
        locationId: 'room1'
      });
      entityManager.addComponent(target.id, 'core:position', {
        locationId: 'room1'
      });

      // Target is kneeling
      entityManager.addComponent(target.id, 'positioning:kneeling_before', {
        entityId: 'someone_else'
      });

      // Discover actions
      const actions = await actionDiscovery.discoverActions(actor.id);

      // kneel_before should not be available for this target
      const kneelAction = actions.find(a =>
        a.actionId === 'positioning:kneel_before' &&
        a.targets?.primary === target.id
      );

      expect(kneelAction).toBeUndefined();
    });

    it('should include kneel_before when target is standing', async () => {
      const actor = createTestActor('actor1');
      const target = createTestActor('target1');

      // Place in same location, both standing
      entityManager.addComponent(actor.id, 'core:position', {
        locationId: 'room1'
      });
      entityManager.addComponent(target.id, 'core:position', {
        locationId: 'room1'
      });

      const actions = await actionDiscovery.discoverActions(actor.id);

      const kneelAction = actions.find(a =>
        a.actionId === 'positioning:kneel_before' &&
        a.targets?.primary === target.id
      );

      expect(kneelAction).toBeDefined();
      expect(kneelAction.targets.primary).toBe(target.id);
    });
  });

  describe('multi-target validation', () => {
    it('should validate primary target forbidden components', async () => {
      // Create test multi-target action
      const multiAction = {
        id: 'test:multi_action',
        targets: {
          primary: { scope: 'test:valid_targets' },
          secondary: { scope: 'test:valid_targets' }
        },
        forbidden_components: {
          primary: ['test:forbidden_primary'],
          secondary: ['test:forbidden_secondary']
        }
      };

      const actor = createTestActor('actor1');
      const target1 = createTestActor('target1');
      const target2 = createTestActor('target2');

      // Primary has forbidden component
      entityManager.addComponent(target1.id, 'test:forbidden_primary', {});

      const actions = await actionDiscovery.discoverActions(actor.id);

      // Should not include action with forbidden primary target
      const foundAction = actions.find(a =>
        a.actionId === 'test:multi_action' &&
        a.targets?.primary === target1.id
      );

      expect(foundAction).toBeUndefined();
    });
  });
});
```

### 2. Positioning Scenario Tests
Create `tests/integration/mods/positioning/targetValidationScenarios.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPositioningTestBed } from '../../../common/positioningTestBed.js';

describe('Positioning Target Validation Scenarios', () => {
  let testBed;
  let actionExecutor;

  beforeEach(() => {
    testBed = createPositioningTestBed();
    actionExecutor = testBed.getService('IActionExecutor');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('kneeling validation', () => {
    it('should prevent kneeling before someone already kneeling', async () => {
      const scenario = testBed.createKneelingScenario();

      // Target is kneeling before someone else
      await testBed.makeKneel(scenario.target, 'other_character');

      // Try to kneel before the kneeling target
      const result = await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actor.id,
        targets: { primary: scenario.target.id }
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('forbidden component');
      expect(result.reason).toContain('positioning:kneeling_before');
    });

    it('should prevent circular kneeling', async () => {
      const scenario = testBed.createTwoActorScenario();

      // Actor A kneels before Actor B
      await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actorA.id,
        targets: { primary: scenario.actorB.id }
      });

      // Actor B tries to kneel before Actor A (circular)
      const result = await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actorB.id,
        targets: { primary: scenario.actorA.id }
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('forbidden');
    });

    it('should allow multiple actors to kneel before same target', async () => {
      const scenario = testBed.createMultiActorScenario();

      // Actor A kneels before Target
      const result1 = await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actorA.id,
        targets: { primary: scenario.target.id }
      });

      expect(result1.success).toBe(true);

      // Actor B kneels before Target (should be allowed)
      const result2 = await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actorB.id,
        targets: { primary: scenario.target.id }
      });

      expect(result2.success).toBe(true);
    });
  });

  describe('complex positioning states', () => {
    it('should validate target in lying down state', async () => {
      const scenario = testBed.createPositioningScenario();

      // Target is lying down
      testBed.makeLyingDown(scenario.target);

      const result = await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actor.id,
        targets: { primary: scenario.target.id }
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('positioning:lying_down');
    });

    it('should validate target bending over', async () => {
      const scenario = testBed.createPositioningScenario();

      // Target is bending over
      testBed.makeBendingOver(scenario.target);

      const result = await actionExecutor.execute({
        actionId: 'positioning:kneel_before',
        actorId: scenario.actor.id,
        targets: { primary: scenario.target.id }
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('positioning:bending_over');
    });
  });
});
```

### 3. LLM Character Compliance Tests
Create `tests/integration/ai/llmPositioningCompliance.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createAITestBed } from '../../common/aiTestBed.js';

describe('LLM Character Positioning Compliance', () => {
  let testBed;
  let aiController;

  beforeEach(() => {
    testBed = createAITestBed();
    aiController = testBed.getService('IAIController');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should not attempt invalid positioning actions', async () => {
    const scenario = testBed.createAIScenario();

    // Player is kneeling before AI character
    testBed.makeKneeling(scenario.player, scenario.aiCharacter.id);

    // AI character takes turn
    const aiDecision = await aiController.selectAction(scenario.aiCharacter.id);

    // AI should not select kneel_before targeting the kneeling player
    if (aiDecision.actionId === 'positioning:kneel_before') {
      expect(aiDecision.targets?.primary).not.toBe(scenario.player.id);
    }
  });

  it('should have valid positioning actions filtered from choices', async () => {
    const scenario = testBed.createAIScenario();

    // Both player and other NPC are kneeling
    testBed.makeKneeling(scenario.player, 'someone');
    testBed.makeKneeling(scenario.otherNpc, 'someone_else');

    // Get available actions for AI
    const availableActions = await aiController.getAvailableActions(
      scenario.aiCharacter.id
    );

    // Check kneel_before is not available for kneeling targets
    const invalidKneelActions = availableActions.filter(a =>
      a.actionId === 'positioning:kneel_before' &&
      (a.targets?.primary === scenario.player.id ||
       a.targets?.primary === scenario.otherNpc.id)
    );

    expect(invalidKneelActions).toHaveLength(0);
  });
});
```

### 4. Pipeline Integration Tests
Create `tests/integration/actions/pipeline/targetValidationPipeline.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Target Validation Pipeline Integration', () => {
  let testBed;
  let pipeline;

  beforeEach(() => {
    testBed = createTestBed();
    pipeline = testBed.getService('IActionPipeline');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should execute validation stage in correct order', async () => {
    const stageExecutionOrder = [];

    // Mock stage execution tracking
    testBed.mockStageExecution((stageName) => {
      stageExecutionOrder.push(stageName);
    });

    await pipeline.process([/* test actions */], {});

    // Verify stage order
    const targetResolutionIndex = stageExecutionOrder.indexOf('TargetResolutionStage');
    const targetValidationIndex = stageExecutionOrder.indexOf('TargetComponentValidationStage');
    const formattingIndex = stageExecutionOrder.indexOf('ActionFormattingStage');

    expect(targetValidationIndex).toBeGreaterThan(targetResolutionIndex);
    expect(targetValidationIndex).toBeLessThan(formattingIndex);
  });

  it('should handle validation stage errors gracefully', async () => {
    // Force validation error
    testBed.forceValidationError();

    const result = await pipeline.process([/* test actions */], {});

    // Pipeline should continue despite validation errors
    expect(result).toBeDefined();
    expect(testBed.getErrors()).toContain('validation error');
  });
});
```

## Success Criteria
- [ ] All integration tests pass
- [ ] Circular kneeling is prevented
- [ ] Multiple positioning states validated correctly
- [ ] LLM characters respect validation rules
- [ ] Pipeline integration works seamlessly
- [ ] Edge cases handled properly
- [ ] >90% integration test coverage

## Files to Create
- `tests/integration/actions/targetForbiddenComponentsDiscovery.test.js`
- `tests/integration/mods/positioning/targetValidationScenarios.test.js`
- `tests/integration/ai/llmPositioningCompliance.test.js`
- `tests/integration/actions/pipeline/targetValidationPipeline.test.js`

## Dependencies
- All previous POSTARVAL tickets completed
- Test infrastructure and helpers available

## Estimated Time
5-6 hours

## Notes
- Use existing test bed utilities where possible
- Ensure tests are deterministic and repeatable
- Cover both success and failure scenarios
- Test with realistic game scenarios