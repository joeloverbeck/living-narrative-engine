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
The ActionFormattingStage is part of the action processing pipeline that formats actions before they're presented to the UI. Currently, it doesn't pass visual properties through the pipeline. This ticket ensures visual properties flow from the action definition through the formatting stage to the ActionComposite DTO.

## Objectives
1. Update ActionFormattingStage to preserve visual properties from action definitions
2. Ensure visual data flows through the pipeline context
3. Pass visual properties when creating ActionComposite objects
4. Maintain pipeline performance and error handling

## Implementation Details

### File Modifications

#### 1. Update ActionFormattingStage
**File**: `src/actions/pipeline/stages/ActionFormattingStage.js`

**Current Structure Analysis**:
- Part of a multi-stage pipeline system
- Receives context object with action data
- Creates ActionComposite objects for formatted actions
- Uses the `createActionComposite` function from the DTO

**Changes Required**:

```javascript
// In the execute method of ActionFormattingStage class

async execute(context) {
  try {
    // ... existing validation and formatting logic ...

    // Extract visual properties from the action data
    // The visual property should be available in context.actionData
    const visual = context.actionData?.visual || null;

    // When creating the ActionComposite, include visual properties
    const actionComposite = createActionComposite({
      index: context.index,
      actionId: context.actionId,
      commandString: formattedCommand,
      params: context.formattedParams || {},
      description: context.description || '',
      visual: visual, // NEW: Pass visual properties
    });

    // Update the context with the composite
    context.actionComposite = actionComposite;

    // Return success result
    return {
      success: true,
      context: context,
    };
  } catch (error) {
    // Enhanced error handling for visual property issues
    if (error.message?.includes('visual properties')) {
      return {
        success: false,
        error: `Visual property formatting failed for action ${context.actionId}: ${error.message}`,
        context: context,
      };
    }
    
    // Existing error handling
    return {
      success: false,
      error: error.message,
      context: context,
    };
  }
}
```

#### 2. Ensure Pipeline Context Preservation
**Additional considerations for the pipeline**:

```javascript
// If there's a method that prepares or validates the context
validateContext(context) {
  // Existing validation...
  
  // NEW: Validate visual properties if present
  if (context.actionData?.visual) {
    // Basic structure validation (detailed validation in DTO)
    if (typeof context.actionData.visual !== 'object') {
      throw new Error('Visual properties must be an object');
    }
  }
  
  return true;
}

// If there's a method that transforms or enriches the context
enrichContext(context) {
  // Existing enrichment...
  
  // NEW: Preserve visual properties during enrichment
  if (context.actionData?.visual) {
    // Ensure visual properties aren't lost during transformations
    context.preservedVisual = context.actionData.visual;
  }
  
  return context;
}
```

### Integration Points

#### 1. Input Context Structure
The stage should expect context with this structure:
```javascript
{
  index: number,
  actionId: string,
  actionData: {
    // ... other action properties ...
    visual: {
      backgroundColor: string,
      textColor: string,
      hoverBackgroundColor: string,
      hoverTextColor: string
    } // optional
  },
  formattedParams: object,
  description: string
}
```

#### 2. Output Context Structure
The stage should produce context with:
```javascript
{
  // ... all input properties ...
  actionComposite: {
    index: number,
    actionId: string,
    commandString: string,
    params: object,
    description: string,
    visual: object // NEW: visual properties included
  }
}
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

// Use in the stage:
if (context.actionData?.visual && !isValidVisualStructure(context.actionData.visual)) {
  throw new VisualPropertyError(context.actionId, 'Invalid visual property structure');
}
```

### Performance Considerations

1. **Minimal Processing**: Visual properties should be passed through without transformation
2. **No Deep Cloning**: Use reference passing for visual objects (they're immutable in DTO)
3. **Early Validation**: Validate structure early to fail fast

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js`

```javascript
describe('ActionFormattingStage - Visual Properties', () => {
  let stage;
  let mockContext;

  beforeEach(() => {
    stage = new ActionFormattingStage(/* dependencies */);
    mockContext = {
      index: 0,
      actionId: 'test:action',
      actionData: {
        name: 'Test Action',
        template: 'test {target}'
      },
      formattedParams: { target: 'player' },
      description: 'Test action'
    };
  });

  describe('visual property handling', () => {
    it('should pass visual properties to ActionComposite', async () => {
      mockContext.actionData.visual = {
        backgroundColor: '#ff0000',
        textColor: '#ffffff'
      };

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.context.actionComposite.visual).toBeDefined();
      expect(result.context.actionComposite.visual.backgroundColor).toBe('#ff0000');
    });

    it('should handle missing visual properties', async () => {
      // No visual property in actionData
      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.context.actionComposite.visual).toBeNull();
    });

    it('should handle partial visual properties', async () => {
      mockContext.actionData.visual = {
        backgroundColor: '#ff0000'
        // No textColor
      };

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.context.actionComposite.visual.backgroundColor).toBe('#ff0000');
      expect(result.context.actionComposite.visual.textColor).toBeUndefined();
    });

    it('should handle visual property errors gracefully', async () => {
      mockContext.actionData.visual = {
        backgroundColor: 'invalid-color'
      };

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('visual');
    });
  });
});
```

## Acceptance Criteria

1. ✅ ActionFormattingStage extracts visual properties from action data
2. ✅ Visual properties are passed to createActionComposite function
3. ✅ Pipeline handles actions without visual properties (backward compatibility)
4. ✅ Pipeline handles partial visual properties correctly
5. ✅ Error handling includes visual property-specific errors
6. ✅ Context structure is documented and consistent
7. ✅ Unit tests verify visual property flow through the stage
8. ✅ Performance is not impacted (no deep cloning or heavy processing)

## Notes

- Visual properties should flow through unchanged - no transformation needed
- The stage should be defensive about missing or malformed visual data
- Consider logging when visual properties are processed for debugging
- This is a pass-through operation - actual validation happens in the DTO

## Related Tickets
- **Depends on**: ACTBUTVIS-002 (DTO must accept visual parameter)
- **Next**: ACTBUTVIS-005 (Action Loader), ACTBUTVIS-007 (UI Rendering)
- **Testing**: ACTBUTVIS-010 (Unit tests)

## References
- Pipeline Stage: `src/actions/pipeline/stages/ActionFormattingStage.js`
- ActionComposite DTO: `src/turns/dtos/actionComposite.js`
- Pipeline Architecture: Action processing pipeline documentation
- Original Spec: `specs/action-button-visual-customization.spec.md`