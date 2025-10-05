# INTMODREF-006: Create Integration Tests

**Phase**: 4 - Testing
**Estimated Time**: 2-3 hours
**Dependencies**: INTMODREF-002, INTMODREF-003, INTMODREF-004, INTMODREF-005 (all migrations and updates complete)
**Report Reference**: Testing Requirements (lines 639-691)

## Objective

Create comprehensive integration test suites for the three new mods (affection, kissing, caressing) and cross-mod interaction scenarios to ensure the refactored system works correctly.

## Background

Integration tests verify that actions, rules, conditions, scopes, and components work together correctly in realistic gameplay scenarios. These tests are critical to validate the migration succeeded without breaking functionality.

## Test Requirements

- **Coverage**: All actions must be testable
- **Scenarios**: Expected use cases, edge cases, cross-mod interactions
- **State Management**: Verify kissing component lifecycle
- **Visual Properties**: Confirm color schemes display correctly
- **Action Discovery**: Ensure actions appear in appropriate contexts

## Tasks

### 1. Create Affection Mod Integration Tests

**File**: `tests/integration/mods/affection/affection_actions.integration.test.js`

**Test Scenarios**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Affection Mod - Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    testBed.loadMods(['core', 'anatomy', 'positioning', 'descriptors', 'affection']);
  });

  describe('Action Discovery', () => {
    it('should discover all 8 affection actions', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const actions = testBed.discoverActions(actor, target);
      const affectionActions = actions.filter(a => a.id.startsWith('affection:'));

      expect(affectionActions.length).toBeGreaterThanOrEqual(8);
    });

    it('should apply Soft Purple color scheme to all actions', () => {
      const actions = testBed.getActionsByMod('affection');

      actions.forEach(action => {
        expect(action.visualProperties.backgroundColor).toBe('#6a1b9a');
        expect(action.visualProperties.textColor).toBe('#f3e5f5');
      });
    });
  });

  describe('Hold Hand Action', () => {
    it('should successfully execute hold_hand action', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const result = testBed.executeAction('affection:hold_hand', actor, target);

      expect(result.success).toBe(true);
      expect(result.message).toContain('hold');
      expect(result.message).toContain('hand');
    });

    it('should fail when actors not close', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      // Don't set close

      const result = testBed.executeAction('affection:hold_hand', actor, target);

      expect(result.success).toBe(false);
    });
  });

  describe('Positioning Requirements', () => {
    it('should require closeness for all affection actions', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsFacing(actor, target);
      // Not close

      const actions = testBed.discoverActions(actor, target);
      const affectionActions = actions.filter(a => a.id.startsWith('affection:'));

      expect(affectionActions.length).toBe(0);
    });

    it('should support actions from behind for some actions', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsBehind(actor, target);

      const actions = testBed.discoverActions(actor, target);
      const massageActions = actions.filter(a =>
        a.id === 'affection:massage_back' ||
        a.id === 'affection:massage_shoulders'
      );

      expect(massageActions.length).toBeGreaterThan(0);
    });
  });
});
```

### 2. Create Kissing Mod Integration Tests

**File**: `tests/integration/mods/kissing/kissing_workflow.integration.test.js`

**Test Scenarios**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Kissing Mod - Workflow Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    testBed.loadMods(['core', 'anatomy', 'positioning', 'descriptors', 'kissing']);
  });

  describe('Kiss Initiation', () => {
    it('should initiate deep kiss and add kissing component to both actors', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const result = testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      expect(result.success).toBe(true);

      // Verify component added to both
      const actorKissing = testBed.getComponent(actor, 'kissing:kissing');
      const targetKissing = testBed.getComponent(target, 'kissing:kissing');

      expect(actorKissing).toBeDefined();
      expect(actorKissing.partner).toBe(target.id);
      expect(actorKissing.initiator).toBe(true);

      expect(targetKissing).toBeDefined();
      expect(targetKissing.partner).toBe(actor.id);
      expect(targetKissing.initiator).toBe(false);
    });

    it('should lock mouth engagement during kiss', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      const actorMouthLocked = testBed.isMouthEngaged(actor);
      const targetMouthLocked = testBed.isMouthEngaged(target);

      expect(actorMouthLocked).toBe(true);
      expect(targetMouthLocked).toBe(true);
    });
  });

  describe('During Kiss Actions', () => {
    it('should allow during-kiss actions only when kissing', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      // Not kissing yet
      let actions = testBed.discoverActions(actor, target);
      let duringKiss = actions.filter(a => a.id === 'kissing:explore_mouth_with_tongue');
      expect(duringKiss.length).toBe(0);

      // Start kissing
      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      // Now during-kiss actions available
      actions = testBed.discoverActions(actor, target);
      duringKiss = actions.filter(a => a.id === 'kissing:explore_mouth_with_tongue');
      expect(duringKiss.length).toBeGreaterThan(0);
    });

    it('should execute nibble_lower_lip during kiss', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      const result = testBed.executeAction('kissing:nibble_lower_lip', actor, target);

      expect(result.success).toBe(true);
      expect(result.message).toContain('nibble');
      expect(result.message).toContain('lip');
    });
  });

  describe('Kiss Ending', () => {
    it('should remove kissing component when breaking kiss', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      const result = testBed.executeAction('kissing:break_kiss_gently', actor, target);

      expect(result.success).toBe(true);

      // Verify component removed from both
      const actorKissing = testBed.getComponent(actor, 'kissing:kissing');
      const targetKissing = testBed.getComponent(target, 'kissing:kissing');

      expect(actorKissing).toBeUndefined();
      expect(targetKissing).toBeUndefined();
    });

    it('should unlock mouth engagement after kiss ends', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);
      testBed.executeAction('kissing:break_kiss_gently', actor, target);

      const actorMouthLocked = testBed.isMouthEngaged(actor);
      const targetMouthLocked = testBed.isMouthEngaged(target);

      expect(actorMouthLocked).toBe(false);
      expect(targetMouthLocked).toBe(false);
    });
  });

  describe('Kiss Responses', () => {
    it('should allow passionate response to kiss', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      const result = testBed.executeAction('kissing:kiss_back_passionately', target, actor);

      expect(result.success).toBe(true);
    });

    it('should allow passive acceptance of kiss', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);

      const result = testBed.executeAction('kissing:accept_kiss_passively', target, actor);

      expect(result.success).toBe(true);
    });
  });

  describe('Visual Properties', () => {
    it('should apply Rose Pink color scheme to all actions', () => {
      const actions = testBed.getActionsByMod('kissing');

      actions.forEach(action => {
        expect(action.visualProperties.backgroundColor).toBe('#ad1457');
        expect(action.visualProperties.textColor).toBe('#ffffff');
      });
    });
  });
});
```

