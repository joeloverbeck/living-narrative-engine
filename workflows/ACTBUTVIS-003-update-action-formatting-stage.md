# ACTBUTVIS-003: Update ActionFormattingStage Pipeline

## Status
**Status**: Not Started  
**Priority**: High  
**Type**: Pipeline Enhancement  
**Estimated Effort**: 2 hours  

## Dependencies
- **Requires**: ACTBUTVIS-001 (Schema), ACTBUTVIS-002 (DTO)
- **Blocks**: ACTBUTVIS-007 (UI Rendering)

## Context
The ActionFormattingStage is part of the action processing pipeline that formats actions before they're presented to the UI. Currently, it creates intermediate `actionInfo` objects but doesn't include visual properties from action definitions. This ticket ensures visual properties from `actionDef.visual` flow through the `actionInfo` objects to eventually reach the ActionComposite DTO.

**Key Architecture Note**: ActionFormattingStage creates `actionInfo` objects, not ActionComposite objects directly. ActionComposite objects are created elsewhere in the pipeline from the actionInfo data.

## Objectives
1. Update ActionFormattingStage to preserve visual properties from action definitions (`actionDef.visual`)
2. Ensure visual data flows through the `actionInfo` objects
3. Pass visual properties in `actionInfo` objects for downstream ActionComposite creation
4. Maintain pipeline performance and error handling

## Implementation Details

### File Modifications

#### 1. Update ActionFormattingStage
**File**: `src/actions/pipeline/stages/ActionFormattingStage.js`

**Current Structure Analysis**:
- Part of a multi-stage pipeline system
- Receives context object with action data
- Creates intermediate `actionInfo` objects (NOT ActionComposite objects directly)
- ActionComposite objects are created elsewhere from the actionInfo data
- Multiple locations create actionInfo objects throughout the file

**Changes Required**:

```javascript
// In all locations where actionInfo objects are created in ActionFormattingStage
// Multiple locations need this pattern (lines 384-390, 446-452, 508-514, etc.)

// BEFORE: Current actionInfo creation pattern
const actionInfo = {
  id: actionDef.id,
  name: actionDef.name,
  command: formatResult.value,
  description: actionDef.description || '',
  params: { targetId: targetContext.entityId },
};

// AFTER: Updated actionInfo creation pattern with visual properties
const actionInfo = {
  id: actionDef.id,
  name: actionDef.name,
  command: formatResult.value,
  description: actionDef.description || '',
  params: { targetId: targetContext.entityId },
  visual: actionDef.visual || null, // NEW: Extract from actionDef.visual
};

formattedActions.push(actionInfo);
```

**Key Implementation Notes**:
1. Visual properties are extracted from `actionDef.visual` (not `context.actionData.visual`)
2. All 13+ locations where actionInfo objects are created need this update
3. The visual property flows through actionInfo → ActionComposite conversion elsewhere
4. No direct ActionComposite creation happens in ActionFormattingStage

#### 2. Error Handling for Visual Properties
**Additional considerations for actionDef validation**:

```javascript
// Validate actionDef before processing
validateActionDef(actionDef) {
  // Existing validation...
  
  // NEW: Validate visual properties if present
  if (actionDef.visual) {
    // Basic structure validation (detailed validation in ActionComposite DTO)
    if (typeof actionDef.visual !== 'object' || actionDef.visual === null) {
      throw new Error(`Invalid visual properties for action ${actionDef.id}: must be object or undefined`);
    }
    
    // Optional: Validate CSS color format if present
    if (actionDef.visual.backgroundColor && !isValidColor(actionDef.visual.backgroundColor)) {
      this.#logger.warn(`Invalid backgroundColor for action ${actionDef.id}: ${actionDef.visual.backgroundColor}`);
    }
  }
  
  return true;
}

// Helper function for color validation
function isValidColor(color) {
  // Basic validation for hex colors and CSS color names
  return /^#[0-9A-F]{6}$/i.test(color) || 
         /^#[0-9A-F]{3}$/i.test(color) || 
         ['red', 'blue', 'green', 'white', 'black'].includes(color.toLowerCase());
}
```

### Integration Points

#### 1. Action Definition Structure
The stage processes `actionDef` objects with this structure:
```javascript
// actionDef structure (from action definition files)
{
  id: string,
  name: string,
  template: string,
  description: string,
  visual: { // optional - NEW visual properties
    backgroundColor: string,
    textColor: string, 
    hoverBackgroundColor: string,
    hoverTextColor: string
  }
}

// targetContext structure (existing)
{
  entityId: string,
  // ... other context properties
}
```

#### 2. Output actionInfo Structure
The stage produces `actionInfo` objects with:
```javascript
// actionInfo structure added to formattedActions array
{
  id: string,          // from actionDef.id
  name: string,        // from actionDef.name
  command: string,     // from formatResult.value
  description: string, // from actionDef.description
  params: object,      // contains targetId and other parameters
  visual: object       // NEW: from actionDef.visual (or null if not present)
}

// These actionInfo objects flow through pipeline to eventually become ActionComposite objects
```

### Error Handling

Add specific error handling for visual property issues:

```javascript
class VisualPropertyError extends Error {
  constructor(actionId, details) {
    super(`Visual property error for action ${actionId}: ${details}`);
    this.name = 'VisualPropertyError';
    this.actionId = actionId;
  }
}

// Use in the stage when processing actionDef:
if (actionDef.visual && !isValidVisualStructure(actionDef.visual)) {
  throw new VisualPropertyError(actionDef.id, 'Invalid visual property structure');
}

// Helper function
function isValidVisualStructure(visual) {
  return typeof visual === 'object' && 
         visual !== null &&
         (visual.backgroundColor === undefined || typeof visual.backgroundColor === 'string') &&
         (visual.textColor === undefined || typeof visual.textColor === 'string');
}
```

