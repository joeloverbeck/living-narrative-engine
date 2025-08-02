# POSMIG-12: Update Test Files

## Overview

Comprehensively update all test files that reference positioning components, actions, or rules to use the new positioning namespace. This includes unit tests, integration tests, and end-to-end tests. This ticket ensures the entire test suite passes after the positioning mod migration.

## Priority

**High** - Tests must pass to validate migration success and prevent regressions.

## Dependencies

- All previous POSMIG tickets should be completed
- POSMIG-11: Update Operation Handlers and Services (should be completed)

## Estimated Effort

**4-5 hours** (comprehensive test updates across the codebase)

## Acceptance Criteria

1. ✅ All unit tests updated to use positioning component IDs
2. ✅ All integration tests updated and passing
3. ✅ All end-to-end tests updated and passing
4. ✅ Test fixtures and mock data updated
5. ✅ Test utilities updated to work with positioning mod
6. ✅ No test failures due to missing components or actions
7. ✅ Test coverage maintained or improved
8. ✅ Performance tests updated if applicable
9. ✅ Migration documented

## Implementation Steps

### Step 1: Identify Test Files to Update

Based on the migration report, the following test files need updates:

**Integration Tests**:

- `tests/integration/rules/closenessActionAvailability.integration.test.js`
- `tests/integration/rules/stepBackRule.integration.test.js`
- `tests/integration/rules/getCloseRule.integration.test.js`
- `tests/integration/rules/turnAroundRule.integration.test.js`
- `tests/integration/rules/turnAroundToFaceRule.integration.test.js`

**Unit Tests**:

- `tests/unit/schemas/closeness.schema.test.js`
- `tests/unit/mods/intimacy/components/facingAwayComponent.test.js`

**E2E Tests**:

- `tests/e2e/actions/CrossModActionIntegration.e2e.test.js`

### Step 2: Update Integration Tests

Update `tests/integration/rules/closenessActionAvailability.integration.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBed } from '../../common/testbed.js';

describe('Closeness Action Availability Integration', () => {
  let testBed;

  // Updated constants
  const CLOSENESS_COMPONENT_ID = 'positioning:closeness';
  const GET_CLOSE_ACTION_ID = 'positioning:get_close';
  const STEP_BACK_ACTION_ID = 'positioning:step_back';

  beforeEach(() => {
    testBed = new TestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Get Close Action', () => {
    it('should be available when actor can move', async () => {
      const actorId = testBed.createActor('TestActor');
      const targetId = testBed.createActor('TargetActor');

      // Add required conditions
      testBed.addCondition(actorId, 'core:actor-can-move', true);

      const availableActions = await testBed.getAvailableActions(
        actorId,
        targetId
      );

      expect(availableActions).toContainEqual(
        expect.objectContaining({ id: GET_CLOSE_ACTION_ID })
      );
    });

    it('should not be available when actor cannot move', async () => {
      const actorId = testBed.createActor('TestActor');
      const targetId = testBed.createActor('TargetActor');

      // Don't add move condition

      const availableActions = await testBed.getAvailableActions(
        actorId,
        targetId
      );

      expect(availableActions).not.toContainEqual(
        expect.objectContaining({ id: GET_CLOSE_ACTION_ID })
      );
    });
  });

  describe('Step Back Action', () => {
    it('should be available when actor is in closeness', async () => {
      const actorId = testBed.createActor('TestActor');
      const partnerId = testBed.createActor('PartnerActor');

      // Add closeness component with new ID
      testBed.addComponent(actorId, {
        id: CLOSENESS_COMPONENT_ID,
        data: { partners: [actorId, partnerId] },
      });

      const availableActions = await testBed.getAvailableActions(actorId);

      expect(availableActions).toContainEqual(
        expect.objectContaining({ id: STEP_BACK_ACTION_ID })
      );
    });

    it('should not be available when actor is not in closeness', async () => {
      const actorId = testBed.createActor('TestActor');

      // No closeness component

      const availableActions = await testBed.getAvailableActions(actorId);

      expect(availableActions).not.toContainEqual(
        expect.objectContaining({ id: STEP_BACK_ACTION_ID })
      );
    });
  });
});
```

