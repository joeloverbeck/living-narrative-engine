# ACTBUTVIS-005: Update Action Loader for Visual Properties

## Status
**Status**: Not Started  
**Priority**: High  
**Type**: Loader Enhancement  
**Estimated Effort**: 2 hours  

## Dependencies
- **Requires**: ACTBUTVIS-001 (Schema), ACTBUTVIS-004 (Validation)
- **Blocks**: ACTBUTVIS-006 (Factory), ACTBUTVIS-011 (Integration Tests)

## Context
The ActionLoader is responsible for loading action definitions from JSON files and validating them against the schema. It needs to be updated to properly load and validate visual properties, ensuring they flow through to the action processing pipeline.

## Objectives
1. Update ActionLoader to preserve visual properties during loading
2. Integrate visual properties validation during load process
3. Ensure visual data is included in loaded action objects
4. Maintain backward compatibility with existing actions

## Implementation Details

### File Modifications

#### 1. Update Action Loader
**File**: `src/loaders/actionLoader.js`

**Current Structure Analysis**:
- Extends from a base loader class
- Uses AJV for schema validation
- Returns action objects to be stored in registry

**Changes Required**:

```javascript
import { validateVisualProperties } from '../validation/visualPropertiesValidator.js';

class ActionLoader extends BaseManifestItemLoader {
  constructor({ schemaValidator, logger, dataRegistry }) {
    super({ schemaValidator, logger });
    this.dataRegistry = dataRegistry;
  }

  /**
   * Load and validate an action definition
   * @param {Object} actionData - Raw action data from JSON
   * @param {string} modId - The mod ID this action belongs to
   * @returns {Object} Validated action object
   */
  async loadItem(actionData, modId) {
    try {
      // Existing schema validation
      const validationResult = await this.schemaValidator.validate(
        actionData,
        'action.schema.json'
      );

      if (!validationResult.valid) {
        throw new Error(`Schema validation failed: ${validationResult.errors.join(', ')}`);
      }

      // NEW: Additional visual properties validation if present
      if (actionData.visual) {
        try {
          // Use the centralized validator
          const validatedVisual = validateVisualProperties(
            actionData.visual,
            actionData.id || 'unknown'
          );
          
          // Replace with validated version (may have warnings logged)
          actionData.visual = validatedVisual;
          
          this.logger.debug(
            `Loaded action "${actionData.id}" with visual properties:`,
            validatedVisual
          );
        } catch (error) {
          // Log warning but don't fail the entire action load
          this.logger.warn(
            `Visual properties validation failed for action "${actionData.id}": ${error.message}. ` +
            `Visual customization will be disabled for this action.`
          );
          
          // Remove invalid visual properties
          delete actionData.visual;
        }
      }

      // Process the action data
      const processedAction = this.processActionData(actionData, modId);

      // Store in registry
      this.dataRegistry.set(`actions.${processedAction.id}`, processedAction);

      return processedAction;
    } catch (error) {
      this.logger.error(`Failed to load action: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process action data and ensure all required fields
   * @private
   */
  processActionData(actionData, modId) {
    // Ensure ID is properly namespaced
    const actionId = this.ensureNamespaced(actionData.id, modId);

    // Build the complete action object
    const action = {
      id: actionId,
      name: actionData.name,
      description: actionData.description || '',
      template: actionData.template,
      params: actionData.params || {},
      conditions: actionData.conditions || [],
      effects: actionData.effects || [],
      
      // NEW: Include visual properties if present
      visual: actionData.visual || null,
      
      // Other properties
      category: actionData.category || 'general',
      priority: actionData.priority || 0,
      modId: modId,
      
      // Metadata
      _loadedAt: Date.now(),
      _source: `${modId}:actions/${actionData.id}.json`
    };

    return action;
  }

  /**
   * Batch load multiple actions
   * @param {Array} actionFiles - Array of action file paths
   * @param {string} modId - The mod ID
   * @returns {Array} Loaded actions
   */
  async loadBatch(actionFiles, modId) {
    const loadedActions = [];
    const errors = [];

    for (const file of actionFiles) {
      try {
        const actionData = await this.loadFile(file);
        const action = await this.loadItem(actionData, modId);
        loadedActions.push(action);
      } catch (error) {
        errors.push({
          file,
          error: error.message
        });
      }
    }

    // Report load summary
    this.logger.info(
      `Loaded ${loadedActions.length} actions from mod "${modId}". ` +
      `${errors.length} errors encountered.`
    );

    // Report visual properties summary
    const visualCount = loadedActions.filter(a => a.visual).length;
    if (visualCount > 0) {
      this.logger.info(
        `${visualCount} actions have visual customization properties.`
      );
    }

    if (errors.length > 0) {
      this.logger.warn('Action load errors:', errors);
    }

    return loadedActions;
  }
}
```

### Integration Points

#### 1. Schema Validation Integration
Ensure the loader uses the updated schema from ACTBUTVIS-001:

```javascript
// The schema validator should already be configured with the updated schema
// This happens in the schema loader initialization
```

#### 2. Registry Storage
Ensure visual properties are stored in the data registry:

```javascript
// When storing in registry, visual properties should be included
dataRegistry.set(`actions.${actionId}`, {
  // ... all action properties ...
  visual: action.visual // This must be included
});
```

#### 3. Error Handling Strategy

```javascript
// Graceful degradation for visual properties
handleVisualPropertyError(actionId, error) {
  // Log warning
  this.logger.warn(`Visual properties error for ${actionId}:`, error);
  
  // Continue loading action without visual properties
  // This ensures backward compatibility and graceful degradation
  return null; // Return null for visual property
}
```

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/loaders/actionLoader.test.js`

