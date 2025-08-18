# ACTBUTVIS-006: Enhance TurnActionFactory Integration

## Status
**Status**: Not Started  
**Priority**: Medium  
**Type**: Factory Enhancement  
**Estimated Effort**: 2 hours  

## Dependencies
- **Requires**: ACTBUTVIS-005 (Action Loader)
- **Blocks**: ACTBUTVIS-007 (UI Rendering)

## Context
The TurnActionFactory is responsible for creating turn-specific action instances from action definitions. It needs to ensure visual properties flow from the loaded action definitions through to the action instances that are processed by the pipeline.

## Objectives
1. Update TurnActionFactory to preserve visual properties
2. Ensure visual data flows from action definitions to action instances
3. Maintain immutability and data integrity
4. Support dynamic action creation with visual properties

## Implementation Details

### File Modifications

#### 1. Update TurnActionFactory
**File**: `src/turns/factories/turnActionFactory.js`

**Current Structure Analysis**:
- Creates action instances for the current turn
- Pulls action definitions from the registry
- Applies context-specific modifications
- Returns action objects for the pipeline

**Changes Required**:

```javascript
/**
 * Factory for creating turn-specific action instances
 */
class TurnActionFactory {
  constructor({ dataRegistry, logger, entityManager }) {
    this.dataRegistry = dataRegistry;
    this.logger = logger;
    this.entityManager = entityManager;
  }

  /**
   * Create a turn action from an action definition
   * @param {string} actionId - The action ID
   * @param {Object} context - Turn context (actor, target, etc.)
   * @returns {Object} Turn action instance
   */
  createTurnAction(actionId, context) {
    try {
      // Fetch the action definition from registry
      const actionDefinition = this.dataRegistry.get(`actions.${actionId}`);
      
      if (!actionDefinition) {
        throw new Error(`Action definition not found: ${actionId}`);
      }

      // Create the turn action instance
      const turnAction = {
        // Core properties
        id: actionId,
        name: actionDefinition.name,
        description: actionDefinition.description,
        template: actionDefinition.template,
        
        // NEW: Include visual properties from definition
        visual: actionDefinition.visual || null,
        
        // Context-specific properties
        actor: context.actor,
        target: context.target,
        params: this.resolveParams(actionDefinition.params, context),
        
        // Execution properties
        conditions: actionDefinition.conditions,
        effects: actionDefinition.effects,
        category: actionDefinition.category,
        priority: actionDefinition.priority,
        
        // Metadata
        turnNumber: context.turnNumber,
        timestamp: Date.now(),
        _source: actionDefinition._source
      };

      // Validate the created action
      this.validateTurnAction(turnAction);

      // Log if visual properties are present
      if (turnAction.visual) {
        this.logger.debug(
          `Created turn action "${actionId}" with visual properties`,
          turnAction.visual
        );
      }

      return turnAction;
    } catch (error) {
      this.logger.error(`Failed to create turn action: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create multiple turn actions for available actions
   * @param {Array} availableActionIds - List of available action IDs
   * @param {Object} context - Turn context
   * @returns {Array} Array of turn actions
   */
  createTurnActions(availableActionIds, context) {
    const turnActions = [];
    const errors = [];

    for (const actionId of availableActionIds) {
      try {
        const turnAction = this.createTurnAction(actionId, context);
        turnActions.push(turnAction);
      } catch (error) {
        errors.push({
          actionId,
          error: error.message
        });
      }
    }

    // Report visual properties statistics
    const visualCount = turnActions.filter(a => a.visual).length;
    if (visualCount > 0) {
      this.logger.debug(
        `${visualCount} of ${turnActions.length} turn actions have visual properties`
      );
    }

    if (errors.length > 0) {
      this.logger.warn('Failed to create some turn actions:', errors);
    }

    return turnActions;
  }

  /**
   * Enrich turn action with additional data
   * @param {Object} turnAction - The turn action to enrich
   * @returns {Object} Enriched turn action
   */
  enrichTurnAction(turnAction) {
    // Add computed properties
    const enriched = {
      ...turnAction,
      
      // Compute display text
      displayText: this.computeDisplayText(turnAction),
      
      // Compute availability
      isAvailable: this.checkAvailability(turnAction),
      
      // NEW: Ensure visual properties are preserved during enrichment
      visual: turnAction.visual || null,
      
      // Add any dynamic visual modifications
      dynamicVisual: this.computeDynamicVisual(turnAction)
    };

    return enriched;
  }

  /**
   * Compute dynamic visual properties based on context
   * @private
   * @param {Object} turnAction - The turn action
   * @returns {Object|null} Dynamic visual properties
   */
  computeDynamicVisual(turnAction) {
    // This allows for context-based visual modifications
    // For example, graying out unavailable actions
    
    if (!turnAction.isAvailable && turnAction.visual) {
      // Create a dimmed version of the visual properties
      return {
        ...turnAction.visual,
        backgroundColor: this.dimColor(turnAction.visual.backgroundColor),
        textColor: this.dimColor(turnAction.visual.textColor)
      };
    }

    return null;
  }

  /**
   * Dim a color value (simple opacity reduction)
   * @private
   * @param {string} color - CSS color value
   * @returns {string} Dimmed color
   */
  dimColor(color) {
    if (!color) return color;
    
    // For hex colors, add transparency
    if (color.startsWith('#')) {
      return color + '80'; // 50% opacity
    }
    
    // For rgb, convert to rgba with opacity
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', ', 0.5)');
    }
    
    // Return as-is for other formats
    return color;
  }

  /**
   * Validate a turn action has required properties
   * @private
   * @param {Object} turnAction - The turn action to validate
   * @throws {Error} If validation fails
   */
  validateTurnAction(turnAction) {
    if (!turnAction.id) {
      throw new Error('Turn action missing required property: id');
    }
    
    if (!turnAction.template) {
      throw new Error('Turn action missing required property: template');
    }

    // Visual properties are optional, but validate structure if present
    if (turnAction.visual && typeof turnAction.visual !== 'object') {
      throw new Error('Turn action visual property must be an object');
    }
  }

  /**
   * Clone a turn action with modifications
   * @param {Object} turnAction - Original turn action
   * @param {Object} modifications - Properties to modify
   * @returns {Object} Cloned and modified turn action
   */
  cloneTurnAction(turnAction, modifications = {}) {
    return {
      ...turnAction,
      ...modifications,
      
      // NEW: Ensure visual properties are deep cloned if modified
      visual: modifications.visual !== undefined
        ? modifications.visual
        : turnAction.visual ? { ...turnAction.visual } : null
    };
  }
}

