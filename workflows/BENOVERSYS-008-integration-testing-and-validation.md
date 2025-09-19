# BENOVERSYS-008: Integration Testing and Validation

## Overview
Perform comprehensive integration testing of the complete bending over system, validating all components work together correctly and ensuring compatibility with existing positioning systems (sitting, kneeling). This ticket represents the final validation phase before the system is considered production-ready.

## Prerequisites
- BENOVERSYS-001 through BENOVERSYS-007 completed
- All components, actions, scopes, conditions, rules, and test entities created
- Test framework operational (Jest with jsdom)
- Existing positioning system tests available for reference

## Acceptance Criteria
1. All individual components validate against their schemas
2. Complete action flow works end-to-end
3. Mutual exclusivity with other positioning states enforced
4. Closeness relationships managed correctly
5. Movement locking/unlocking functions properly
6. No conflicts with existing positioning systems
7. Performance meets acceptable thresholds
8. Edge cases handled gracefully

## Implementation Steps

### Step 1: Create Integration Test Suite
Create `tests/integration/positioning/bendingOverSystem.integration.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { createPositioningTestUtilities } from '../../common/positioning/positioningTestUtilities.js';

describe('Bending Over System Integration', () => {
  let testBed;
  let positioningUtils;

  beforeEach(() => {
    testBed = createTestBed();
    positioningUtils = createPositioningTestUtilities(testBed);

    // Load positioning mod with bending system
    testBed.loadMod('positioning');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Component Integration', () => {
    it('should load all bending components', () => {
      const allowsBending = testBed.getComponent('positioning:allows_bending_over');
      const bendingOver = testBed.getComponent('positioning:bending_over');

      expect(allowsBending).toBeDefined();
      expect(bendingOver).toBeDefined();
      expect(bendingOver.dataSchema.required).toContain('surface_id');
    });
  });

  describe('Action-Scope Integration', () => {
    it('should discover bend_over actions for available surfaces', async () => {
      const actor = positioningUtils.createActor({
        position: 'test:kitchen'
      });
      const counter = positioningUtils.createSurface({
        id: 'test:counter',
        position: 'test:kitchen',
        allowsBending: true
      });

      const actions = await testBed.discoverActions(actor);
      const bendOverAction = actions.find(a => a.actionId === 'positioning:bend_over');

      expect(bendOverAction).toBeDefined();
      expect(bendOverAction.targetId).toBe(counter.id);
    });

    it('should not show bend_over when actor is sitting', async () => {
      const actor = positioningUtils.createActor({
        position: 'test:room',
        sittingOn: { furniture_id: 'test:chair', spot_index: 0 }
      });

      const actions = await testBed.discoverActions(actor);
      const bendOverAction = actions.find(a => a.actionId === 'positioning:bend_over');

      expect(bendOverAction).toBeUndefined();
    });
  });

  describe('Complete Action Flow', () => {
    it('should handle bend over action from UI to state change', async () => {
      const actor = positioningUtils.createActor({ position: 'test:kitchen' });
      const counter = positioningUtils.createSurface({
        id: 'test:counter',
        position: 'test:kitchen',
        allowsBending: true
      });

      // Simulate UI action selection
      const event = {
        type: 'ACTION_ATTEMPTED',
        payload: {
          actionId: 'positioning:bend_over',
          actorId: actor.id,
          targetId: counter.id
        }
      };

      await testBed.dispatchEvent(event);
      await testBed.waitForRules();

      // Verify state changes
      const updatedActor = testBed.getEntity(actor.id);
      expect(updatedActor.components['positioning:bending_over']).toEqual({
        surface_id: counter.id
      });
      expect(updatedActor.components['core:movement'].locked).toBe(true);
    });

    it('should handle straighten up action', async () => {
      const actor = positioningUtils.createActor({
        position: 'test:kitchen',
        bendingOver: { surface_id: 'test:counter' }
      });
      const counter = positioningUtils.createSurface({
        id: 'test:counter',
        position: 'test:kitchen',
        allowsBending: true
      });

      const event = {
        type: 'ACTION_ATTEMPTED',
        payload: {
          actionId: 'positioning:straighten_up',
          actorId: actor.id,
          targetId: counter.id
        }
      };

      await testBed.dispatchEvent(event);
      await testBed.waitForRules();

      const updatedActor = testBed.getEntity(actor.id);
      expect(updatedActor.components['positioning:bending_over']).toBeUndefined();
      expect(updatedActor.components['core:movement'].locked).toBe(false);
    });
  });

  describe('Mutual Exclusivity', () => {
    it('should prevent bending while sitting', async () => {
      const actor = positioningUtils.createActor({
        sittingOn: { furniture_id: 'test:chair', spot_index: 0 }
      });

      const actions = await testBed.discoverActions(actor);
      const bendOver = actions.find(a => a.actionId === 'positioning:bend_over');
      const sitDown = actions.find(a => a.actionId === 'positioning:sit_down');

      expect(bendOver).toBeUndefined();
      expect(sitDown).toBeUndefined(); // Already sitting
    });

    it('should prevent sitting while bending', async () => {
      const actor = positioningUtils.createActor({
        bendingOver: { surface_id: 'test:counter' }
      });

      const actions = await testBed.discoverActions(actor);
      const sitDown = actions.find(a => a.actionId === 'positioning:sit_down');
      const bendOver = actions.find(a => a.actionId === 'positioning:bend_over');

      expect(sitDown).toBeUndefined();
      expect(bendOver).toBeUndefined(); // Already bending
    });
  });

  describe('Closeness Management', () => {
    it('should establish closeness between actors at same surface', async () => {
      const actor1 = positioningUtils.createActor({ id: 'test:actor1' });
      const actor2 = positioningUtils.createActor({ id: 'test:actor2' });
      const counter = positioningUtils.createSurface({
        id: 'test:counter',
        allowsBending: true
      });

      // Both actors bend over counter
      await positioningUtils.performBendOver(actor1, counter);
      await positioningUtils.performBendOver(actor2, counter);

      const closeness1 = testBed.getClosenessRelationships(actor1.id);
      const closeness2 = testBed.getClosenessRelationships(actor2.id);

      expect(closeness1).toContain(actor2.id);
      expect(closeness2).toContain(actor1.id);
    });

    it('should remove closeness when straightening up', async () => {
      // Setup: Two actors bending with established closeness
      const actor1 = positioningUtils.createActor({ id: 'test:actor1' });
      const actor2 = positioningUtils.createActor({ id: 'test:actor2' });
      const counter = positioningUtils.createSurface({ id: 'test:counter' });

      await positioningUtils.performBendOver(actor1, counter);
      await positioningUtils.performBendOver(actor2, counter);

      // Actor1 straightens up
      await positioningUtils.performStraightenUp(actor1, counter);

      const closeness1 = testBed.getClosenessRelationships(actor1.id);
      expect(closeness1).not.toContain(actor2.id);
    });
  });

  describe('Dual-Purpose Furniture', () => {
    it('should support both sitting and bending on same furniture', async () => {
      const sofa = positioningUtils.createSurface({
        id: 'test:sofa',
        allowsSitting: { spots: [null, null, null] },
        allowsBending: true
      });

      const sitter = positioningUtils.createActor({ id: 'test:sitter' });
      const bender = positioningUtils.createActor({ id: 'test:bender' });

      await positioningUtils.performSitDown(sitter, sofa, 0);
      await positioningUtils.performBendOver(bender, sofa);

      const sitterState = testBed.getEntity(sitter.id);
      const benderState = testBed.getEntity(bender.id);

      expect(sitterState.components['positioning:sitting_on']).toBeDefined();
      expect(benderState.components['positioning:bending_over']).toBeDefined();
    });
  });
});
```

