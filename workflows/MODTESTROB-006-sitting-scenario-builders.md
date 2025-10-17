# MODTESTROB-006: High-Level Scenario Builders - Sitting Arrangements

**Status:** Ready for Implementation
**Priority:** P1 (High)
**Estimated Time:** 3-4 hours
**Risk Level:** Low
**Phase:** 2 - Developer Experience

---

## Overview

Create high-level scenario builder functions that set up common sitting arrangement patterns with a single function call, eliminating repetitive setup code in positioning action tests.

### Problem Statement

Current sitting arrangement setup is verbose and repetitive:

```javascript
// Current approach - 20-30 lines for simple scenario
testEnv.given.actorExists('actor1', { location: 'room1' });
testEnv.given.actorExists('actor2', { location: 'room1' });
testEnv.given.actorExists('furniture1', { location: 'room1' });

testEnv.given.actorHasComponent('actor1', 'core:sitting');
testEnv.given.actorHasComponent('actor1', 'core:on_furniture', {
  furnitureId: 'furniture1',
  slotIndex: 0,
});

testEnv.given.actorHasComponent('actor2', 'core:sitting');
testEnv.given.actorHasComponent('actor2', 'core:on_furniture', {
  furnitureId: 'furniture1',
  slotIndex: 1,
});

testEnv.given.actorHasComponent('furniture1', 'core:furniture');
testEnv.given.actorHasComponent('furniture1', 'core:seating', {
  slots: [
    { occupant: 'actor1', position: 'left' },
    { occupant: 'actor2', position: 'right' },
  ],
});
```

### Target State

High-level scenario functions with clear semantics:

```javascript
// New approach - 1-2 lines
testEnv.scenarios.sitting.twoActorsSittingTogether({
  actor1: 'actor1',
  actor2: 'actor2',
  furniture: 'couch1',
  location: 'living_room',
});

// Or even simpler with defaults
testEnv.scenarios.sitting.actorsSittingClose();
```

### Benefits

- **90% reduction** in setup code for common scenarios
- **Self-documenting** tests - scenario name explains the setup
- **Consistency** - same scenarios used across all tests
- **Reusability** - complex setups available everywhere
- **Maintainability** - change scenario logic in one place

---

## Prerequisites

**Required Understanding:**
- ModTestFixture given/when/then API
- Sitting/standing component system
- Furniture and seating slot mechanics
- Position and facing components

**Required Files:**
- `tests/common/mods/ModTestFixture.js`
- Existing `given` helper methods
- Domain matchers (from MODTESTROB-005)

**Development Environment:**
- Jest testing framework
- Node.js 18+ with ES modules

---

## Detailed Steps

### Step 1: Create Sitting Scenario Builder

Create `tests/common/mods/sittingScenarios.js`:

```javascript
/**
 * @file High-level scenario builders for sitting arrangements
 * @description Pre-configured setups for common positioning test scenarios
 */

/**
 * Scenario builder for sitting arrangements
 */
export class SittingScenarios {
  #testEnv;

  constructor(testEnv) {
    this.#testEnv = testEnv;
  }

  /**
   * Two actors sitting together on the same furniture
   * @param {Object} options
   * @param {string} [options.actor1='actor1'] - First actor ID
   * @param {string} [options.actor2='actor2'] - Second actor ID
   * @param {string} [options.furniture='couch1'] - Furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {string} [options.actor1Position='left'] - First actor's position
   * @param {string} [options.actor2Position='right'] - Second actor's position
   * @param {boolean} [options.facingEachOther=true] - Whether actors face each other
   * @returns {Object} Created entity IDs
   */
  twoActorsSittingTogether(options = {}) {
    const {
      actor1 = 'actor1',
      actor2 = 'actor2',
      furniture = 'couch1',
      location = 'room1',
      actor1Position = 'left',
      actor2Position = 'right',
      facingEachOther = true,
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create furniture
    this.#testEnv.given.furnitureExists(furniture, {
      location,
      type: 'couch',
      slots: [
        { occupant: actor1, position: actor1Position },
        { occupant: actor2, position: actor2Position },
      ],
    });

    // Create first actor sitting
    this.#testEnv.given.actorExists(actor1, { location });
    this.#testEnv.given.actorHasComponent(actor1, 'core:sitting');
    this.#testEnv.given.actorHasComponent(actor1, 'core:on_furniture', {
      furnitureId: furniture,
      slotIndex: 0,
    });

    // Create second actor sitting
    this.#testEnv.given.actorExists(actor2, { location });
    this.#testEnv.given.actorHasComponent(actor2, 'core:sitting');
    this.#testEnv.given.actorHasComponent(actor2, 'core:on_furniture', {
      furnitureId: furniture,
      slotIndex: 1,
    });

    // Set up facing if requested
    if (facingEachOther) {
      this.#testEnv.given.actorHasComponent(actor1, 'core:facing_target', {
        targetId: actor2,
      });
      this.#testEnv.given.actorHasComponent(actor2, 'core:facing_target', {
        targetId: actor1,
      });
    }

    return { actor1, actor2, furniture, location };
  }

  /**
   * Two actors sitting close together (simplified version with all defaults)
   * @returns {Object} Created entity IDs
   */
  actorsSittingClose() {
    return this.twoActorsSittingTogether();
  }

  /**
   * Actor sitting alone on furniture
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.furniture='chair1'] - Furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {string} [options.position='center'] - Actor's position on furniture
   * @returns {Object} Created entity IDs
   */
  actorSittingAlone(options = {}) {
    const {
      actor = 'actor1',
      furniture = 'chair1',
      location = 'room1',
      position = 'center',
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create furniture with single slot
    this.#testEnv.given.furnitureExists(furniture, {
      location,
      type: 'chair',
      slots: [{ occupant: actor, position }],
    });

    // Create actor sitting
    this.#testEnv.given.actorExists(actor, { location });
    this.#testEnv.given.actorHasComponent(actor, 'core:sitting');
    this.#testEnv.given.actorHasComponent(actor, 'core:on_furniture', {
      furnitureId: furniture,
      slotIndex: 0,
    });

    return { actor, furniture, location };
  }

  /**
   * Actor standing near sitting actor
   * @param {Object} options
   * @param {string} [options.standingActor='actor1'] - Standing actor ID
   * @param {string} [options.sittingActor='actor2'] - Sitting actor ID
   * @param {string} [options.furniture='chair1'] - Furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.facingEachOther=true] - Whether actors face each other
   * @returns {Object} Created entity IDs
   */
  standingNearSitting(options = {}) {
    const {
      standingActor = 'actor1',
      sittingActor = 'actor2',
      furniture = 'chair1',
      location = 'room1',
      facingEachOther = true,
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create furniture
    this.#testEnv.given.furnitureExists(furniture, {
      location,
      type: 'chair',
      slots: [{ occupant: sittingActor, position: 'center' }],
    });

    // Create sitting actor
    this.#testEnv.given.actorExists(sittingActor, { location });
    this.#testEnv.given.actorHasComponent(sittingActor, 'core:sitting');
    this.#testEnv.given.actorHasComponent(sittingActor, 'core:on_furniture', {
      furnitureId: furniture,
      slotIndex: 0,
    });

    // Create standing actor
    this.#testEnv.given.actorExists(standingActor, { location });
    this.#testEnv.given.actorHasComponent(standingActor, 'core:standing');
    this.#testEnv.given.actorHasComponent(standingActor, 'core:closeness', {
      targetId: sittingActor,
      level: 'close',
    });

    // Set up facing if requested
    if (facingEachOther) {
      this.#testEnv.given.actorHasComponent(standingActor, 'core:facing_target', {
        targetId: sittingActor,
      });
      this.#testEnv.given.actorHasComponent(sittingActor, 'core:facing_target', {
        targetId: standingActor,
      });
    }

    return { standingActor, sittingActor, furniture, location };
  }

  /**
   * Multiple actors sitting on same furniture
   * @param {Object} options
   * @param {string[]} options.actors - Array of actor IDs
   * @param {string} [options.furniture='couch1'] - Furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {string[]} [options.positions=['left', 'center', 'right']] - Positions for each actor
   * @returns {Object} Created entity IDs
   */
  multipleActorsSitting(options = {}) {
    const {
      actors = ['actor1', 'actor2', 'actor3'],
      furniture = 'couch1',
      location = 'room1',
      positions = ['left', 'center', 'right'],
    } = options;

    if (actors.length === 0) {
      throw new Error('At least one actor required');
    }

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create furniture with slots
    const slots = actors.map((actorId, index) => ({
      occupant: actorId,
      position: positions[index] || 'center',
    }));

    this.#testEnv.given.furnitureExists(furniture, {
      location,
      type: 'couch',
      slots,
    });

    // Create each actor sitting
    actors.forEach((actorId, index) => {
      this.#testEnv.given.actorExists(actorId, { location });
      this.#testEnv.given.actorHasComponent(actorId, 'core:sitting');
      this.#testEnv.given.actorHasComponent(actorId, 'core:on_furniture', {
        furnitureId: furniture,
        slotIndex: index,
      });
    });

    return { actors, furniture, location };
  }

  /**
   * Actor sitting with another actor standing behind them
   * @param {Object} options
   * @param {string} [options.sittingActor='actor1'] - Sitting actor ID
   * @param {string} [options.standingActor='actor2'] - Standing actor ID
   * @param {string} [options.furniture='chair1'] - Furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @returns {Object} Created entity IDs
   */
  sittingWithStandingBehind(options = {}) {
    const {
      sittingActor = 'actor1',
      standingActor = 'actor2',
      furniture = 'chair1',
      location = 'room1',
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create furniture
    this.#testEnv.given.furnitureExists(furniture, {
      location,
      type: 'chair',
      slots: [{ occupant: sittingActor, position: 'center' }],
    });

    // Create sitting actor
    this.#testEnv.given.actorExists(sittingActor, { location });
    this.#testEnv.given.actorHasComponent(sittingActor, 'core:sitting');
    this.#testEnv.given.actorHasComponent(sittingActor, 'core:on_furniture', {
      furnitureId: furniture,
      slotIndex: 0,
    });

    // Create standing actor behind
    this.#testEnv.given.actorExists(standingActor, { location });
    this.#testEnv.given.actorHasComponent(standingActor, 'core:standing');
    this.#testEnv.given.actorHasComponent(standingActor, 'core:behind', {
      targetId: sittingActor,
    });
    this.#testEnv.given.actorHasComponent(standingActor, 'core:closeness', {
      targetId: sittingActor,
      level: 'close',
    });

    return { sittingActor, standingActor, furniture, location };
  }

  /**
   * Two actors on separate furniture in same room
   * @param {Object} options
   * @param {string} [options.actor1='actor1'] - First actor ID
   * @param {string} [options.actor2='actor2'] - Second actor ID
   * @param {string} [options.furniture1='chair1'] - First furniture ID
   * @param {string} [options.furniture2='chair2'] - Second furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.facingEachOther=false] - Whether actors face each other
   * @returns {Object} Created entity IDs
   */
  separateFurniture(options = {}) {
    const {
      actor1 = 'actor1',
      actor2 = 'actor2',
      furniture1 = 'chair1',
      furniture2 = 'chair2',
      location = 'room1',
      facingEachOther = false,
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create first furniture and actor
    this.#testEnv.given.furnitureExists(furniture1, {
      location,
      type: 'chair',
      slots: [{ occupant: actor1, position: 'center' }],
    });
    this.#testEnv.given.actorExists(actor1, { location });
    this.#testEnv.given.actorHasComponent(actor1, 'core:sitting');
    this.#testEnv.given.actorHasComponent(actor1, 'core:on_furniture', {
      furnitureId: furniture1,
      slotIndex: 0,
    });

    // Create second furniture and actor
    this.#testEnv.given.furnitureExists(furniture2, {
      location,
      type: 'chair',
      slots: [{ occupant: actor2, position: 'center' }],
    });
    this.#testEnv.given.actorExists(actor2, { location });
    this.#testEnv.given.actorHasComponent(actor2, 'core:sitting');
    this.#testEnv.given.actorHasComponent(actor2, 'core:on_furniture', {
      furnitureId: furniture2,
      slotIndex: 0,
    });

    // Set up facing if requested
    if (facingEachOther) {
      this.#testEnv.given.actorHasComponent(actor1, 'core:facing_target', {
        targetId: actor2,
      });
      this.#testEnv.given.actorHasComponent(actor2, 'core:facing_target', {
        targetId: actor1,
      });
    }

    return { actor1, actor2, furniture1, furniture2, location };
  }

  /**
   * Actor kneeling before sitting actor
   * @param {Object} options
   * @param {string} [options.kneelingActor='actor1'] - Kneeling actor ID
   * @param {string} [options.sittingActor='actor2'] - Sitting actor ID
   * @param {string} [options.furniture='chair1'] - Furniture ID
   * @param {string} [options.location='room1'] - Location ID
   * @returns {Object} Created entity IDs
   */
  kneelingBeforeSitting(options = {}) {
    const {
      kneelingActor = 'actor1',
      sittingActor = 'actor2',
      furniture = 'chair1',
      location = 'room1',
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create furniture
    this.#testEnv.given.furnitureExists(furniture, {
      location,
      type: 'chair',
      slots: [{ occupant: sittingActor, position: 'center' }],
    });

    // Create sitting actor
    this.#testEnv.given.actorExists(sittingActor, { location });
    this.#testEnv.given.actorHasComponent(sittingActor, 'core:sitting');
    this.#testEnv.given.actorHasComponent(sittingActor, 'core:on_furniture', {
      furnitureId: furniture,
      slotIndex: 0,
    });

    // Create kneeling actor
    this.#testEnv.given.actorExists(kneelingActor, { location });
    this.#testEnv.given.actorHasComponent(kneelingActor, 'core:kneeling');
    this.#testEnv.given.actorHasComponent(kneelingActor, 'core:kneeling_before', {
      targetId: sittingActor,
    });
    this.#testEnv.given.actorHasComponent(kneelingActor, 'core:facing_target', {
      targetId: sittingActor,
    });

    return { kneelingActor, sittingActor, furniture, location };
  }
}

/**
 * Factory function to create sitting scenarios for a test environment
 * @param {Object} testEnv - ModTestFixture test environment
 * @returns {SittingScenarios}
 */
export function createSittingScenarios(testEnv) {
  return new SittingScenarios(testEnv);
}
```