Update `tests/integration/rules/stepBackRule.integration.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBed } from '../../common/testbed.js';

describe('Step Back Rule Integration', () => {
  let testBed;

  const STEP_BACK_ACTION_ID = 'positioning:step_back';
  const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

  beforeEach(() => {
    testBed = new TestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should remove actor from closeness circle', async () => {
    const actorId = testBed.createActor('Actor1');
    const partnerId = testBed.createActor('Actor2');

    // Set up closeness circle with updated component ID
    testBed.addComponent(actorId, {
      id: CLOSENESS_COMPONENT_ID,
      data: { partners: [actorId, partnerId] },
    });

    testBed.addComponent(partnerId, {
      id: CLOSENESS_COMPONENT_ID,
      data: { partners: [actorId, partnerId] },
    });

    // Execute step back action
    const actionEvent = {
      type: 'ACTION_PERFORMED',
      payload: {
        actionId: STEP_BACK_ACTION_ID,
        actor: actorId,
      },
    };

    await testBed.dispatchEvent(actionEvent);

    // Verify actor's closeness component is removed
    const actorComponents = await testBed.getActorComponents(actorId);
    expect(actorComponents[CLOSENESS_COMPONENT_ID]).toBeUndefined();

    // Verify partner's closeness component is also removed (2-person circle)
    const partnerComponents = await testBed.getActorComponents(partnerId);
    expect(partnerComponents[CLOSENESS_COMPONENT_ID]).toBeUndefined();
  });

  it('should handle multi-person closeness circles correctly', async () => {
    const actor1Id = testBed.createActor('Actor1');
    const actor2Id = testBed.createActor('Actor2');
    const actor3Id = testBed.createActor('Actor3');

    const partners = [actor1Id, actor2Id, actor3Id];

    // Set up 3-person closeness circle
    for (const actorId of partners) {
      testBed.addComponent(actorId, {
        id: CLOSENESS_COMPONENT_ID,
        data: { partners },
      });
    }

    // Actor1 steps back
    const actionEvent = {
      type: 'ACTION_PERFORMED',
      payload: {
        actionId: STEP_BACK_ACTION_ID,
        actor: actor1Id,
      },
    };

    await testBed.dispatchEvent(actionEvent);

    // Verify actor1's closeness component is removed
    const actor1Components = await testBed.getActorComponents(actor1Id);
    expect(actor1Components[CLOSENESS_COMPONENT_ID]).toBeUndefined();

    // Verify actor2 and actor3 still have closeness with each other
    const actor2Components = await testBed.getActorComponents(actor2Id);
    expect(actor2Components[CLOSENESS_COMPONENT_ID].data.partners).toEqual([
      actor2Id,
      actor3Id,
    ]);

    const actor3Components = await testBed.getActorComponents(actor3Id);
    expect(actor3Components[CLOSENESS_COMPONENT_ID].data.partners).toEqual([
      actor2Id,
      actor3Id,
    ]);
  });
});
```