### Step 2: Create Edge Case Tests
Create `tests/integration/positioning/bendingOverEdgeCases.integration.test.js`:

```javascript
describe('Bending Over System Edge Cases', () => {
  describe('Concurrent Operations', () => {
    it('should handle multiple actors bending simultaneously', async () => {
      const counter = positioningUtils.createSurface({ id: 'test:counter' });
      const actors = Array.from({ length: 5 }, (_, i) =>
        positioningUtils.createActor({ id: `test:actor${i}` })
      );

      // All actors attempt to bend over simultaneously
      const promises = actors.map(actor =>
        positioningUtils.performBendOver(actor, counter)
      );

      await Promise.all(promises);

      // Verify all succeeded (no position limits)
      actors.forEach(actor => {
        const state = testBed.getEntity(actor.id);
        expect(state.components['positioning:bending_over']).toBeDefined();
      });
    });
  });

  describe('Invalid States', () => {
    it('should handle missing surface gracefully', async () => {
      const actor = positioningUtils.createActor();

      const event = {
        type: 'ACTION_ATTEMPTED',
        payload: {
          actionId: 'positioning:bend_over',
          actorId: actor.id,
          targetId: 'non-existent-surface'
        }
      };

      await testBed.dispatchEvent(event);
      const logs = testBed.getLogs();

      expect(logs).toContainEqual(
        expect.objectContaining({
          logType: 'error',
          message: expect.stringContaining('Invalid target')
        })
      );
    });

    it('should handle corrupt component data', async () => {
      const actor = positioningUtils.createActor();

      // Manually set invalid component data
      actor.components['positioning:bending_over'] = {
        surface_id: null // Invalid - should be a string
      };

      const actions = await testBed.discoverActions(actor);
      // System should handle gracefully, not crash
      expect(actions).toBeDefined();
    });
  });

  describe('State Transitions', () => {
    it('should handle rapid bend-straighten cycles', async () => {
      const actor = positioningUtils.createActor();
      const counter = positioningUtils.createSurface();

      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        await positioningUtils.performBendOver(actor, counter);
        await positioningUtils.performStraightenUp(actor, counter);
      }

      const finalState = testBed.getEntity(actor.id);
      expect(finalState.components['positioning:bending_over']).toBeUndefined();
      expect(finalState.components['core:movement'].locked).toBe(false);
    });
  });
});
```