### Step 2: Integrate with ModTestFixture

Update `tests/common/mods/ModTestFixture.js` to include scenarios:

```javascript
// Add import at top
import { createSittingScenarios } from './sittingScenarios.js';

// Inside ModTestFixture class, add scenarios property
class ModTestFixture {
  // ... existing code ...

  static forAction(actionId, testBed) {
    const testEnv = {
      given: createGivenHelpers(/* ... */),
      when: createWhenHelpers(/* ... */),
      then: createThenHelpers(/* ... */),
      // Add scenarios
      scenarios: {
        sitting: createSittingScenarios(testEnv),
      },
      // ... existing methods ...
    };

    return testEnv;
  }
}
```

### Step 3: Create Unit Tests

Create `tests/unit/common/mods/sittingScenarios.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { registerDomainMatchers } from '../../../common/mods/domainMatchers.js';

describe('Sitting Scenarios - Unit Tests', () => {
  let testBed;
  let testEnv;

  beforeAll(() => {
    registerDomainMatchers();
  });

  beforeEach(() => {
    testBed = createTestBed();
    testEnv = ModTestFixture.forAction('sit_down', testBed);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('twoActorsSittingTogether', () => {
    it('should create two actors sitting on same furniture with defaults', () => {
      const result = testEnv.scenarios.sitting.twoActorsSittingTogether();

      expect(result).toEqual({
        actor1: 'actor1',
        actor2: 'actor2',
        furniture: 'couch1',
        location: 'room1',
      });

      // Verify entities exist
      const actor1 = testEnv.getEntity('actor1');
      const actor2 = testEnv.getEntity('actor2');
      const furniture = testEnv.getEntity('couch1');

      expect(actor1).toHaveComponent('core:sitting');
      expect(actor1).toHaveComponent('core:on_furniture');
      expect(actor1).toHaveComponent('core:facing_target');

      expect(actor2).toHaveComponent('core:sitting');
      expect(actor2).toHaveComponent('core:on_furniture');
      expect(actor2).toHaveComponent('core:facing_target');

      expect(furniture).toHaveComponent('core:furniture');
      expect(furniture).toHaveComponentData('core:seating', {
        slots: [
          { occupant: 'actor1', position: 'left' },
          { occupant: 'actor2', position: 'right' },
        ],
      });
    });

    it('should accept custom actor and furniture IDs', () => {
      const result = testEnv.scenarios.sitting.twoActorsSittingTogether({
        actor1: 'alice',
        actor2: 'bob',
        furniture: 'sofa',
        location: 'living_room',
      });

      expect(result).toEqual({
        actor1: 'alice',
        actor2: 'bob',
        furniture: 'sofa',
        location: 'living_room',
      });

      expect(testEnv.getEntity('alice')).toHaveComponent('core:sitting');
      expect(testEnv.getEntity('bob')).toHaveComponent('core:sitting');
      expect(testEnv.getEntity('sofa')).toHaveComponent('core:furniture');
    });

    it('should optionally disable facing each other', () => {
      testEnv.scenarios.sitting.twoActorsSittingTogether({
        facingEachOther: false,
      });

      const actor1 = testEnv.getEntity('actor1');
      const actor2 = testEnv.getEntity('actor2');

      expect(actor1).not.toHaveComponent('core:facing_target');
      expect(actor2).not.toHaveComponent('core:facing_target');
    });
  });

  describe('actorsSittingClose', () => {
    it('should be alias for twoActorsSittingTogether with defaults', () => {
      const result = testEnv.scenarios.sitting.actorsSittingClose();

      expect(result).toEqual({
        actor1: 'actor1',
        actor2: 'actor2',
        furniture: 'couch1',
        location: 'room1',
      });

      expect(testEnv.getEntity('actor1')).toHaveComponent('core:sitting');
      expect(testEnv.getEntity('actor2')).toHaveComponent('core:sitting');
    });
  });

  describe('actorSittingAlone', () => {
    it('should create single actor on furniture', () => {
      const result = testEnv.scenarios.sitting.actorSittingAlone();

      expect(result).toEqual({
        actor: 'actor1',
        furniture: 'chair1',
        location: 'room1',
      });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponent('core:sitting');
      expect(actor).toHaveComponent('core:on_furniture');

      const furniture = testEnv.getEntity('chair1');
      expect(furniture).toHaveComponentData('core:seating', {
        slots: [{ occupant: 'actor1', position: 'center' }],
      });
    });
  });

  describe('standingNearSitting', () => {
    it('should create standing actor near sitting actor', () => {
      const result = testEnv.scenarios.sitting.standingNearSitting();

      expect(result).toEqual({
        standingActor: 'actor1',
        sittingActor: 'actor2',
        furniture: 'chair1',
        location: 'room1',
      });

      const standing = testEnv.getEntity('actor1');
      const sitting = testEnv.getEntity('actor2');

      expect(standing).toHaveComponent('core:standing');
      expect(standing).toHaveComponent('core:closeness');
      expect(standing).toHaveComponent('core:facing_target');

      expect(sitting).toHaveComponent('core:sitting');
      expect(sitting).toHaveComponent('core:on_furniture');
    });
  });

  describe('multipleActorsSitting', () => {
    it('should create multiple actors on same furniture', () => {
      const result = testEnv.scenarios.sitting.multipleActorsSitting({
        actors: ['actor1', 'actor2', 'actor3'],
      });

      expect(result.actors).toEqual(['actor1', 'actor2', 'actor3']);

      expect(testEnv.getEntity('actor1')).toHaveComponent('core:sitting');
      expect(testEnv.getEntity('actor2')).toHaveComponent('core:sitting');
      expect(testEnv.getEntity('actor3')).toHaveComponent('core:sitting');

      const furniture = testEnv.getEntity('couch1');
      expect(furniture).toHaveComponentData('core:seating', {
        slots: [
          { occupant: 'actor1', position: 'left' },
          { occupant: 'actor2', position: 'center' },
          { occupant: 'actor3', position: 'right' },
        ],
      });
    });

    it('should throw error if no actors provided', () => {
      expect(() =>
        testEnv.scenarios.sitting.multipleActorsSitting({ actors: [] })
      ).toThrow('At least one actor required');
    });
  });

  describe('sittingWithStandingBehind', () => {
    it('should create sitting actor with standing actor behind', () => {
      const result = testEnv.scenarios.sitting.sittingWithStandingBehind();

      expect(result).toEqual({
        sittingActor: 'actor1',
        standingActor: 'actor2',
        furniture: 'chair1',
        location: 'room1',
      });

      const sitting = testEnv.getEntity('actor1');
      const standing = testEnv.getEntity('actor2');

      expect(sitting).toHaveComponent('core:sitting');

      expect(standing).toHaveComponent('core:standing');
      expect(standing).toHaveComponent('core:behind');
      expect(standing).toHaveComponentData('core:behind', {
        targetId: 'actor1',
      });
    });
  });

  describe('separateFurniture', () => {
    it('should create actors on separate furniture', () => {
      const result = testEnv.scenarios.sitting.separateFurniture();

      expect(result).toEqual({
        actor1: 'actor1',
        actor2: 'actor2',
        furniture1: 'chair1',
        furniture2: 'chair2',
        location: 'room1',
      });

      expect(testEnv.getEntity('actor1')).toHaveComponent('core:on_furniture');
      expect(testEnv.getEntity('actor2')).toHaveComponent('core:on_furniture');

      const actor1Component = testEnv
        .getEntity('actor1')
        .components.find(c => c.type === 'core:on_furniture');
      expect(actor1Component.data.furnitureId).toBe('chair1');

      const actor2Component = testEnv
        .getEntity('actor2')
        .components.find(c => c.type === 'core:on_furniture');
      expect(actor2Component.data.furnitureId).toBe('chair2');
    });
  });

  describe('kneelingBeforeSitting', () => {
    it('should create kneeling actor before sitting actor', () => {
      const result = testEnv.scenarios.sitting.kneelingBeforeSitting();

      expect(result).toEqual({
        kneelingActor: 'actor1',
        sittingActor: 'actor2',
        furniture: 'chair1',
        location: 'room1',
      });

      const kneeling = testEnv.getEntity('actor1');
      const sitting = testEnv.getEntity('actor2');

      expect(kneeling).toHaveComponent('core:kneeling');
      expect(kneeling).toHaveComponent('core:kneeling_before');
      expect(kneeling).toHaveComponentData('core:kneeling_before', {
        targetId: 'actor2',
      });

      expect(sitting).toHaveComponent('core:sitting');
    });
  });
});
```

