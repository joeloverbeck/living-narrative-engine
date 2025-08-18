# ACTBUTVIS-006: Enhance TurnActionFactory Integration (CORRECTED)

## Status

**Status**: Not Started  
**Priority**: Medium  
**Type**: Factory Enhancement  
**Estimated Effort**: 30 minutes

## Dependencies

- **Requires**: ACTBUTVIS-005 (Action Loader - already complete)
- **Blocks**: ACTBUTVIS-007 (UI Rendering)

## Context

The TurnActionFactory is a simple transformer that converts ActionComposite objects into ITurnAction objects. Visual properties are already present in ActionComposite objects (added by ActionLoader and createActionComposite), so the factory just needs to preserve them during transformation.

## Current Architecture

```
ActionLoader → ActionComposite (with visual) → TurnActionChoicePipeline → 
GenericTurnStrategy → TurnActionFactory.create() → ITurnAction
```

## Objectives

1. Update TurnActionFactory to preserve visual properties from ActionComposite
2. Ensure visual properties are included in ITurnAction objects
3. Add tests to verify visual property preservation
4. Maintain immutability via freeze()

## Implementation Details

### File Modifications

#### 1. Update TurnActionFactory

**File**: `src/turns/factories/turnActionFactory.js`

**Current Implementation**:
```javascript
export class TurnActionFactory extends ITurnActionFactory {
  create(composite, speech = null) {
    const obj = {
      actionDefinitionId: composite.actionId,
      resolvedParameters: composite.params,
      commandString: composite.commandString,
      ...(speech ? { speech: speech.trim() } : {}),
    };
    return freeze(obj);
  }
}
```

**Required Changes**:
```javascript
export class TurnActionFactory extends ITurnActionFactory {
  /**
   * Creates an {@link ITurnAction} instance from the provided action composite and optional speech.
   * Now preserves visual properties from the composite.
   *
   * @param {import('../dtos/actionComposite.js').ActionComposite} composite - The action composite.
   * @param {string|null} speech - Optional speech text.
   * @returns {import('../interfaces/IActorTurnStrategy.js').ITurnAction} The frozen turn action object.
   */
  create(composite, speech = null) {
    const obj = {
      actionDefinitionId: composite.actionId,
      resolvedParameters: composite.params,
      commandString: composite.commandString,
      // ADD: Preserve visual properties from composite
      ...(composite.visual ? { visual: composite.visual } : {}),
      ...(speech ? { speech: speech.trim() } : {}),
    };
    return freeze(obj);
  }
}
```

#### 2. Update ITurnAction Interface Documentation

**File**: `src/turns/interfaces/IActorTurnStrategy.js`

Add to the ITurnAction typedef (around line 7):
```javascript
/**
 * @property {VisualProperties} [visual] - Optional. Visual customization properties
 * for UI rendering. Contains colors for button styling (backgroundColor, textColor,
 * hoverBackgroundColor, hoverTextColor). Preserved from the ActionComposite.
 */
```

### Testing Requirements

#### Unit Tests

**File**: `tests/unit/turns/factories/turnActionFactory.test.js`

**Add these test cases**:

```javascript
import { test, describe, expect, beforeEach } from '@jest/globals';
import { TurnActionFactory } from '../../../../src/turns/factories/turnActionFactory.js';

describe('TurnActionFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new TurnActionFactory();
  });

  // ... existing tests ...

  describe('Visual Properties Preservation', () => {
    test('preserves visual properties from composite', () => {
      const composite = {
        actionId: 'test:action',
        params: { target: 'enemy' },
        commandString: 'attack enemy',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#ff6666',
          hoverTextColor: '#000000'
        },
        description: 'Test action',
        index: 1
      };

      const action = factory.create(composite);
      
      // Visual properties should be preserved
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#ff0000');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#ff6666');
      expect(action.visual.hoverTextColor).toBe('#000000');
      
      // Should be frozen
      expect(Object.isFrozen(action)).toBe(true);
      expect(Object.isFrozen(action.visual)).toBe(true);
    });

    test('handles composite without visual properties', () => {
      const composite = {
        actionId: 'test:action',
        params: {},
        commandString: 'wait',
        description: 'Wait action',
        index: 1
        // No visual property
      };

      const action = factory.create(composite);
      
      // Should not have visual property
      expect(action.visual).toBeUndefined();
      
      // Other properties should still be present
      expect(action.actionDefinitionId).toBe('test:action');
      expect(action.commandString).toBe('wait');
    });

    test('preserves visual properties with speech', () => {
      const composite = {
        actionId: 'test:speak',
        params: {},
        commandString: 'speak',
        visual: {
          backgroundColor: '#0000ff',
          textColor: '#ffff00'
        },
        description: 'Speak action',
        index: 1
      };

      const action = factory.create(composite, '  Hello world!  ');
      
      // Both visual and speech should be present
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#0000ff');
      expect(action.speech).toBe('Hello world!');
    });

    test('visual property with null value is not included', () => {
      const composite = {
        actionId: 'test:action',
        params: {},
        commandString: 'test',
        visual: null,
        description: 'Test',
        index: 1
      };

      const action = factory.create(composite);
      
      // null visual should not be included
      expect(action.visual).toBeUndefined();
      expect(action.hasOwnProperty('visual')).toBe(false);
    });
  });
});
```

## Acceptance Criteria

1. ✅ TurnActionFactory.create() preserves visual properties from ActionComposite
2. ✅ Visual properties are included in frozen ITurnAction objects
3. ✅ Factory handles composites without visual properties (undefined)
4. ✅ Factory handles null visual properties correctly
5. ✅ Visual properties remain frozen/immutable
6. ✅ Unit tests verify all visual property scenarios
7. ✅ No breaking changes to existing functionality
8. ✅ ITurnAction interface documentation updated

## Notes

- This is a minimal change - just pass through existing visual properties
- Visual properties are already validated in ActionComposite
- No need for enrichment, transformation, or validation in the factory
- The factory maintains its single responsibility: transform ActionComposite → ITurnAction
- Visual properties flow: Action definition → ActionLoader → ActionComposite → TurnActionFactory → ITurnAction → UI

## Verification Steps

1. Run existing tests to ensure no regression:
   ```bash
   npm run test:unit -- turnActionFactory
   ```

2. Run new visual property tests:
   ```bash
   npm run test:unit -- turnActionFactory --grep "Visual Properties"
   ```

3. Run integration tests to verify end-to-end flow:
   ```bash
   npm run test:integration -- turns
   ```

## Related Tickets

- **Depends on**: ACTBUTVIS-005 (Action Loader provides visual in ActionComposite)
- **Next**: ACTBUTVIS-007 (UI rendering of visual properties from ITurnAction)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References

- Factory Location: `src/turns/factories/turnActionFactory.js`
- ActionComposite: `src/turns/dtos/actionComposite.js`
- ITurnAction Interface: `src/turns/interfaces/IActorTurnStrategy.js`
- Original Spec: `specs/action-button-visual-customization.spec.md`