Update `tests/integration/rules/getCloseRule.integration.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBed } from '../../common/testbed.js';

describe('Get Close Rule Integration', () => {
  let testBed;

  const GET_CLOSE_ACTION_ID = 'positioning:get_close';
  const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

  beforeEach(() => {
    testBed = new TestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should create closeness circle between two actors', async () => {
    const actorId = testBed.createActor('Actor1');
    const targetId = testBed.createActor('Actor2');

    // Execute get close action
    const actionEvent = {
      type: 'ACTION_PERFORMED',
      payload: {
        actionId: GET_CLOSE_ACTION_ID,
        actor: actorId,
        entity: targetId,
      },
    };

    await testBed.dispatchEvent(actionEvent);

    // Verify both actors have closeness component
    const actorComponents = await testBed.getActorComponents(actorId);
    expect(actorComponents[CLOSENESS_COMPONENT_ID].data.partners).toEqual(
      expect.arrayContaining([actorId, targetId])
    );

    const targetComponents = await testBed.getActorComponents(targetId);
    expect(targetComponents[CLOSENESS_COMPONENT_ID].data.partners).toEqual(
      expect.arrayContaining([actorId, targetId])
    );
  });

  it('should merge existing closeness circles', async () => {
    const actor1Id = testBed.createActor('Actor1');
    const actor2Id = testBed.createActor('Actor2');
    const actor3Id = testBed.createActor('Actor3');
    const actor4Id = testBed.createActor('Actor4');

    // Set up two separate closeness circles
    testBed.addComponent(actor1Id, {
      id: CLOSENESS_COMPONENT_ID,
      data: { partners: [actor1Id, actor2Id] },
    });

    testBed.addComponent(actor2Id, {
      id: CLOSENESS_COMPONENT_ID,
      data: { partners: [actor1Id, actor2Id] },
    });

    testBed.addComponent(actor3Id, {
      id: CLOSENESS_COMPONENT_ID,
      data: { partners: [actor3Id, actor4Id] },
    });

    testBed.addComponent(actor4Id, {
      id: CLOSENESS_COMPONENT_ID,
      data: { partners: [actor3Id, actor4Id] },
    });

    // Actor2 gets close to Actor3 (merging the circles)
    const actionEvent = {
      type: 'ACTION_PERFORMED',
      payload: {
        actionId: GET_CLOSE_ACTION_ID,
        actor: actor2Id,
        entity: actor3Id,
      },
    };

    await testBed.dispatchEvent(actionEvent);

    // Verify all actors are now in one merged circle
    const expectedPartners = [actor1Id, actor2Id, actor3Id, actor4Id];

    for (const actorId of expectedPartners) {
      const components = await testBed.getActorComponents(actorId);
      expect(components[CLOSENESS_COMPONENT_ID].data.partners).toEqual(
        expect.arrayContaining(expectedPartners)
      );
      expect(components[CLOSENESS_COMPONENT_ID].data.partners).toHaveLength(4);
    }
  });
});
```

### Step 3: Update Unit Tests

Update `tests/unit/schemas/closeness.schema.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { validateAgainstSchema } from '../../../src/utils/schemaValidator.js';

describe('Closeness Component Schema', () => {
  const validComponent = {
    id: 'positioning:closeness', // Updated ID
    description: 'Tracks actors in a closeness circle',
    dataSchema: {
      type: 'object',
      properties: {
        partners: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['partners'],
    },
  };

  it('should validate a valid closeness component', () => {
    const result = validateAgainstSchema(
      validComponent,
      'component.schema.json'
    );
    expect(result.isValid).toBe(true);
  });

  it('should validate component data with partners array', () => {
    const componentData = {
      partners: ['actor1', 'actor2', 'actor3'],
    };

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(true);
  });

  it('should reject component data without partners', () => {
    const componentData = {};

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('partners'));
  });

  it('should reject component data with non-array partners', () => {
    const componentData = {
      partners: 'not-an-array',
    };

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(false);
  });

  it('should reject component data with non-string partner IDs', () => {
    const componentData = {
      partners: ['actor1', 123, 'actor3'],
    };

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(false);
  });
});
```

Update `tests/unit/mods/intimacy/components/facingAwayComponent.test.js`:

Move this test to `tests/unit/mods/positioning/components/facingAwayComponent.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { validateAgainstSchema } from '../../../../../src/utils/schemaValidator.js';

describe('Facing Away Component', () => {
  const validComponent = {
    id: 'positioning:facing_away', // Updated ID
    description: 'Tracks which actors this entity is facing away from',
    dataSchema: {
      type: 'object',
      properties: {
        actors: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['actors'],
    },
  };

  it('should validate a valid facing away component', () => {
    const result = validateAgainstSchema(
      validComponent,
      'component.schema.json'
    );
    expect(result.isValid).toBe(true);
  });

  it('should validate component data with actors array', () => {
    const componentData = {
      actors: ['actor1', 'actor2'],
    };

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(true);
  });

  it('should validate component data with empty actors array', () => {
    const componentData = {
      actors: [],
    };

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(true);
  });

  it('should reject component data without actors', () => {
    const componentData = {};

    const result = validateAgainstSchema(
      componentData,
      validComponent.dataSchema
    );
    expect(result.isValid).toBe(false);
  });
});
```

### Step 4: Update E2E Tests

