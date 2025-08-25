# ENTDESCREG-006: Create Integration Tests

**Priority**: High  
**Dependencies**: ENTDESCREG-004 (Rule Integration)  
**Estimated Effort**: 1 day

## Overview

Create comprehensive integration tests to verify the complete clothing description workflow, ensuring the `REGENERATE_DESCRIPTION` operation integrates correctly with the existing clothing system and rule processing.

## Background

Integration tests validate that the new description regeneration functionality works correctly within the full system context, including rule processing, entity management, and component interactions.

## Acceptance Criteria

- [ ] Create integration test suite for clothing-description workflow
- [ ] Test complete rule execution with description regeneration
- [ ] Verify description updates reflect actual clothing changes
- [ ] Test integration with existing clothing system components
- [ ] Test complex scenarios with multiple operations
- [ ] Ensure no regressions in existing functionality
- [ ] All integration tests pass consistently

## Technical Requirements

### Files to Create

**`tests/integration/clothing/clothingDescriptionIntegration.test.js`**

### Test Suite Structure

#### Import and Setup

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { createMockGame } from '../../common/mockGameSetup.js';

describe('Clothing Description Integration', () => {
  let testBed;
  let gameContext;
  let entityManager;
  let ruleProcessor;
  let bodyDescriptionComposer;

  beforeEach(async () => {
    testBed = createTestBed();
    gameContext = await createMockGame({
      mods: ['core', 'clothing'],
      includeRules: true,
      includeSchemas: true,
    });
    // Setup test entities and clothing items
  });

  afterEach(() => {
    testBed.cleanup();
  });
});
```

### Required Test Categories

#### 1. Single Item Removal Tests

```javascript
describe('Single Clothing Item Removal', () => {
  it('should update description after removing single clothing item', async () => {
    // Setup: Entity with clothing equipped and initial description
    const actor = testBed.createEntity('test-actor');
    const hat = testBed.createClothingItem('hat', 'A stylish hat');

    // Equip clothing and generate initial description
    await clothingSystem.equipClothing(actor.id, hat.id);
    const initialDescription =
      await bodyDescriptionComposer.composeDescription(actor);

    // Action: Execute clothing removal action
    const removeAction = {
      type: 'clothing:remove_clothing',
      payload: {
        actorId: actor.id,
        targetId: hat.id,
      },
    };

    await ruleProcessor.processAction(removeAction);

    // Verify: Description updated to reflect removed item
    const updatedDescription = actor.getComponent('core:description').text;
    expect(updatedDescription).not.toBe(initialDescription);
    expect(updatedDescription).not.toContain('hat');

    // Verify: Clothing was actually removed
    expect(actor.getComponent('clothing:equipped')).not.toContain(hat.id);
  });

  it('should handle removal from different body locations', async () => {
    // Test removing items from head, torso, legs, feet
    // Verify description updates correctly for each location
  });
});
```

#### 2. Multiple Item Operations

```javascript
describe('Multiple Clothing Operations', () => {
  it('should update description after removing multiple items', async () => {
    // Setup: Entity with multiple clothing items equipped
    const actor = testBed.createEntity('test-actor');
    const items = [
      testBed.createClothingItem('hat', 'A hat'),
      testBed.createClothingItem('shirt', 'A shirt'),
      testBed.createClothingItem('pants', 'Pants'),
    ];

    // Equip all items
    for (const item of items) {
      await clothingSystem.equipClothing(actor.id, item.id);
    }

    // Remove items in sequence
    for (const item of items) {
      await ruleProcessor.processAction({
        type: 'clothing:remove_clothing',
        payload: { actorId: actor.id, targetId: item.id },
      });
    }

    // Verify: Final description reflects all changes
    const finalDescription = actor.getComponent('core:description').text;
    expect(finalDescription).not.toContain('hat');
    expect(finalDescription).not.toContain('shirt');
    expect(finalDescription).not.toContain('pants');
  });

  it('should handle rapid successive clothing changes', async () => {
    // Test multiple quick operations
    // Verify description consistency
  });
});
```

#### 3. Complex Entity Scenarios

```javascript
describe('Complex Entity Scenarios', () => {
  it('should integrate with other entity modifications', async () => {
    // Setup: Complex entity state with multiple components
    const actor = testBed.createComplexEntity({
      anatomy: 'human',
      clothing: ['hat', 'shirt'],
      attributes: { health: 100 },
      position: 'bedroom',
    });

    // Action: Mixed operations including clothing changes
    await ruleProcessor.processBatch([
      {
        type: 'clothing:remove_clothing',
        payload: { actorId: actor.id, targetId: 'hat' },
      },
      {
        type: 'core:move_entity',
        payload: { entityId: actor.id, destination: 'kitchen' },
      },
      {
        type: 'clothing:remove_clothing',
        payload: { actorId: actor.id, targetId: 'shirt' },
      },
    ]);

    // Verify: Description updates don't interfere with other changes
    expect(actor.getComponent('core:position').location).toBe('kitchen');
    expect(actor.getComponent('core:description').text).not.toContain('hat');
    expect(actor.getComponent('core:description').text).not.toContain('shirt');
  });

  it('should handle entities with complex anatomy configurations', async () => {
    // Test with non-human anatomy
    // Test with missing body parts
    // Test with custom anatomy configurations
  });
});
```

#### 4. Rule Processing Integration

```javascript
describe('Rule Processing Integration', () => {
  it('should execute full rule processing correctly', async () => {
    // Setup: Complete game context with rules loaded
    const gameState = await testBed.createGameState({
      entities: [testBed.createActorWithClothing()],
      rules: ['handle_remove_clothing'],
      systems: ['clothing', 'description'],
    });

    // Action: Execute full clothing removal rule
    const result = await ruleProcessor.processRule('handle_remove_clothing', {
      event: {
        type: 'clothing:remove_clothing',
        payload: { actorId: 'test-actor', targetId: 'test-hat' },
      },
    });

    // Verify: All rule operations executed successfully
    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(7); // Including new REGENERATE_DESCRIPTION

    // Verify: Description regeneration occurred in correct sequence
    const descriptionOp = result.operations.find(
      (op) => op.type === 'REGENERATE_DESCRIPTION'
    );
    expect(descriptionOp).toBeDefined();
    expect(descriptionOp.success).toBe(true);
  });

  it('should maintain rule execution order', async () => {
    // Verify operations execute in correct sequence
    // Test that description regeneration happens after clothing removal
  });

  it('should handle rule processing errors gracefully', async () => {
    // Test scenarios where description regeneration fails
    // Verify rule continues and completes other operations
  });
});
```

#### 5. System Component Integration

```javascript
describe('System Component Integration', () => {
  it('should integrate correctly with EntityManager', async () => {
    // Test entity retrieval and component updates
    // Verify component changes persist correctly
  });

  it('should integrate correctly with BodyDescriptionComposer', async () => {
    // Test description generation with real composer
    // Verify descriptions reflect actual entity state
  });

  it('should integrate correctly with clothing system', async () => {
    // Test interaction with existing clothing operations
    // Verify no interference with clothing mechanics
  });
});
```

## Test Data Requirements

### Test Entities

- Actors with various anatomy configurations
- Clothing items with different properties and locations
- Complex entity hierarchies with multiple components

### Test Scenarios

- Single clothing removal
- Multiple clothing removals
- Mixed operation sequences
- Error conditions and recovery

### Game State Setup

- Complete mod loading (core + clothing)
- Rule processing system initialization
- Schema validation system setup
- All required services registered

## Integration Points to Test

### Core Systems

- Rule processing and operation execution
- Entity management and component updates
- Schema validation and operation routing
- Event dispatching and error handling

### Clothing System

- Equipment tracking and updates
- Clothing item management
- Body location mapping
- Cascade unequipping behavior

### Description System

- Body description composition
- Component updates and persistence
- Description consistency and accuracy

## Definition of Done

- [ ] Complete integration test suite covering all major scenarios
- [ ] All tests pass consistently across multiple runs
- [ ] Tests verify complete workflow from action to description update
- [ ] Complex scenarios and edge cases covered
- [ ] Integration with existing systems verified
- [ ] No regressions detected in existing functionality
- [ ] Test execution time reasonable (<30 seconds total)

## Performance Considerations

- [ ] Integration tests complete within acceptable time limits
- [ ] Memory usage remains stable during test execution
- [ ] No resource leaks detected during test runs
- [ ] Batch operations perform efficiently

## Related Specification Sections

- **Section 4.2**: Integration Tests requirements
- **Section 2.1**: System Integration design
- **Section 5.1**: Functional Requirements validation
- **Section 5.4**: Regression Prevention

## Next Steps

After completion, run in parallel with:

- **ENTDESCREG-007** (E2E Tests)

Then proceed to quality assurance phase starting with **ENTDESCREG-008**.