### Step 3: Create Performance Tests
Create `tests/performance/positioning/bendingOverPerformance.test.js`:

```javascript
describe('Bending Over System Performance', () => {
  it('should handle action discovery with many surfaces efficiently', async () => {
    const actor = positioningUtils.createActor();

    // Create many surfaces
    const surfaces = Array.from({ length: 100 }, (_, i) =>
      positioningUtils.createSurface({
        id: `test:surface${i}`,
        allowsBending: true
      })
    );

    const startTime = performance.now();
    const actions = await testBed.discoverActions(actor);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // < 100ms
    expect(actions.filter(a => a.actionId === 'positioning:bend_over')).toHaveLength(100);
  });

  it('should evaluate scopes efficiently with complex filters', async () => {
    // Create complex entity structure
    const locations = Array.from({ length: 10 }, (_, i) =>
      positioningUtils.createLocation({ id: `test:location${i}` })
    );

    const surfaces = [];
    locations.forEach(location => {
      Array.from({ length: 10 }, (_, i) =>
        surfaces.push(positioningUtils.createSurface({
          id: `test:surface_${location.id}_${i}`,
          position: location.id,
          allowsBending: i % 2 === 0 // Only half allow bending
        }))
      );
    });

    const actor = positioningUtils.createActor({
      position: locations[5].id
    });

    const startTime = performance.now();
    const available = await testBed.evaluateScope('positioning:available_surfaces', actor);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(50); // < 50ms
    expect(available).toHaveLength(5); // 5 surfaces in location allow bending
  });
});
```

### Step 4: Create System Validation Script
Create `scripts/validate-bending-system.js`:

```javascript
#!/usr/bin/env node

import { validateComponentSchema } from '../src/validators/componentValidator.js';
import { validateActionSchema } from '../src/validators/actionValidator.js';
import { validateRuleSchema } from '../src/validators/ruleValidator.js';
import { validateScopeSyntax } from '../src/scopeDsl/scopeValidator.js';
import fs from 'fs/promises';
import path from 'path';

async function validateBendingSystem() {
  console.log('🔍 Validating Bending Over System...\n');

  const results = {
    components: [],
    actions: [],
    conditions: [],
    rules: [],
    scopes: [],
    entities: []
  };

  // Validate Components
  const components = [
    'data/mods/positioning/components/allows_bending_over.component.json',
    'data/mods/positioning/components/bending_over.component.json'
  ];

  for (const file of components) {
    const content = await fs.readFile(file, 'utf-8');
    const component = JSON.parse(content);
    const valid = validateComponentSchema(component);
    results.components.push({ file, valid });
    console.log(`${valid ? '✅' : '❌'} Component: ${path.basename(file)}`);
  }

  // Validate Actions
  const actions = [
    'data/mods/positioning/actions/bend_over.action.json',
    'data/mods/positioning/actions/straighten_up.action.json'
  ];

  for (const file of actions) {
    const content = await fs.readFile(file, 'utf-8');
    const action = JSON.parse(content);
    const valid = validateActionSchema(action);
    results.actions.push({ file, valid });
    console.log(`${valid ? '✅' : '❌'} Action: ${path.basename(file)}`);
  }

  // Validate Scopes
  const scopes = [
    'data/mods/positioning/scopes/available_surfaces.scope',
    'data/mods/positioning/scopes/surface_im_bending_over.scope'
  ];

  for (const file of scopes) {
    const content = await fs.readFile(file, 'utf-8');
    const valid = validateScopeSyntax(content);
    results.scopes.push({ file, valid });
    console.log(`${valid ? '✅' : '❌'} Scope: ${path.basename(file)}`);
  }

  // Summary
  console.log('\n📊 Validation Summary:');
  console.log(`Components: ${results.components.filter(r => r.valid).length}/${results.components.length}`);
  console.log(`Actions: ${results.actions.filter(r => r.valid).length}/${results.actions.length}`);
  console.log(`Scopes: ${results.scopes.filter(r => r.valid).length}/${results.scopes.length}`);

  const allValid = [...results.components, ...results.actions, ...results.scopes]
    .every(r => r.valid);

  if (allValid) {
    console.log('\n✅ All bending system files validated successfully!');
  } else {
    console.log('\n❌ Some files failed validation. Check the output above.');
    process.exit(1);
  }
}

validateBendingSystem().catch(console.error);
```

### Step 5: Run Complete Test Suite
```bash
# Run all bending system tests
npm test -- positioning/bending

# Run integration tests only
npm run test:integration -- bendingOver

# Run performance tests
npm run test:performance -- bendingOver

# Run validation script
node scripts/validate-bending-system.js
```

## Testing Checklist

### Component Testing
- [ ] All component schemas validate
- [ ] Components load in entity system
- [ ] Component data structures correct

### Action Testing
- [ ] Actions discovered when appropriate
- [ ] Actions hidden when forbidden
- [ ] Action templates format correctly

### Scope Testing
- [ ] Scopes return correct entities
- [ ] Location filtering works
- [ ] Empty results handled

### Rule Testing
- [ ] Rules trigger on correct conditions
- [ ] Operations execute in order
- [ ] Error cases handled

### Integration Testing
- [ ] Complete flow works end-to-end
- [ ] Mutual exclusivity enforced
- [ ] Closeness relationships work
- [ ] Movement locking/unlocking works

### Performance Testing
- [ ] Action discovery < 100ms with 100 surfaces
- [ ] Scope evaluation < 50ms with complex filters
- [ ] No memory leaks in rapid state changes

### Edge Case Testing
- [ ] Concurrent operations handled
- [ ] Invalid states graceful
- [ ] Rapid transitions stable
- [ ] Missing entities handled

## Notes
- Integration tests use test utilities for consistency
- Performance thresholds based on existing positioning system
- Edge cases cover real-world scenarios
- Validation script enables CI/CD integration

## Dependencies
- Blocks: None (final validation phase)
- Blocked by: BENOVERSYS-001 through BENOVERSYS-007 (requires complete system)

## Estimated Effort
- 2 hours test implementation
- 1 hour test execution and debugging
- 30 minutes documentation

## Risk Assessment
- **Low Risk**: Testing doesn't affect production code
- **Mitigation**: Comprehensive test coverage reduces bugs
- **Recovery**: Test failures guide fixes

## Success Metrics
- All validation checks pass
- Integration tests 100% passing
- Performance within thresholds
- No conflicts with existing systems
- Edge cases handled gracefully
- System ready for production use