export default TurnActionFactory;
```

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/turns/factories/turnActionFactory.test.js`

```javascript
describe('TurnActionFactory - Visual Properties', () => {
  let factory;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    mockDataRegistry = {
      get: jest.fn()
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    factory = new TurnActionFactory({
      dataRegistry: mockDataRegistry,
      logger: mockLogger
    });
  });

  describe('createTurnAction with visual properties', () => {
    it('should preserve visual properties from definition', () => {
      const actionDefinition = {
        id: 'test:action',
        name: 'Test Action',
        template: 'test {target}',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff'
        }
      };

      mockDataRegistry.get.mockReturnValue(actionDefinition);

      const turnAction = factory.createTurnAction('test:action', {
        actor: 'player',
        target: 'enemy'
      });

      expect(turnAction.visual).toBeDefined();
      expect(turnAction.visual.backgroundColor).toBe('#ff0000');
      expect(turnAction.visual.textColor).toBe('#ffffff');
    });

    it('should handle missing visual properties', () => {
      const actionDefinition = {
        id: 'test:action',
        name: 'Test Action',
        template: 'test {target}'
        // No visual property
      };

      mockDataRegistry.get.mockReturnValue(actionDefinition);

      const turnAction = factory.createTurnAction('test:action', {
        actor: 'player',
        target: 'enemy'
      });

      expect(turnAction.visual).toBeNull();
    });
  });

  describe('enrichTurnAction', () => {
    it('should preserve visual properties during enrichment', () => {
      const turnAction = {
        id: 'test:action',
        template: 'test',
        visual: {
          backgroundColor: '#ff0000'
        },
        isAvailable: true
      };

      factory.checkAvailability = jest.fn().mockReturnValue(true);
      factory.computeDisplayText = jest.fn().mockReturnValue('Test');

      const enriched = factory.enrichTurnAction(turnAction);

      expect(enriched.visual).toBeDefined();
      expect(enriched.visual.backgroundColor).toBe('#ff0000');
    });

    it('should compute dynamic visual for unavailable actions', () => {
      const turnAction = {
        id: 'test:action',
        template: 'test',
        visual: {
          backgroundColor: '#ff0000',
          textColor: 'rgb(255, 255, 255)'
        },
        isAvailable: false
      };

      factory.checkAvailability = jest.fn().mockReturnValue(false);
      factory.computeDisplayText = jest.fn().mockReturnValue('Test');

      const enriched = factory.enrichTurnAction(turnAction);

      expect(enriched.dynamicVisual).toBeDefined();
      expect(enriched.dynamicVisual.backgroundColor).toBe('#ff000080');
      expect(enriched.dynamicVisual.textColor).toBe('rgba(255, 255, 255, 0.5)');
    });
  });

  describe('cloneTurnAction', () => {
    it('should deep clone visual properties', () => {
      const original = {
        id: 'test:action',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff'
        }
      };

      const cloned = factory.cloneTurnAction(original);

      // Should be a different object
      expect(cloned.visual).not.toBe(original.visual);
      
      // But with same values
      expect(cloned.visual.backgroundColor).toBe('#ff0000');
    });

    it('should allow visual property modifications', () => {
      const original = {
        id: 'test:action',
        visual: {
          backgroundColor: '#ff0000'
        }
      };

      const cloned = factory.cloneTurnAction(original, {
        visual: {
          backgroundColor: '#00ff00'
        }
      });

      expect(cloned.visual.backgroundColor).toBe('#00ff00');
      expect(original.visual.backgroundColor).toBe('#ff0000'); // Original unchanged
    });
  });

  describe('createTurnActions batch', () => {
    it('should report visual properties count', () => {
      const actions = [
        { id: 'action1', visual: { backgroundColor: '#ff0000' } },
        { id: 'action2', visual: { textColor: '#ffffff' } },
        { id: 'action3' } // No visual
      ];

      mockDataRegistry.get
        .mockReturnValueOnce(actions[0])
        .mockReturnValueOnce(actions[1])
        .mockReturnValueOnce(actions[2]);

      factory.createTurnActions(['action1', 'action2', 'action3'], {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('2 of 3 turn actions have visual properties')
      );
    });
  });
});
```

## Acceptance Criteria

1. ✅ TurnActionFactory preserves visual properties from action definitions
2. ✅ Visual properties flow through to turn action instances
3. ✅ Factory handles actions without visual properties (null)
4. ✅ Enrichment process preserves visual properties
5. ✅ Dynamic visual computation for context-based styling
6. ✅ Clone operations properly handle visual properties
7. ✅ Batch creation reports visual property statistics
8. ✅ Unit tests cover all visual property scenarios
9. ✅ Proper logging for debugging visual properties

## Notes

- Visual properties should be treated as immutable
- Dynamic visual allows for runtime modifications without changing definitions
- Consider caching turn actions with visual properties for performance
- The factory should be defensive about missing or malformed data

## Related Tickets
- **Depends on**: ACTBUTVIS-005 (Action Loader must provide visual in definitions)
- **Next**: ACTBUTVIS-007 (UI rendering of visual properties)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References
- Factory Location: `src/turns/factories/turnActionFactory.js`
- Data Registry: `src/data/inMemoryDataRegistry.js`
- Turn Context: `src/turns/turnContext.js`
- Original Spec: `specs/action-button-visual-customization.spec.md`