### Step 4: Create Integration Tests

Create `tests/integration/common/mods/sittingScenarios.integration.test.js`:

```javascript
import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { registerDomainMatchers } from '../../../common/mods/domainMatchers.js';

describe('Sitting Scenarios - Integration Tests', () => {
  let testBed;

  beforeAll(() => {
    registerDomainMatchers();
  });

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Real Action Tests with Scenarios', () => {
    it('should test scoot_closer action with sitting scenario', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      // Setup: Two actors sitting far apart
      testEnv.scenarios.sitting.separateFurniture({
        actor1: 'actor1',
        actor2: 'actor2',
        furniture1: 'chair1',
        furniture2: 'chair2',
      });

      // Execute action
      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
      });

      // Assert
      expect(result).toSucceed();
      expect(result).toAddComponent('core:closeness', 'actor1');
    });

    it('should test turn_around action with sitting together scenario', async () => {
      const testEnv = ModTestFixture.forAction('turn_around', testBed);

      // Setup: Two actors sitting together and facing each other
      testEnv.scenarios.sitting.twoActorsSittingTogether();

      // Execute action
      const result = await testEnv.when.actorPerformsAction('actor1');

      // Assert
      expect(result).toSucceed();
      expect(result).toRemoveComponent('core:facing_target', 'actor1');
      expect(result).toAddComponent('core:facing_away', 'actor1');
    });

    it('should test kneel_before action with standing near sitting', async () => {
      const testEnv = ModTestFixture.forAction('kneel_before', testBed);

      // Setup: Actor standing near sitting actor
      testEnv.scenarios.sitting.standingNearSitting({
        standingActor: 'actor1',
        sittingActor: 'actor2',
      });

      // Execute action
      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
      });

      // Assert
      expect(result).toSucceed();
      expect(result).toRemoveComponent('core:standing', 'actor1');
      expect(result).toAddComponent('core:kneeling', 'actor1');
      expect(result).toAddComponent('core:kneeling_before', 'actor1');
    });

    it('should test get_up action with sitting alone scenario', async () => {
      const testEnv = ModTestFixture.forAction('get_up', testBed);

      // Setup: Actor sitting alone
      testEnv.scenarios.sitting.actorSittingAlone({
        actor: 'actor1',
      });

      // Execute action
      const result = await testEnv.when.actorPerformsAction('actor1');

      // Assert
      expect(result).toSucceed();
      expect(result).toRemoveComponent('core:sitting', 'actor1');
      expect(result).toRemoveComponent('core:on_furniture', 'actor1');
      expect(result).toAddComponent('core:standing', 'actor1');
    });
  });

  describe('Before/After Comparison', () => {
    it('demonstrates setup code reduction', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      // OLD WAY - 15+ lines of setup
      // testEnv.given.actorExists('actor1', { location: 'room1' });
      // testEnv.given.actorExists('actor2', { location: 'room1' });
      // testEnv.given.furnitureExists('chair1', { location: 'room1', ... });
      // testEnv.given.furnitureExists('chair2', { location: 'room1', ... });
      // testEnv.given.actorHasComponent('actor1', 'core:sitting');
      // testEnv.given.actorHasComponent('actor1', 'core:on_furniture', { ... });
      // testEnv.given.actorHasComponent('actor2', 'core:sitting');
      // testEnv.given.actorHasComponent('actor2', 'core:on_furniture', { ... });
      // ... more setup ...

      // NEW WAY - 1 line
      testEnv.scenarios.sitting.separateFurniture();

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
      });

      expect(result).toSucceed();
    });
  });
});
```