### 3. Create Caressing Mod Integration Tests

**File**: `tests/integration/mods/caressing/caressing_actions.integration.test.js`

**Test Scenarios**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Caressing Mod - Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    testBed.loadMods(['core', 'anatomy', 'positioning', 'descriptors', 'clothing', 'caressing']);
  });

  describe('Action Discovery', () => {
    it('should discover all 9 caressing actions', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const actions = testBed.discoverActions(actor, target);
      const caressingActions = actions.filter(a => a.id.startsWith('caressing:'));

      expect(caressingActions.length).toBeGreaterThanOrEqual(9);
    });

    it('should apply Dark Purple color scheme to all actions', () => {
      const actions = testBed.getActionsByMod('caressing');

      actions.forEach(action => {
        expect(action.visualProperties.backgroundColor).toBe('#311b92');
        expect(action.visualProperties.textColor).toBe('#d1c4e9');
      });
    });
  });

  describe('Multi-Target Actions', () => {
    it('should execute fondle_ass with clothing target', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const pants = testBed.addClothing(target, 'lower', 'pants');

      const result = testBed.executeAction('caressing:fondle_ass', actor, target);

      expect(result.success).toBe(true);
      expect(result.targets).toContain(target.id);
      expect(result.targets).toContain(pants.id);
    });

    it('should execute caress_abdomen with clothing target', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const shirt = testBed.addClothing(target, 'torso', 'shirt');

      const result = testBed.executeAction('caressing:caress_abdomen', actor, target);

      expect(result.success).toBe(true);
      expect(result.targets).toContain(target.id);
      expect(result.targets).toContain(shirt.id);
    });
  });

  describe('Positioning Requirements', () => {
    it('should require closeness for caressing actions', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsFacing(actor, target);
      // Not close

      const actions = testBed.discoverActions(actor, target);
      const caressingActions = actions.filter(a => a.id.startsWith('caressing:'));

      expect(caressingActions.length).toBe(0);
    });
  });

  describe('Clothing Integration', () => {
    it('should require clothing dependency', () => {
      const manifest = testBed.getModManifest('caressing');
      const clothingDep = manifest.dependencies.find(d => d.id === 'clothing');

      expect(clothingDep).toBeDefined();
    });

    it('should select topmost clothing for fondle_ass', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      const underwear = testBed.addClothing(target, 'lower', 'underwear');
      const pants = testBed.addClothing(target, 'lower', 'pants');

      const result = testBed.executeAction('caressing:fondle_ass', actor, target);

      expect(result.targets).toContain(pants.id);
      expect(result.targets).not.toContain(underwear.id);
    });
  });
});
```

### 4. Create Cross-Mod Integration Tests

**File**: `tests/integration/mods/intimate_interactions_cross_mod.test.js`

**Test Scenarios**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Intimate Interactions - Cross-Mod Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    testBed.loadMods([
      'core', 'anatomy', 'positioning', 'descriptors', 'clothing',
      'affection', 'kissing', 'caressing'
    ]);
  });

  describe('Progressive Intimacy Flow', () => {
    it('should support affection → kissing → caressing progression', () => {
      const actor = testBed.createActor();
      const target = testBed.createActor();
      testBed.setActorsClose(actor, target);
      testBed.setActorsFacing(actor, target);

      // Start with affection
      const holdHand = testBed.executeAction('affection:hold_hand', actor, target);
      expect(holdHand.success).toBe(true);

      // Progress to kissing
      const kiss = testBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);
      expect(kiss.success).toBe(true);

      // During kiss, caressing still possible
      const caress = testBed.executeAction('caressing:run_fingers_through_hair', actor, target);
      expect(caress.success).toBe(true);
    });
  });

  describe('Mod Independence', () => {
    it('should work with only affection mod loaded', () => {
      const isolatedBed = createTestBed();
      isolatedBed.loadMods(['core', 'anatomy', 'positioning', 'descriptors', 'affection']);

      const actor = isolatedBed.createActor();
      const target = isolatedBed.createActor();
      isolatedBed.setActorsClose(actor, target);
      isolatedBed.setActorsFacing(actor, target);

      const result = isolatedBed.executeAction('affection:hold_hand', actor, target);

      expect(result.success).toBe(true);
    });

    it('should work with only kissing mod loaded', () => {
      const isolatedBed = createTestBed();
      isolatedBed.loadMods(['core', 'anatomy', 'positioning', 'descriptors', 'kissing']);

      const actor = isolatedBed.createActor();
      const target = isolatedBed.createActor();
      isolatedBed.setActorsClose(actor, target);
      isolatedBed.setActorsFacing(actor, target);

      const result = isolatedBed.executeAction('kissing:peck_on_lips', actor, target);

      expect(result.success).toBe(true);
    });
  });

  describe('Visual Hierarchy', () => {
    it('should display color progression: Soft Purple → Rose Pink → Dark Purple', () => {
      const affectionColor = testBed.getAction('affection:hold_hand').visualProperties.backgroundColor;
      const kissingColor = testBed.getAction('kissing:lean_in_for_deep_kiss').visualProperties.backgroundColor;
      const caressingColor = testBed.getAction('caressing:fondle_ass').visualProperties.backgroundColor;

      expect(affectionColor).toBe('#6a1b9a'); // Soft Purple
      expect(kissingColor).toBe('#ad1457');   // Rose Pink
      expect(caressingColor).toBe('#311b92'); // Dark Purple

      // Verify visual hierarchy exists
      expect(affectionColor).not.toBe(kissingColor);
      expect(kissingColor).not.toBe(caressingColor);
      expect(affectionColor).not.toBe(caressingColor);
    });
  });

  describe('Dependent Mod Compatibility', () => {
    it('should work with sex mod if loaded', () => {
      const extendedBed = createTestBed();
      extendedBed.loadMods([
        'core', 'anatomy', 'positioning', 'descriptors', 'clothing',
        'affection', 'kissing', 'caressing', 'sex'
      ]);

      const actor = extendedBed.createActor();
      const target = extendedBed.createActor();
      extendedBed.setActorsClose(actor, target);
      extendedBed.setActorsFacing(actor, target);

      // Should be able to use intimacy actions as prerequisites for sex actions
      extendedBed.executeAction('kissing:lean_in_for_deep_kiss', actor, target);
      extendedBed.executeAction('caressing:fondle_ass', actor, target);

      const sexActions = extendedBed.discoverActions(actor, target).filter(a => a.id.startsWith('sex:'));
      expect(sexActions.length).toBeGreaterThan(0);
    });
  });
});
```