```javascript
describe('ActionLoader - Visual Properties', () => {
  let loader;
  let mockSchemaValidator;
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockSchemaValidator = {
      validate: jest.fn().mockResolvedValue({ valid: true })
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    mockDataRegistry = {
      set: jest.fn()
    };

    loader = new ActionLoader({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
      dataRegistry: mockDataRegistry
    });
  });

  describe('loading actions with visual properties', () => {
    it('should load action with valid visual properties', async () => {
      const actionData = {
        id: 'test_action',
        name: 'Test Action',
        template: 'test {target}',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff'
        }
      };

      const result = await loader.loadItem(actionData, 'test_mod');

      expect(result.visual).toBeDefined();
      expect(result.visual.backgroundColor).toBe('#ff0000');
      expect(result.visual.textColor).toBe('#ffffff');
    });

    it('should load action without visual properties', async () => {
      const actionData = {
        id: 'test_action',
        name: 'Test Action',
        template: 'test {target}'
        // No visual property
      };

      const result = await loader.loadItem(actionData, 'test_mod');

      expect(result.visual).toBeNull();
    });

    it('should handle invalid visual properties gracefully', async () => {
      const actionData = {
        id: 'test_action',
        name: 'Test Action',
        template: 'test {target}',
        visual: {
          backgroundColor: 'invalid-color'
        }
      };

      const result = await loader.loadItem(actionData, 'test_mod');

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalled();
      
      // Should remove invalid visual properties
      expect(result.visual).toBeNull();
      
      // Should still load the action
      expect(result.id).toBe('test_mod:test_action');
    });

    it('should store visual properties in registry', async () => {
      const actionData = {
        id: 'test_action',
        name: 'Test Action',
        template: 'test {target}',
        visual: {
          backgroundColor: '#ff0000'
        }
      };

      await loader.loadItem(actionData, 'test_mod');

      expect(mockDataRegistry.set).toHaveBeenCalledWith(
        'actions.test_mod:test_action',
        expect.objectContaining({
          visual: {
            backgroundColor: '#ff0000'
          }
        })
      );
    });
  });

  describe('batch loading with visual properties', () => {
    it('should report visual properties count', async () => {
      const actions = [
        { id: 'action1', visual: { backgroundColor: '#ff0000' } },
        { id: 'action2', visual: { textColor: '#ffffff' } },
        { id: 'action3' } // No visual
      ];

      // Mock file loading
      loader.loadFile = jest.fn()
        .mockResolvedValueOnce(actions[0])
        .mockResolvedValueOnce(actions[1])
        .mockResolvedValueOnce(actions[2]);

      await loader.loadBatch(['file1', 'file2', 'file3'], 'test_mod');

      // Should report 2 actions with visual properties
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 actions have visual customization')
      );
    });
  });
});
```

## Acceptance Criteria

1. ✅ ActionLoader preserves visual properties from JSON files
2. ✅ Visual properties are validated during load
3. ✅ Invalid visual properties don't fail entire action load (graceful degradation)
4. ✅ Visual properties are stored in the data registry
5. ✅ Loader logs visual property information (debug/info level)
6. ✅ Warnings are logged for invalid visual properties
7. ✅ Batch loading reports visual properties count
8. ✅ Unit tests verify all visual property scenarios
9. ✅ Backward compatibility maintained for actions without visual properties

## Notes

- Visual property errors should not break action loading
- Consider caching validated visual properties for performance
- The loader should be defensive about malformed data
- Debug logging helps modders troubleshoot visual properties

## Related Tickets
- **Depends on**: ACTBUTVIS-001 (Schema), ACTBUTVIS-004 (Validation)
- **Next**: ACTBUTVIS-006 (Factory integration)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References
- Action Loader: `src/loaders/actionLoader.js`
- Base Loader: `src/loaders/baseManifestItemLoader.js`
- Visual Validator: `src/validation/visualPropertiesValidator.js`
- Data Registry: `src/data/inMemoryDataRegistry.js`
- Original Spec: `specs/action-button-visual-customization.spec.md`