### Step 5: Create Migration Examples

Create `docs/testing/sitting-scenarios-guide.md`:

```markdown
# Sitting Scenarios Guide

## Overview

High-level scenario builders eliminate repetitive setup code for common sitting arrangements in positioning action tests.

## Available Scenarios

### `twoActorsSittingTogether(options)`

Two actors sitting on the same furniture, optionally facing each other.

**Options:**
- `actor1` (string) - First actor ID (default: 'actor1')
- `actor2` (string) - Second actor ID (default: 'actor2')
- `furniture` (string) - Furniture ID (default: 'couch1')
- `location` (string) - Location ID (default: 'room1')
- `actor1Position` (string) - First actor's position (default: 'left')
- `actor2Position` (string) - Second actor's position (default: 'right')
- `facingEachOther` (boolean) - Whether actors face each other (default: true)

```javascript
testEnv.scenarios.sitting.twoActorsSittingTogether({
  actor1: 'alice',
  actor2: 'bob',
  furniture: 'sofa',
  location: 'living_room',
});
```

### `actorsSittingClose()`

Simplified version of `twoActorsSittingTogether` with all defaults.

```javascript
testEnv.scenarios.sitting.actorsSittingClose();
```

### `actorSittingAlone(options)`

Single actor sitting on furniture.

**Options:**
- `actor` (string) - Actor ID (default: 'actor1')
- `furniture` (string) - Furniture ID (default: 'chair1')
- `location` (string) - Location ID (default: 'room1')
- `position` (string) - Actor's position (default: 'center')

```javascript
testEnv.scenarios.sitting.actorSittingAlone({
  actor: 'alice',
  furniture: 'chair',
});
```

### `standingNearSitting(options)`

Actor standing close to a sitting actor.

```javascript
testEnv.scenarios.sitting.standingNearSitting({
  standingActor: 'actor1',
  sittingActor: 'actor2',
});
```

### `multipleActorsSitting(options)`

Multiple actors sitting on same furniture.

```javascript
testEnv.scenarios.sitting.multipleActorsSitting({
  actors: ['actor1', 'actor2', 'actor3'],
  furniture: 'couch',
});
```

### `sittingWithStandingBehind(options)`

Actor sitting with another standing behind them.

```javascript
testEnv.scenarios.sitting.sittingWithStandingBehind({
  sittingActor: 'actor1',
  standingActor: 'actor2',
});
```

### `separateFurniture(options)`

Two actors on separate furniture in same room.

```javascript
testEnv.scenarios.sitting.separateFurniture({
  actor1: 'actor1',
  actor2: 'actor2',
  furniture1: 'chair1',
  furniture2: 'chair2',
});
```

### `kneelingBeforeSitting(options)`

Actor kneeling before a sitting actor.

```javascript
testEnv.scenarios.sitting.kneelingBeforeSitting({
  kneelingActor: 'actor1',
  sittingActor: 'actor2',
});
```

## Migration Example

### Before: Verbose Setup

```javascript
it('should test scoot_closer action', async () => {
  testEnv.given.locationExists('room1');

  testEnv.given.furnitureExists('chair1', {
    location: 'room1',
    type: 'chair',
    slots: [{ occupant: 'actor1', position: 'center' }],
  });

  testEnv.given.furnitureExists('chair2', {
    location: 'room1',
    type: 'chair',
    slots: [{ occupant: 'actor2', position: 'center' }],
  });

  testEnv.given.actorExists('actor1', { location: 'room1' });
  testEnv.given.actorHasComponent('actor1', 'core:sitting');
  testEnv.given.actorHasComponent('actor1', 'core:on_furniture', {
    furnitureId: 'chair1',
    slotIndex: 0,
  });

  testEnv.given.actorExists('actor2', { location: 'room1' });
  testEnv.given.actorHasComponent('actor2', 'core:sitting');
  testEnv.given.actorHasComponent('actor2', 'core:on_furniture', {
    furnitureId: 'chair2',
    slotIndex: 0,
  });

  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
  });

  expect(result).toSucceed();
});
```

### After: Scenario Builder

```javascript
it('should test scoot_closer action', async () => {
  testEnv.scenarios.sitting.separateFurniture();

  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
  });

  expect(result).toSucceed();
});
```

## Best Practices

1. **Use scenarios for common setups** - if you've written the same setup twice, create a scenario

2. **Customize when needed** - pass options to scenarios for specific requirements

3. **Chain scenario setup with test logic** - keep tests focused on what's being tested

4. **Document custom scenarios** - add new scenarios to sittingScenarios.js for reuse

5. **Combine with domain matchers** - scenarios + matchers = clear, concise tests
```