## Acceptance Criteria

- [ ] Affection integration test suite created with 8+ scenarios
- [ ] Kissing integration test suite created with workflow tests
- [ ] Caressing integration test suite created with multi-target tests
- [ ] Cross-mod integration test suite created
- [ ] All test files follow project structure (`tests/integration/mods/`)
- [ ] Tests verify action discovery works correctly
- [ ] Tests verify color schemes are applied
- [ ] Tests verify kissing component lifecycle
- [ ] Tests verify mouth engagement locking
- [ ] Tests verify multi-target actions with clothing
- [ ] Tests verify progressive intimacy flow
- [ ] Tests verify mod independence
- [ ] All tests pass successfully
- [ ] Test coverage meets requirements (80%+ branches)

## Validation Commands

```bash
# Run affection tests
NODE_ENV=test npx jest tests/integration/mods/affection/ --no-coverage

# Run kissing tests
NODE_ENV=test npx jest tests/integration/mods/kissing/ --no-coverage

# Run caressing tests
NODE_ENV=test npx jest tests/integration/mods/caressing/ --no-coverage

# Run cross-mod tests
NODE_ENV=test npx jest tests/integration/mods/intimate_interactions_cross_mod.test.js --no-coverage

# Run all integration tests
NODE_ENV=test npm run test:integration

# Check coverage
NODE_ENV=test npm run test:integration -- --coverage
```

## Next Steps

After completion, proceed to:
- **INTMODREF-007**: Update existing tests

## Notes

- Use `createTestBed()` helper for consistent test setup
- Tests should verify both success and failure scenarios
- Component lifecycle tests are critical for kissing mod
- Multi-target tests essential for caressing mod
- Cross-mod tests validate architectural refactoring success
- Test color schemes for visual hierarchy validation
- Verify mod independence to ensure proper modularity