### Performance Considerations

1. **Minimal Processing**: Visual properties should be passed through from actionDef to actionInfo without transformation
2. **No Deep Cloning**: Use reference passing for visual objects (they're validated in ActionComposite DTO)
3. **Early Validation**: Validate actionDef.visual structure early to fail fast
4. **Multiple Locations**: Remember to update ALL locations where actionInfo objects are created

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js`

```javascript
describe('ActionFormattingStage - Visual Properties', () => {
  let stage;
  let mockActionDef;
  let mockTargetContext;
  let mockFormatResult;

  beforeEach(() => {
    stage = new ActionFormattingStage(/* dependencies */);
    mockActionDef = {
      id: 'test:action',
      name: 'Test Action',
      template: 'test {target}',
      description: 'Test action description'
    };
    mockTargetContext = {
      entityId: 'player_entity'
    };
    mockFormatResult = {
      value: 'formatted command string'
    };
  });

  describe('actionInfo visual property handling', () => {
    it('should include visual properties in actionInfo objects', () => {
      mockActionDef.visual = {
        backgroundColor: '#ff0000',
        textColor: '#ffffff'
      };

      // Test the actionInfo creation pattern
      const actionInfo = {
        id: mockActionDef.id,
        name: mockActionDef.name,
        command: mockFormatResult.value,
        description: mockActionDef.description || '',
        params: { targetId: mockTargetContext.entityId },
        visual: mockActionDef.visual || null
      };

      expect(actionInfo.visual).toBeDefined();
      expect(actionInfo.visual.backgroundColor).toBe('#ff0000');
      expect(actionInfo.visual.textColor).toBe('#ffffff');
    });

    it('should handle missing visual properties with null', () => {
      // No visual property in actionDef
      const actionInfo = {
        id: mockActionDef.id,
        name: mockActionDef.name,
        command: mockFormatResult.value,
        description: mockActionDef.description || '',
        params: { targetId: mockTargetContext.entityId },
        visual: mockActionDef.visual || null
      };

      expect(actionInfo.visual).toBeNull();
    });

    it('should handle partial visual properties', () => {
      mockActionDef.visual = {
        backgroundColor: '#ff0000'
        // No textColor
      };

      const actionInfo = {
        id: mockActionDef.id,
        name: mockActionDef.name,
        command: mockFormatResult.value,
        description: mockActionDef.description || '',
        params: { targetId: mockTargetContext.entityId },
        visual: mockActionDef.visual || null
      };

      expect(actionInfo.visual.backgroundColor).toBe('#ff0000');
      expect(actionInfo.visual.textColor).toBeUndefined();
    });

    it('should validate actionDef.visual structure early', () => {
      mockActionDef.visual = 'invalid-visual-data'; // Should be object

      expect(() => {
        // This would be called in the stage validation
        if (mockActionDef.visual && typeof mockActionDef.visual !== 'object') {
          throw new Error(`Invalid visual properties for action ${mockActionDef.id}: must be object`);
        }
      }).toThrow('Invalid visual properties');
    });

    it('should test integration with formattedActions array', () => {
      mockActionDef.visual = {
        backgroundColor: '#00ff00'
      };

      const formattedActions = [];
      
      // Simulate the actual pattern used in ActionFormattingStage
      const actionInfo = {
        id: mockActionDef.id,
        name: mockActionDef.name,
        command: mockFormatResult.value,
        description: mockActionDef.description || '',
        params: { targetId: mockTargetContext.entityId },
        visual: mockActionDef.visual || null
      };
      
      formattedActions.push(actionInfo);

      expect(formattedActions).toHaveLength(1);
      expect(formattedActions[0].visual.backgroundColor).toBe('#00ff00');
    });
  });
});
```

## Acceptance Criteria

1. ✅ ActionFormattingStage extracts visual properties from actionDef.visual
2. ✅ Visual properties are included in actionInfo objects (all 13+ creation locations)
3. ✅ Pipeline handles actions without visual properties (backward compatibility - null value)
4. ✅ Pipeline handles partial visual properties correctly
5. ✅ Error handling includes actionDef.visual validation
6. ✅ actionInfo structure is documented and consistent
7. ✅ Unit tests verify visual property inclusion in actionInfo objects
8. ✅ Performance is not impacted (reference passing, no transformation)

## Notes

- Visual properties should flow from actionDef.visual to actionInfo.visual unchanged
- The stage should handle missing visual properties gracefully (set to null)
- All 13+ actionInfo creation locations need the visual property addition
- Early validation of actionDef.visual structure prevents downstream issues
- Actual detailed validation still happens in ActionComposite DTO
- Remember: ActionFormattingStage creates actionInfo, not ActionComposite objects

## Related Tickets
- **Depends on**: ACTBUTVIS-002 (DTO must accept visual parameter)
- **Next**: ACTBUTVIS-005 (Action Loader), ACTBUTVIS-007 (UI Rendering)
- **Testing**: ACTBUTVIS-010 (Unit tests)

## References
- Pipeline Stage: `src/actions/pipeline/stages/ActionFormattingStage.js`
- ActionComposite DTO: `src/turns/dtos/actionComposite.js`
- Pipeline Architecture: Action processing pipeline documentation
- Original Spec: `specs/action-button-visual-customization.spec.md`