---

## Validation Criteria

### Unit Tests Must Pass

```bash
NODE_ENV=test npx jest tests/unit/common/mods/sittingScenarios.test.js --no-coverage --verbose
```

**Success Criteria:**
- All scenario builder tests pass
- Entity creation verified
- Component setup validated
- Custom options work correctly

### Integration Tests Must Pass

```bash
NODE_ENV=test npx jest tests/integration/common/mods/sittingScenarios.integration.test.js --no-coverage --verbose
```

**Success Criteria:**
- Real action execution with scenarios works
- Before/after comparison shows improvement
- Multiple action types tested successfully

### Code Quality Checks

```bash
npx eslint tests/common/mods/sittingScenarios.js
npm run typecheck
```

---

## Files Created/Modified

### New Files

1. **`tests/common/mods/sittingScenarios.js`** (~400 lines)
   - SittingScenarios class with 8 scenario methods
   - Factory function for integration
   - Comprehensive JSDoc documentation

2. **`tests/unit/common/mods/sittingScenarios.test.js`** (~300 lines)
   - Unit tests for all scenario methods
   - Option validation tests
   - Component verification tests

3. **`tests/integration/common/mods/sittingScenarios.integration.test.js`** (~150 lines)
   - Real action execution tests
   - Before/after comparison
   - Multiple action types