Update `tests/e2e/actions/CrossModActionIntegration.e2e.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { E2ETestBed } from '../../common/e2eTestbed.js';

describe('Cross-Mod Action Integration E2E', () => {
  let e2eTestBed;

  beforeEach(async () => {
    e2eTestBed = new E2ETestBed();
    await e2eTestBed.setup();
  });

  afterEach(async () => {
    await e2eTestBed.teardown();
  });

  it('should integrate positioning and intimacy actions', async () => {
    // Create test actors
    const actor1 = await e2eTestBed.createActor('TestActor1');
    const actor2 = await e2eTestBed.createActor('TestActor2');

    // Test get close action (positioning mod)
    await e2eTestBed.performAction('positioning:get_close', {
      actor: actor1.id,
      entity: actor2.id,
    });

    // Verify closeness established
    const actor1State = await e2eTestBed.getActorState(actor1.id);
    expect(actor1State.components['positioning:closeness']).toBeDefined();
    expect(
      actor1State.components['positioning:closeness'].data.partners
    ).toContain(actor2.id);

    // Test intimacy action that requires closeness
    const intimateActions = await e2eTestBed.getAvailableActions(
      actor1.id,
      actor2.id
    );
    const kissAction = intimateActions.find(
      (action) => action.id === 'intimacy:peck_on_lips'
    );

    expect(kissAction).toBeDefined();

    // Perform intimate action
    await e2eTestBed.performAction('intimacy:peck_on_lips', {
      actor: actor1.id,
      entity: actor2.id,
    });

    // Test step back action (positioning mod)
    await e2eTestBed.performAction('positioning:step_back', {
      actor: actor1.id,
    });

    // Verify closeness removed
    const updatedActor1State = await e2eTestBed.getActorState(actor1.id);
    expect(
      updatedActor1State.components['positioning:closeness']
    ).toBeUndefined();

    // Verify intimate actions no longer available
    const postStepBackActions = await e2eTestBed.getAvailableActions(
      actor1.id,
      actor2.id
    );
    const postKissAction = postStepBackActions.find(
      (action) => action.id === 'intimacy:pec_on_lips'
    );

    expect(postKissAction).toBeUndefined();
  });

  it('should handle turn around mechanics with intimacy actions', async () => {
    const actor1 = await e2eTestBed.createActor('TestActor1');
    const actor2 = await e2eTestBed.createActor('TestActor2');

    // Get close first
    await e2eTestBed.performAction('positioning:get_close', {
      actor: actor1.id,
      entity: actor2.id,
    });

    // Turn around
    await e2eTestBed.performAction('positioning:turn_around', {
      actor: actor1.id,
      target: actor2.id,
    });

    // Verify facing away state
    const actor2State = await e2eTestBed.getActorState(actor2.id);
    expect(actor2State.components['positioning:facing_away']).toBeDefined();
    expect(
      actor2State.components['positioning:facing_away'].data.actors
    ).toContain(actor1.id);

    // Test that certain intimacy actions are now forbidden
    const actions = await e2eTestBed.getAvailableActions(actor1.id, actor2.id);
    const massageBackAction = actions.find(
      (action) => action.id === 'intimacy:massage_back'
    );

    expect(massageBackAction).toBeUndefined(); // Should be forbidden when facing away

    // Turn around to face
    await e2eTestBed.performAction('positioning:turn_around_to_face', {
      actor: actor2.id,
      target: actor1.id,
    });

    // Verify facing away cleared
    const updatedActor2State = await e2eTestBed.getActorState(actor2.id);
    expect(
      updatedActor2State.components['positioning:facing_away'].data.actors
    ).not.toContain(actor1.id);
  });
});
```

### Step 5: Update Test Utilities

Update test bed utilities to work with positioning mod:

```javascript
// tests/common/testbed.js - Update helper methods

class TestBed {
  // ... existing methods ...

  /**
   * Create a closeness circle between actors
   * @param {string[]} actorIds - Array of actor IDs
   */
  createClosenessCircle(actorIds) {
    for (const actorId of actorIds) {
      this.addComponent(actorId, {
        id: 'positioning:closeness',
        data: { partners: actorIds },
      });
    }
  }

  /**
   * Set actor facing away from others
   * @param {string} actorId - Actor who is facing away
   * @param {string[]} facingAwayFromIds - Actors they're facing away from
   */
  setFacingAway(actorId, facingAwayFromIds) {
    this.addComponent(actorId, {
      id: 'positioning:facing_away',
      data: { actors: facingAwayFromIds },
    });
  }

  /**
   * Helper to check if actors are in same closeness circle
   * @param {string} actor1Id - First actor
   * @param {string} actor2Id - Second actor
   * @returns {Promise<boolean>}
   */
  async areActorsClose(actor1Id, actor2Id) {
    const actor1Components = await this.getActorComponents(actor1Id);
    const closeness = actor1Components['positioning:closeness'];

    return closeness?.data?.partners?.includes(actor2Id) || false;
  }
}
```

### Step 6: Create Test Migration Validation Script

Create `scripts/validate-test-migration.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates test file migration
 * @description Ensures all tests use positioning component IDs
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const OLD_REFS = [
  'intimacy:closeness',
  'intimacy:facing_away',
  'intimacy:get_close',
  'intimacy:step_back',
  'intimacy:turn_around',
  'intimacy:turn_around_to_face',
];

async function validateTests() {
  console.log('🧪 Validating test file migration...\\n');

  const errors = [];

  // Find all test files
  const testFiles = await glob('tests/**/*.test.js');

  for (const testFile of testFiles) {
    const content = await fs.readFile(testFile, 'utf8');

    for (const oldRef of OLD_REFS) {
      if (content.includes(oldRef)) {
        errors.push(`${testFile} still contains ${oldRef}`);
      }
    }
  }

  // Run tests to verify they pass
  console.log('🔬 Running test suite...');

  try {
    const { stdout, stderr } = await execAsync('npm test');
    console.log('✅ Test suite passed');

    // Check for any positioning-related test failures
    if (stderr.includes('positioning') || stdout.includes('FAIL')) {
      errors.push('Test suite has failures that may be related to migration');
    }
  } catch (error) {
    errors.push(`Test suite failed: ${error.message}`);
  }

  if (errors.length > 0) {
    console.log('\\n❌ Test validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\\n✨ All tests updated and passing!');
  }
}

validateTests().catch(console.error);
```

## Validation Steps

### 1. Run Test Migration Validation

```bash
node scripts/validate-test-migration.js
```

### 2. Run Specific Test Suites

```bash
# Run integration tests
npm test tests/integration/

# Run unit tests
npm test tests/unit/

# Run E2E tests
npm test tests/e2e/
```

### 3. Run Full Test Suite

```bash
npm run test:ci
```

### 4. Check Test Coverage

```bash
npm run test:coverage
```

## Common Issues and Solutions

### Issue 1: Test Data Mismatches

**Problem**: Tests fail due to incorrect component IDs in test data.

**Solution**: Update all test fixtures, mocks, and sample data to use positioning namespace.

### Issue 2: Missing Mod Dependencies

**Problem**: Tests can't find positioning mod components.

**Solution**: Ensure test environment loads positioning mod before intimacy mod.

### Issue 3: Async Test Failures

**Problem**: Race conditions in tests due to changed component operations.

**Solution**: Add proper async/await handling and increase timeouts if needed.

## Rollback Plan

If tests fail critically:

1. Revert test files using git
2. Run original test suite to verify stability
3. Address issues incrementally

## Completion Checklist

- [ ] All integration tests updated
- [ ] All unit tests updated
- [ ] All E2E tests updated
- [ ] Test utilities updated
- [ ] Test fixtures updated
- [ ] Mock data updated
- [ ] Test migration validation script created
- [ ] Full test suite passing
- [ ] Test coverage maintained
- [ ] Performance tests updated if applicable
- [ ] Migration documented

## Next Steps

After successful test updates:

- POSMIG-13: Update Intimacy Mod Dependencies
- Final validation and cleanup

## Notes for Implementer

- Update tests incrementally and run frequently
- Pay attention to test data and fixtures
- Update test utilities to help with positioning mod
- Consider adding new tests for cross-mod functionality
- Maintain or improve test coverage
- Update any test documentation or README files
