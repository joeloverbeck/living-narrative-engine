# MOVLOCK-012: End-to-End Validation and Quality Assurance

**Status**: NOT_STARTED  
**Priority**: HIGH  
**Dependencies**: MOVLOCK-001 through MOVLOCK-011  
**Estimated Effort**: 1.5 hours

## Context

The final ticket ensures complete end-to-end functionality of the movement lock system and validates the entire implementation through comprehensive testing, quality checks, and manual validation. This ticket serves as the final quality gate before considering the feature complete.

## Implementation Steps

### 1. Create End-to-End Test Suite

**File**: `tests/e2e/positioning/movementLockFlow.test.js`

**Note**: Create directory `tests/e2e/positioning/` if it doesn't exist.

### 2. E2E Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedFactory } from '../../common/testbedFactory.js';
import { GameFlowTestHelper } from '../../common/gameFlowTestHelper.js';

describe('Movement Lock - End-to-End Flow', () => {
  let testBed;
  let gameFlow;
  let entityManager;
  let actionExecutor;

  beforeEach(async () => {
    testBed = TestBedFactory.create('full-game');
    await testBed.initialize();

    gameFlow = new GameFlowTestHelper(testBed);
    entityManager = testBed.getService('IEntityManager');
    actionExecutor = testBed.getService('IActionExecutor');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  // Test cases go here...
});
```

### 3. Complete User Journey Tests

#### 3.1 Legacy Entity Complete Flow

```javascript
describe('legacy entity complete flow', () => {
  it('should complete full kneel-stand-move cycle for legacy entity', async () => {
    // Phase 1: Setup - Create game world
    const { actorId, targetId, locationA, locationB } =
      await gameFlow.createBasicWorld({
        actorType: 'legacy',
        withLocations: true,
      });

    // Verify initial state
    await gameFlow.verifyActorAt(actorId, locationA);
    await gameFlow.verifyMovementUnlocked(actorId);

    // Phase 2: Actor approaches target
    await gameFlow.moveActor(actorId, targetId);

    // Phase 3: Actor kneels before target
    const kneelResult = await actionExecutor.execute(
      'positioning:kneel_before',
      {
        actorId: actorId,
        targetId: targetId,
      }
    );

    expect(kneelResult.success).toBe(true);

    // Verify kneeling state
    await gameFlow.verifyActorKneeling(actorId, targetId);
    await gameFlow.verifyMovementLocked(actorId);

    // Phase 4: Attempt movement while kneeling (should fail)
    const failedMoveResult = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: locationB,
    });

    expect(failedMoveResult.success).toBe(false);
    expect(failedMoveResult.reason).toContain('movement locked');
    await gameFlow.verifyActorAt(actorId, locationA); // Still at original location

    // Phase 5: Actor stands up
    const standResult = await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    expect(standResult.success).toBe(true);

    // Verify standing state
    await gameFlow.verifyActorStanding(actorId);
    await gameFlow.verifyMovementUnlocked(actorId);

    // Phase 6: Movement now allowed
    const successMoveResult = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: locationB,
    });

    expect(successMoveResult.success).toBe(true);
    await gameFlow.verifyActorAt(actorId, locationB);
  });
});
```

#### 3.2 Anatomy Entity Complete Flow

```javascript
describe('anatomy entity complete flow', () => {
  it('should complete full kneel-stand-move cycle for anatomy entity', async () => {
    // Phase 1: Setup - Create anatomy-based world
    const { actorId, targetId, locationA, locationB } =
      await gameFlow.createBasicWorld({
        actorType: 'anatomy',
        withLocations: true,
      });

    // Verify anatomy structure
    await gameFlow.verifyAnatomyStructure(actorId, ['left_leg', 'right_leg']);
    await gameFlow.verifyAllLegsUnlocked(actorId);

    // Phase 2: Full interaction flow
    await gameFlow.moveActor(actorId, targetId);

    const kneelResult = await actionExecutor.execute(
      'positioning:kneel_before',
      {
        actorId: actorId,
        targetId: targetId,
      }
    );

    expect(kneelResult.success).toBe(true);

    // Verify all legs locked
    await gameFlow.verifyAllLegsLocked(actorId);

    // Movement blocked
    const blockedMove = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: locationB,
    });
    expect(blockedMove.success).toBe(false);

    // Stand and verify unlock
    const standResult = await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });
    expect(standResult.success).toBe(true);

    await gameFlow.verifyAllLegsUnlocked(actorId);

    // Movement allowed
    const allowedMove = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: locationB,
    });
    expect(allowedMove.success).toBe(true);
  });
});
```

#### 3.3 Multi-Actor Scenario

```javascript
describe('multi-actor scenarios', () => {
  it('should handle multiple actors with different entity types', async () => {
    // Setup: Mixed entity types
    const legacyActor = 'legacy-player';
    const anatomyActor = 'anatomy-npc';
    const targetId = 'shrine';

    await gameFlow.createActor(legacyActor, 'legacy');
    await gameFlow.createActor(anatomyActor, 'anatomy');
    await gameFlow.createTarget(targetId);

    // Both actors kneel
    await Promise.all([
      actionExecutor.execute('positioning:kneel_before', {
        actorId: legacyActor,
        targetId: targetId,
      }),
      actionExecutor.execute('positioning:kneel_before', {
        actorId: anatomyActor,
        targetId: targetId,
      }),
    ]);

    // Verify both locked
    await gameFlow.verifyMovementLocked(legacyActor);
    await gameFlow.verifyAllLegsLocked(anatomyActor);

    // One stands, one remains kneeling
    await actionExecutor.execute('positioning:stand_up', {
      actorId: legacyActor,
    });

    // Verify states are independent
    await gameFlow.verifyMovementUnlocked(legacyActor);
    await gameFlow.verifyAllLegsLocked(anatomyActor); // Still kneeling
  });
});
```

### 4. System Integration Validation

#### 4.1 Error Integration Test

```javascript
describe('error integration', () => {
  it('should handle errors gracefully throughout the system', async () => {
    // Test error propagation and recovery
    const actorId = 'error-test-actor';

    // Test 1: Missing target
    const missingTargetResult = await actionExecutor.execute(
      'positioning:kneel_before',
      {
        actorId: actorId,
        targetId: 'non-existent-target',
      }
    );

    expect(missingTargetResult.success).toBe(false);

    // Test 2: Invalid actor
    const invalidActorResult = await actionExecutor.execute(
      'positioning:kneel_before',
      {
        actorId: 'non-existent-actor',
        targetId: 'valid-target',
      }
    );

    expect(invalidActorResult.success).toBe(false);

    // Verify system remains stable
    await gameFlow.verifySystemStability();
  });
});
```

### 5. Quality Assurance Checklist

#### 5.1 Code Quality Validation

Create script or add to test: **`scripts/movementLockQualityCheck.js`**

```javascript
#!/usr/bin/env node
/**
 * Movement Lock Implementation Quality Check
 * Validates all aspects of the movement lock implementation
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔍 Movement Lock Quality Assurance Check');
console.log('=====================================');

const checks = {
  lint: () => {
    console.log('📋 Running ESLint...');
    execSync('npm run lint', { stdio: 'inherit' });
    console.log('✅ Lint passed\n');
  },

  format: () => {
    console.log('🎨 Running Prettier...');
    execSync('npm run format', { stdio: 'inherit' });
    console.log('✅ Format passed\n');
  },

  typecheck: () => {
    console.log('📝 Running TypeScript check...');
    execSync('npm run typecheck', { stdio: 'inherit' });
    console.log('✅ Type check passed\n');
  },

  unitTests: () => {
    console.log('🧪 Running unit tests...');
    execSync(
      'npm run test:unit tests/unit/logic/operationHandlers/*MovementHandler.test.js',
      { stdio: 'inherit' }
    );
    console.log('✅ Unit tests passed\n');
  },

  integrationTests: () => {
    console.log('🔧 Running integration tests...');
    execSync('npm run test:integration tests/integration/positioning/', {
      stdio: 'inherit',
    });
    console.log('✅ Integration tests passed\n');
  },

  e2eTests: () => {
    console.log('🌐 Running E2E tests...');
    execSync('npm run test:e2e tests/e2e/positioning/', { stdio: 'inherit' });
    console.log('✅ E2E tests passed\n');
  },

  coverage: () => {
    console.log('📊 Checking test coverage...');
    const result = execSync(
      'npm run test:ci -- --coverage --testPathPattern="MovementHandler"',
      {
        encoding: 'utf8',
      }
    );

    // Parse coverage report (implementation depends on your coverage tool)
    if (result.includes('90%') || result.includes('100%')) {
      console.log('✅ Coverage target met (90%+)\n');
    } else {
      throw new Error('❌ Coverage below 90%');
    }
  },

  fileValidation: () => {
    console.log('📁 Validating created files...');

    const requiredFiles = [
      'src/logic/operationHandlers/lockMovementHandler.js',
      'src/logic/operationHandlers/unlockMovementHandler.js',
      'tests/unit/logic/operationHandlers/lockMovementHandler.test.js',
      'tests/unit/logic/operationHandlers/unlockMovementHandler.test.js',
      'tests/integration/positioning/movementLockAnatomyEntities.test.js',
      'tests/integration/positioning/movementLockLegacyEntities.test.js',
      'tests/integration/positioning/movementLockEdgeCases.test.js',
      'tests/e2e/positioning/movementLockFlow.test.js',
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`❌ Required file missing: ${file}`);
      }
    }

    console.log('✅ All required files present\n');
  },

  registrationValidation: () => {
    console.log('🔗 Validating registrations...');

    // Check token definitions
    const tokensContent = fs.readFileSync(
      'src/dependencyInjection/tokens.js',
      'utf8'
    );
    if (
      !tokensContent.includes('LockMovementHandler') ||
      !tokensContent.includes('UnlockMovementHandler')
    ) {
      throw new Error('❌ Handler tokens not found in tokens.js');
    }

    // Check handler registrations
    const handlersContent = fs.readFileSync(
      'src/dependencyInjection/registrations/operationHandlerRegistrations.js',
      'utf8'
    );
    if (
      !handlersContent.includes('LockMovementHandler') ||
      !handlersContent.includes('UnlockMovementHandler')
    ) {
      throw new Error(
        '❌ Handlers not registered in operationHandlerRegistrations.js'
      );
    }

    // Check interpreter registrations
    const interpreterContent = fs.readFileSync(
      'src/dependencyInjection/registrations/interpreterRegistrations.js',
      'utf8'
    );
    if (
      !interpreterContent.includes('LOCK_MOVEMENT') ||
      !interpreterContent.includes('UNLOCK_MOVEMENT')
    ) {
      throw new Error(
        '❌ Operations not registered in interpreterRegistrations.js'
      );
    }

    console.log('✅ All registrations validated\n');
  },
};

try {
  // Run all checks
  Object.values(checks).forEach((check) => check());

  console.log('🎉 ALL QUALITY CHECKS PASSED!');
  console.log('✅ Movement Lock implementation is ready for production');
} catch (error) {
  console.error('❌ Quality check failed:', error.message);
  process.exit(1);
}
```

### 6. Manual Validation Steps

#### 6.1 Manual Test Protocol

Document manual testing steps:

1. **Browser Test Setup**:
   - Start application: `npm run dev`
   - Load game with positioning mod enabled
   - Create test scenario with both entity types

2. **Legacy Entity Manual Test**:
   - Create legacy actor
   - Use "kneel_before" action via console/UI
   - Verify movement actions are disabled
   - Use "stand_up" action
   - Verify movement actions are enabled

3. **Anatomy Entity Manual Test**:
   - Create anatomy-based actor
   - Repeat kneel/stand cycle
   - Verify individual leg components are locked/unlocked

4. **Performance Test**:
   - Create 10+ actors
   - Have all kneel simultaneously
   - Verify no performance degradation
   - Check browser console for errors

### 7. Implementation Checklist

- [ ] Create E2E test directory `tests/e2e/positioning/`
- [ ] Create E2E test file `movementLockFlow.test.js`
- [ ] Implement complete flow tests for legacy entities
- [ ] Implement complete flow tests for anatomy entities
- [ ] Implement multi-actor scenario tests
- [ ] Create quality assurance script
- [ ] Run all automated quality checks
- [ ] Perform manual validation tests
- [ ] Update documentation if needed
- [ ] Mark implementation as complete

## Validation Criteria

1. **All automated tests pass**: Unit, integration, and E2E tests
2. **Quality gates satisfied**: Lint, format, typecheck, coverage (90%+)
3. **Manual tests successful**: Both entity types work in browser
4. **Performance acceptable**: No degradation with multiple actors
5. **Error handling robust**: Graceful handling of edge cases
6. **Documentation complete**: All code properly documented

## Testing Requirements

```bash
# Run the complete test suite
npm run test:ci

# Run movement lock specific tests
npm run test:unit tests/unit/logic/operationHandlers/*MovementHandler.test.js
npm run test:integration tests/integration/positioning/
npm run test:e2e tests/e2e/positioning/

# Run quality checks
npm run lint
npm run format
npm run typecheck

# Run custom quality script
node scripts/movementLockQualityCheck.js
```

## Success Criteria

This ticket is complete when:

1. ✅ All automated tests pass
2. ✅ Code quality checks pass (lint, format, typecheck)
3. ✅ Test coverage ≥ 90% for new code
4. ✅ Manual browser testing successful
5. ✅ Performance testing shows no degradation
6. ✅ All 12 MOVLOCK tickets completed
7. ✅ System works for both legacy and anatomy entities
8. ✅ Error handling is robust and graceful

## Final Notes

- This ticket serves as the final quality gate for the entire movement lock feature
- All previous tickets (MOVLOCK-001 through MOVLOCK-011) must be completed
- The feature should be considered production-ready after this ticket passes
- Document any known limitations or future enhancement opportunities

## References

- Complete spec: `specs/movement-lock-implementation.spec.md`
- All previous MOVLOCK tickets
- Project testing guidelines: `CLAUDE.md` section on testing
- Quality standards: Project's testing and code quality requirements