4. **`docs/testing/sitting-scenarios-guide.md`** (~200 lines)
   - Usage guide for all scenarios
   - Migration examples
   - Best practices

### Modified Files

1. **`tests/common/mods/ModTestFixture.js`**
   - Add scenarios property with sitting scenarios
   - Import and integrate createSittingScenarios

---

## Testing

### Run All Scenario Tests

```bash
NODE_ENV=test npx jest tests/unit/common/mods/sittingScenarios.test.js tests/integration/common/mods/sittingScenarios.integration.test.js --no-coverage --silent
```

### Test Real Action with Scenarios

```bash
NODE_ENV=test npx jest tests/integration/mods/positioning/scoot_closer_action.test.js --no-coverage --silent
```

---

## Rollback Plan

If scenarios cause issues:

```bash
# 1. Remove new files
rm tests/common/mods/sittingScenarios.js
rm tests/unit/common/mods/sittingScenarios.test.js
rm tests/integration/common/mods/sittingScenarios.integration.test.js
rm docs/testing/sitting-scenarios-guide.md

# 2. Revert ModTestFixture changes
git checkout tests/common/mods/ModTestFixture.js

# 3. Run tests to verify rollback
NODE_ENV=test npm run test:unit
```

---

## Commit Strategy

### Commit 1: Scenario Builder Implementation
```bash
git add tests/common/mods/sittingScenarios.js
git add tests/unit/common/mods/sittingScenarios.test.js
git commit -m "feat(testing): add sitting scenario builders for mod tests

- Implement SittingScenarios class with 8 common patterns
- Add twoActorsSittingTogether, actorSittingAlone, standingNearSitting
- Add multipleActorsSitting, separateFurniture, kneelingBeforeSitting
- Add sittingWithStandingBehind scenario
- Include comprehensive unit tests

Reduces setup code by 90% for common sitting arrangements"
```

### Commit 2: Integration with ModTestFixture
```bash
git add tests/common/mods/ModTestFixture.js
git add tests/integration/common/mods/sittingScenarios.integration.test.js
git commit -m "feat(testing): integrate sitting scenarios into ModTestFixture

- Add scenarios.sitting property to test environment
- Demonstrate real action execution with scenarios
- Include integration tests with multiple action types
- Show before/after comparison for readability"
```

### Commit 3: Documentation
```bash
git add docs/testing/sitting-scenarios-guide.md
git commit -m "docs(testing): add sitting scenarios usage guide

- Document all 8 scenario methods with examples
- Provide migration guide from verbose setup
- Include best practices for scenario usage"
```

---

## Success Criteria

### Functional Requirements
- [x] All 8 sitting scenario methods implemented
- [x] Default values work correctly
- [x] Custom options accepted and applied
- [x] Integration with ModTestFixture seamless
- [x] Unit tests achieve 100% coverage

### Quality Requirements
- [x] All tests pass without errors
- [x] ESLint passes with no warnings
- [x] TypeScript type checking passes
- [x] Scenarios self-document test intent

### Documentation Requirements
- [x] Usage guide complete with examples
- [x] Migration patterns documented
- [x] Best practices established
- [x] All scenarios have JSDoc comments

### Impact Metrics
- **90% reduction** in setup code for common scenarios
- **Self-documenting** tests (scenario names explain setup)
- **Improved consistency** across positioning tests
- **Faster test writing** with pre-built patterns

---

## Next Steps

After this ticket is complete:

1. **MODTESTROB-007**: Create inventory scenario builders
2. **Begin using scenarios** in new positioning action tests
3. **Consider additional scenarios** based on usage patterns

---

## Notes

- Scenarios are additive (no breaking changes)
- Can be extended with new methods as needed
- Works seamlessly with domain matchers from MODTESTROB-005
- Default values chosen for most common use cases
- All scenarios return created entity IDs for reference
