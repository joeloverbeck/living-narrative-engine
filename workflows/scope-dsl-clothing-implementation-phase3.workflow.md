# Scope DSL Clothing Target Resolution - Phase 3: Action Integration

**Phase**: 3 (Action Integration)  
**Timeline**: Week 3  
**Prerequisites**: Phases 1 & 2 complete  
**Focus**: Action template integration, error handling, documentation, production readiness

## Phase 3 Overview

Phase 3 focuses on integrating the clothing resolution system with the action templating system, implementing comprehensive error handling, creating production-ready documentation, and ensuring the feature is ready for real-world usage. This phase bridges the gap between the technical implementation and practical game mechanics.

### Key Deliverables

- Action template integration and validation
- Comprehensive error handling system
- Production-ready documentation
- Performance monitoring and metrics
- User-facing error messages and debugging tools

### Related Files

- **Phase 1**: [scope-dsl-clothing-implementation-main.workflow.md](./scope-dsl-clothing-implementation-main.workflow.md)
- **Phase 2**: [scope-dsl-clothing-implementation-phase2.workflow.md](./scope-dsl-clothing-implementation-phase2.workflow.md)
- **Phase 4**: [scope-dsl-clothing-implementation-phase4.workflow.md](./scope-dsl-clothing-implementation-phase4.workflow.md)

---

# Phase 3 Tasks

## Task 3.1: Action Template Integration

**Files**: Action system integration  
**Estimated Time**: 5 hours  
**Dependencies**: Phase 2 complete

### 3.1.1: Validate Clothing Scopes in Action Templates (2 hours)

**File**: `src/actions/actionTemplateValidator.js` (new file)

```javascript
/**
 * @file Action template validator with clothing scope support
 * @description Validates action templates that use clothing target resolution
 */

import { validateDependency } from '../utils/validationCore.js';
import createDefaultDslParser from '../scopeDsl/parser/defaultDslParser.js';

/**
 * Validates action templates that use clothing scopes
 */
export default class ActionTemplateValidator {
  constructor({ logger, scopeRegistry } = {}) {
    validateDependency(logger, 'logger');
    validateDependency(scopeRegistry, 'scopeRegistry');

    this.logger = logger;
    this.scopeRegistry = scopeRegistry;
    this.parser = createDefaultDslParser();

    // Known clothing patterns for validation
    this.clothingPatterns = [
      /actor\.topmost_clothing\[\]/,
      /actor\.topmost_clothing\.\w+/,
      /actor\.all_clothing\[\]/,
      /actor\.outer_clothing\[\]/,
      /actor\.base_clothing\[\]/,
      /actor\.underwear\[\]/,
      /actor\.visible_clothing\[\]/,
      /actor\.removable_clothing\[\]/,
      /actor\.formal_clothing\[\]/,
      /actor\.casual_clothing\[\]/,
      /actor\.dirty_clothing\[\]/,
      /actor\.clean_clothing\[\]/,
    ];
  }

  /**
   * Validates an action template for clothing scope usage
   * @param {object} actionTemplate - Action template to validate
   * @returns {object} Validation result with errors and warnings
   */
  validateActionTemplate(actionTemplate) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      clothingScopes: [],
    };

    try {
      // Extract and validate scopes from action template
      const scopes = this.extractScopesFromTemplate(actionTemplate);

      for (const scope of scopes) {
        const scopeValidation = this.validateClothingScope(scope);

        if (scopeValidation.isClothingScope) {
          result.clothingScopes.push(scope);

          if (!scopeValidation.valid) {
            result.valid = false;
            result.errors.push(...scopeValidation.errors);
          }

          result.warnings.push(...scopeValidation.warnings);
        }
      }

      // Validate clothing scope usage patterns
      this.validateClothingScopePatterns(actionTemplate, result);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Action template validation failed: ${error.message}`);
      this.logger.error('ActionTemplateValidator: Validation error', error);
    }

    return result;
  }

  /**
   * Extracts scope definitions from action template
   * @param {object} actionTemplate - Action template
   * @returns {Array<string>} Array of scope definition strings
   * @private
   */
  extractScopesFromTemplate(actionTemplate) {
    const scopes = [];

    // Extract from target scopes
    if (actionTemplate.targetScopes) {
      for (const [scopeName, scopeDefinition] of Object.entries(
        actionTemplate.targetScopes
      )) {
        scopes.push(scopeDefinition);
      }
    }

    // Extract from conditions
    if (actionTemplate.conditions) {
      for (const condition of actionTemplate.conditions) {
        if (condition.targetScope) {
          scopes.push(condition.targetScope);
        }
      }
    }

    // Extract from operations
    if (actionTemplate.operations) {
      for (const operation of actionTemplate.operations) {
        if (operation.targetScope) {
          scopes.push(operation.targetScope);
        }
      }
    }

    return scopes.filter((scope) => typeof scope === 'string');
  }

  /**
   * Validates a specific clothing scope
   * @param {string} scopeDefinition - Scope definition string
   * @returns {object} Validation result
   * @private
   */
  validateClothingScope(scopeDefinition) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      isClothingScope: false,
    };

    // Check if this is a clothing scope
    const isClothingScope = this.clothingPatterns.some((pattern) =>
      pattern.test(scopeDefinition)
    );

    if (!isClothingScope) {
      return result;
    }

    result.isClothingScope = true;

    try {
      // Parse the scope to validate syntax
      const ast = this.parser.parse(scopeDefinition);

      // Validate clothing-specific patterns
      this.validateClothingAst(ast, result);
    } catch (parseError) {
      result.valid = false;
      result.errors.push(
        `Invalid clothing scope syntax: ${parseError.message}`
      );
    }

    return result;
  }

  /**
   * Validates clothing AST structure
   * @param {object} ast - Parsed AST
   * @param {object} result - Validation result to update
   * @private
   */
  validateClothingAst(ast, result) {
    // Validate clothing field names
    if (ast.type === 'Step' && ast.field) {
      const validClothingFields = [
        'topmost_clothing',
        'all_clothing',
        'outer_clothing',
        'base_clothing',
        'underwear',
        'visible_clothing',
        'removable_clothing',
        'formal_clothing',
        'casual_clothing',
        'dirty_clothing',
        'clean_clothing',
      ];

      if (!validClothingFields.includes(ast.field)) {
        result.warnings.push(`Unknown clothing field: ${ast.field}`);
      }
    }

    // Validate clothing slot names in subsequent steps
    if (
      ast.parent &&
      ast.parent.field &&
      ast.parent.field.includes('clothing')
    ) {
      const validSlots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      if (ast.field && !validSlots.includes(ast.field)) {
        result.warnings.push(`Unknown clothing slot: ${ast.field}`);
      }
    }

    // Recursively validate parent nodes
    if (ast.parent) {
      this.validateClothingAst(ast.parent, result);
    }
  }

  /**
   * Validates clothing scope usage patterns in action template
   * @param {object} actionTemplate - Action template
   * @param {object} result - Validation result to update
   * @private
   */
  validateClothingScopePatterns(actionTemplate, result) {
    // Check for common anti-patterns
    if (actionTemplate.targetScopes) {
      for (const [scopeName, scopeDefinition] of Object.entries(
        actionTemplate.targetScopes
      )) {
        // Warn about overly broad clothing scopes
        if (scopeDefinition === 'actor.all_clothing[]') {
          result.warnings.push(
            `Scope '${scopeName}' targets all clothing items. Consider using more specific scopes for better performance.`
          );
        }

        // Warn about potentially empty results
        if (
          scopeDefinition.includes('.underwear') ||
          scopeDefinition.includes('underwear[]')
        ) {
          result.warnings.push(
            `Scope '${scopeName}' targets underwear which may not be appropriate for all actions.`
          );
        }

        // Check for complex filter combinations
        if (
          scopeDefinition.includes('formal_clothing') &&
          scopeDefinition.includes('dirty_clothing')
        ) {
          result.warnings.push(
            `Scope '${scopeName}' has complex filtering that may impact performance.`
          );
        }
      }
    }

    // Validate action type compatibility
    if (actionTemplate.type) {
      this.validateActionTypeCompatibility(actionTemplate, result);
    }
  }

  /**
   * Validates clothing scope compatibility with action types
   * @param {object} actionTemplate - Action template
   * @param {object} result - Validation result to update
   * @private
   */
  validateActionTypeCompatibility(actionTemplate, result) {
    const actionType = actionTemplate.type;
    const clothingScopes = result.clothingScopes;

    // Removal actions should target removable clothing
    if (actionType === 'remove_clothing') {
      const hasRemovableScope = clothingScopes.some(
        (scope) =>
          scope.includes('topmost_clothing') ||
          scope.includes('removable_clothing')
      );

      if (!hasRemovableScope) {
        result.warnings.push(
          'Remove clothing actions should target topmost_clothing or removable_clothing for better user experience.'
        );
      }

      const hasUnderwearScope = clothingScopes.some((scope) =>
        scope.includes('underwear')
      );

      if (hasUnderwearScope) {
        result.warnings.push(
          'Remove clothing actions targeting underwear may not be appropriate in all contexts.'
        );
      }
    }

    // Inspect actions should allow all types
    if (actionType === 'inspect_clothing') {
      const hasVisibleScope = clothingScopes.some(
        (scope) =>
          scope.includes('visible_clothing') ||
          scope.includes('topmost_clothing')
      );

      if (!hasVisibleScope) {
        result.warnings.push(
          'Inspect clothing actions should primarily target visible_clothing or topmost_clothing.'
        );
      }
    }

    // Wash actions should target dirty clothing
    if (actionType === 'wash_clothing') {
      const hasDirtyScope = clothingScopes.some((scope) =>
        scope.includes('dirty_clothing')
      );

      if (!hasDirtyScope) {
        result.warnings.push(
          'Wash clothing actions should target dirty_clothing for logical consistency.'
        );
      }
    }
  }
}
```

### 3.1.2: Integrate Validator into Action Loading (1 hour)

**File**: `src/loaders/actionLoader.js` (enhancements)

```javascript
// Add action template validator integration

import ActionTemplateValidator from '../actions/actionTemplateValidator.js';

// Enhance the action loader to validate clothing scopes
export default function createActionLoader(dependencies) {
  const { logger, scopeRegistry } = dependencies;

  // Initialize validator
  const templateValidator = new ActionTemplateValidator({
    logger,
    scopeRegistry,
  });

  // Enhanced load method with clothing validation
  async function load(actionData, loadContext) {
    try {
      // Existing loading logic...

      // Validate clothing scopes in action template
      if (
        actionData.targetScopes ||
        actionData.conditions ||
        actionData.operations
      ) {
        const validation = templateValidator.validateActionTemplate(actionData);

        if (!validation.valid) {
          const errors = validation.errors.join(', ');
          throw new Error(`Action template validation failed: ${errors}`);
        }

        // Log warnings for clothing scope usage
        if (validation.warnings.length > 0) {
          validation.warnings.forEach((warning) => {
            logger.warn(`Action ${actionData.id}: ${warning}`);
          });
        }

        // Log clothing scope usage for debugging
        if (validation.clothingScopes.length > 0) {
          logger.debug(
            `Action ${actionData.id} uses clothing scopes:`,
            validation.clothingScopes
          );
        }
      }

      // Continue with existing loading process...
    } catch (error) {
      logger.error(`Failed to load action ${actionData.id}:`, error);
      throw error;
    }
  }

  return {
    load,
    // ... other methods
  };
}
```

### 3.1.3: Create Action Template Examples (2 hours)

**File**: `data/mods/core/actions/clothing-removal-examples.json`

```json
{
  "remove_upper_clothing": {
    "id": "core:remove_upper_clothing",
    "name": "Remove Upper Clothing",
    "description": "Remove the topmost upper body clothing item",
    "type": "remove_clothing",
    "targetScopes": {
      "target_clothing": "actor.topmost_clothing.torso_upper"
    },
    "conditions": [
      {
        "description": "Actor has upper clothing to remove",
        "logic": {
          "!=": [{ "var": "target_clothing.length" }, 0]
        }
      },
      {
        "description": "Clothing is removable (not underwear in public)",
        "logic": {
          "not": {
            "and": [
              {
                "isInClothingLayer": [
                  { "var": "target_clothing.0" },
                  "underwear"
                ]
              },
              { "!=": [{ "var": "location.privacy_level" }, "private"] }
            ]
          }
        }
      }
    ],
    "operations": [
      {
        "type": "unequip_item",
        "targetId": { "var": "target_clothing.0" },
        "fromEntityId": { "var": "actor.id" }
      },
      {
        "type": "move_item",
        "targetId": { "var": "target_clothing.0" },
        "toLocation": { "var": "location.id" }
      }
    ],
    "resultTemplate": "You remove the {{target_clothing.0.displayName}}."
  },

  "remove_all_outer_clothing": {
    "id": "core:remove_all_outer_clothing",
    "name": "Remove All Outer Clothing",
    "description": "Remove all outer layer clothing items",
    "type": "remove_clothing",
    "targetScopes": {
      "outer_items": "actor.outer_clothing[]"
    },
    "conditions": [
      {
        "description": "Actor has outer clothing to remove",
        "logic": {
          ">": [{ "var": "outer_items.length" }, 0]
        }
      },
      {
        "description": "Location allows clothing removal",
        "logic": {
          "or": [
            { "==": [{ "var": "location.privacy_level" }, "private"] },
            { "==": [{ "var": "location.type" }, "changing_room"] }
          ]
        }
      }
    ],
    "operations": [
      {
        "type": "for_each_item",
        "targetScope": "outer_items",
        "operations": [
          {
            "type": "unequip_item",
            "targetId": { "var": "item.id" },
            "fromEntityId": { "var": "actor.id" }
          },
          {
            "type": "move_item",
            "targetId": { "var": "item.id" },
            "toLocation": { "var": "location.id" }
          }
        ]
      }
    ],
    "resultTemplate": "You remove all your outer clothing."
  },

  "inspect_visible_clothing": {
    "id": "core:inspect_visible_clothing",
    "name": "Inspect Visible Clothing",
    "description": "Examine the visible clothing items",
    "type": "inspect_clothing",
    "targetScopes": {
      "visible_items": "actor.visible_clothing[]"
    },
    "conditions": [
      {
        "description": "Actor has visible clothing",
        "logic": {
          ">": [{ "var": "visible_items.length" }, 0]
        }
      }
    ],
    "operations": [
      {
        "type": "generate_description",
        "templateId": "clothing_inspection",
        "context": {
          "items": { "var": "visible_items" },
          "actor": { "var": "actor" }
        }
      }
    ],
    "resultTemplate": "{{description}}"
  },

  "wash_dirty_clothing": {
    "id": "core:wash_dirty_clothing",
    "name": "Wash Dirty Clothing",
    "description": "Clean dirty clothing items at washing facility",
    "type": "wash_clothing",
    "targetScopes": {
      "dirty_items": "actor.dirty_clothing[]"
    },
    "conditions": [
      {
        "description": "Actor has dirty clothing",
        "logic": {
          ">": [{ "var": "dirty_items.length" }, 0]
        }
      },
      {
        "description": "Location has washing facilities",
        "logic": {
          "hasComponent": [{ "var": "location.id" }, "facilities:washing"]
        }
      },
      {
        "description": "Clothing is not currently equipped",
        "logic": {
          "not": {
            "isEquippedInSlot": [
              { "var": "actor.id" },
              { "var": "dirty_items.0" },
              "any"
            ]
          }
        }
      }
    ],
    "operations": [
      {
        "type": "for_each_item",
        "targetScope": "dirty_items",
        "operations": [
          {
            "type": "update_component",
            "targetId": { "var": "item.id" },
            "componentId": "clothing:condition",
            "updates": {
              "dirty": false,
              "cleanliness": 100
            }
          }
        ]
      }
    ],
    "resultTemplate": "You wash {{dirty_items.length}} dirty clothing item(s)."
  }
}
```

---

## Task 3.2: Enhanced Error Handling System

**Files**: Comprehensive error handling  
**Estimated Time**: 4 hours  
**Dependencies**: Task 3.1 complete

### 3.2.1: Create Clothing Error Handler (2 hours)

**File**: `src/scopeDsl/errors/clothingErrorHandler.js`

```javascript
/**
 * @file Comprehensive error handler for clothing scope operations
 * @description Provides user-friendly error messages and recovery strategies
 */

import {
  ClothingEquipmentError,
  InvalidClothingSlotError,
  InvalidClothingLayerError,
} from './clothingResolutionError.js';

/**
 * Handles clothing-specific errors with user-friendly messages and recovery
 */
export default class ClothingErrorHandler {
  constructor({ logger, userMessageService } = {}) {
    this.logger = logger;
    this.userMessageService = userMessageService;

    // Error recovery strategies
    this.recoveryStrategies = new Map([
      ['ClothingEquipmentError', this.recoverFromEquipmentError.bind(this)],
      ['InvalidClothingSlotError', this.recoverFromSlotError.bind(this)],
      ['InvalidClothingLayerError', this.recoverFromLayerError.bind(this)],
      ['ScopeDslError', this.recoverFromScopeError.bind(this)],
    ]);

    // User-friendly error messages
    this.userMessages = {
      no_clothing_equipped:
        "You don't have any clothing equipped in that slot.",
      invalid_clothing_operation:
        "That clothing operation isn't available right now.",
      equipment_data_corrupted:
        "There's a problem with your equipment data. Trying to fix it...",
      clothing_not_removable:
        "That clothing item can't be removed in this situation.",
      no_visible_clothing: "You don't have any visible clothing to examine.",
      no_dirty_clothing: "You don't have any dirty clothing to clean.",
      clothing_already_clean: 'That clothing is already clean.',
      inappropriate_context: "That action isn't appropriate in this context.",
    };
  }

  /**
   * Handles a clothing-related error and provides recovery
   * @param {Error} error - The error to handle
   * @param {object} context - Error context information
   * @returns {object} Error handling result with recovery info
   */
  handleClothingError(error, context = {}) {
    const result = {
      handled: false,
      recovered: false,
      userMessage: null,
      recoveryAction: null,
      diagnosticInfo: null,
    };

    try {
      // Log the error for debugging
      this.logger.error('ClothingErrorHandler: Handling clothing error', {
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      });

      // Get error type and apply recovery strategy
      const errorType = error.constructor.name;
      const recoveryStrategy = this.recoveryStrategies.get(errorType);

      if (recoveryStrategy) {
        const recoveryResult = recoveryStrategy(error, context);
        Object.assign(result, recoveryResult);
        result.handled = true;
      } else {
        // Generic error handling
        result.handled = this.handleGenericClothingError(
          error,
          context,
          result
        );
      }

      // Generate user message if not already provided
      if (result.handled && !result.userMessage) {
        result.userMessage = this.generateUserMessage(error, context);
      }

      // Generate diagnostic info for developers
      result.diagnosticInfo = this.generateDiagnosticInfo(error, context);
    } catch (handlingError) {
      this.logger.error(
        'ClothingErrorHandler: Error while handling clothing error',
        handlingError
      );
      result.userMessage =
        'Something went wrong with your clothing. Please try again.';
    }

    return result;
  }

  /**
   * Recovers from clothing equipment errors
   * @param {ClothingEquipmentError} error - Equipment error
   * @param {object} context - Error context
   * @returns {object} Recovery result
   * @private
   */
  recoverFromEquipmentError(error, context) {
    const result = {
      recovered: false,
      userMessage: this.userMessages.equipment_data_corrupted,
      recoveryAction: null,
    };

    try {
      // Attempt to rebuild equipment data from available information
      if (context.entityId && context.entitiesGateway) {
        const rebuildResult = this.rebuildEquipmentData(
          context.entityId,
          context.entitiesGateway
        );

        if (rebuildResult.success) {
          result.recovered = true;
          result.recoveryAction = 'equipment_rebuilt';
          result.userMessage = 'Fixed a problem with your equipment data.';

          this.logger.info(
            'ClothingErrorHandler: Successfully rebuilt equipment data',
            {
              entityId: context.entityId,
              rebuiltSlots: rebuildResult.rebuiltSlots,
            }
          );
        }
      }
    } catch (recoveryError) {
      this.logger.error(
        'ClothingErrorHandler: Equipment recovery failed',
        recoveryError
      );
    }

    return result;
  }

  /**
   * Recovers from invalid clothing slot errors
   * @param {InvalidClothingSlotError} error - Slot error
   * @param {object} context - Error context
   * @returns {object} Recovery result
   * @private
   */
  recoverFromSlotError(error, context) {
    const result = {
      recovered: false,
      userMessage: `"${error.slotName}" isn't a valid clothing slot.`,
      recoveryAction: null,
    };

    // Attempt to suggest a similar valid slot
    const suggestion = this.suggestSimilarSlot(
      error.slotName,
      error.validSlots
    );
    if (suggestion) {
      result.userMessage += ` Did you mean "${suggestion}"?`;
      result.recoveryAction = 'slot_suggestion';
      result.suggestedSlot = suggestion;
    }

    return result;
  }

  /**
   * Recovers from invalid clothing layer errors
   * @param {InvalidClothingLayerError} error - Layer error
   * @param {object} context - Error context
   * @returns {object} Recovery result
   * @private
   */
  recoverFromLayerError(error, context) {
    const result = {
      recovered: false,
      userMessage: `"${error.layer}" isn't a valid clothing layer.`,
      recoveryAction: null,
    };

    // Attempt to suggest a similar valid layer
    const suggestion = this.suggestSimilarLayer(error.layer, error.validLayers);
    if (suggestion) {
      result.userMessage += ` Did you mean "${suggestion}"?`;
      result.recoveryAction = 'layer_suggestion';
      result.suggestedLayer = suggestion;
    }

    return result;
  }

  /**
   * Recovers from general scope DSL errors
   * @param {Error} error - Scope error
   * @param {object} context - Error context
   * @returns {object} Recovery result
   * @private
   */
  recoverFromScopeError(error, context) {
    const result = {
      recovered: false,
      userMessage: this.userMessages.invalid_clothing_operation,
      recoveryAction: null,
    };

    // Check for common scope issues
    if (error.message.includes('depth')) {
      result.userMessage =
        'That clothing query is too complex. Try something simpler.';
      result.recoveryAction = 'simplify_query';
    } else if (error.message.includes('cycle')) {
      result.userMessage = "There's a circular reference in the clothing data.";
      result.recoveryAction = 'break_cycle';
    } else if (error.message.includes('parse')) {
      result.userMessage = 'The clothing query syntax is invalid.';
      result.recoveryAction = 'fix_syntax';
    }

    return result;
  }

  /**
   * Handles generic clothing errors
   * @param {Error} error - Generic error
   * @param {object} context - Error context
   * @param {object} result - Result object to update
   * @returns {boolean} Whether error was handled
   * @private
   */
  handleGenericClothingError(error, context, result) {
    // Check error message for common patterns
    if (error.message.includes('equipment')) {
      result.userMessage = this.userMessages.equipment_data_corrupted;
      return true;
    }

    if (error.message.includes('slot')) {
      result.userMessage = this.userMessages.no_clothing_equipped;
      return true;
    }

    if (error.message.includes('empty') || error.message.includes('no items')) {
      result.userMessage = this.userMessages.no_visible_clothing;
      return true;
    }

    // Default generic message
    result.userMessage = this.userMessages.invalid_clothing_operation;
    return true;
  }

  /**
   * Attempts to rebuild equipment data
   * @param {string} entityId - Entity ID
   * @param {object} entitiesGateway - Entities gateway
   * @returns {object} Rebuild result
   * @private
   */
  rebuildEquipmentData(entityId, entitiesGateway) {
    const result = {
      success: false,
      rebuiltSlots: [],
    };

    try {
      // Get all clothing components for this entity
      const clothingComponents = entitiesGateway.getComponentsByType(
        entityId,
        'clothing:'
      );

      if (clothingComponents.length === 0) {
        return result;
      }

      // Rebuild equipment structure
      const rebuiltEquipment = { equipped: {} };

      for (const component of clothingComponents) {
        if (component.type === 'clothing:wearable' && component.data.equipped) {
          const { slot, layer } = component.data;

          if (slot && layer) {
            if (!rebuiltEquipment.equipped[slot]) {
              rebuiltEquipment.equipped[slot] = {};
            }

            rebuiltEquipment.equipped[slot][layer] = component.entityId;
            result.rebuiltSlots.push(`${slot}:${layer}`);
          }
        }
      }

      if (result.rebuiltSlots.length > 0) {
        // Save rebuilt equipment data
        entitiesGateway.setComponentData(
          entityId,
          'clothing:equipment',
          rebuiltEquipment
        );
        result.success = true;
      }
    } catch (rebuildError) {
      this.logger.error('ClothingErrorHandler: Rebuild failed', rebuildError);
    }

    return result;
  }

  /**
   * Suggests a similar valid slot name
   * @param {string} invalidSlot - Invalid slot name
   * @param {Array<string>} validSlots - Valid slot names
   * @returns {string|null} Suggested slot name
   * @private
   */
  suggestSimilarSlot(invalidSlot, validSlots) {
    if (!invalidSlot || !validSlots) return null;

    // Simple string similarity based on character overlap
    let bestMatch = null;
    let bestScore = 0;

    for (const validSlot of validSlots) {
      const score = this.calculateStringSimilarity(
        invalidSlot.toLowerCase(),
        validSlot.toLowerCase()
      );
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = validSlot;
      }
    }

    return bestMatch;
  }

  /**
   * Suggests a similar valid layer name
   * @param {string} invalidLayer - Invalid layer name
   * @param {Array<string>} validLayers - Valid layer names
   * @returns {string|null} Suggested layer name
   * @private
   */
  suggestSimilarLayer(invalidLayer, validLayers) {
    if (!invalidLayer || !validLayers) return null;

    // Common layer name mappings
    const layerMappings = {
      top: 'outer',
      bottom: 'base',
      under: 'underwear',
      accessory: 'accessories',
    };

    // Check direct mappings first
    const mapped = layerMappings[invalidLayer.toLowerCase()];
    if (mapped && validLayers.includes(mapped)) {
      return mapped;
    }

    // Fall back to similarity matching
    return this.suggestSimilarSlot(invalidLayer, validLayers);
  }

  /**
   * Calculates string similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   * @private
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculates edit distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   * @private
   */
  calculateEditDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Generates user-friendly error message
   * @param {Error} error - Error object
   * @param {object} context - Error context
   * @returns {string} User message
   * @private
   */
  generateUserMessage(error, context) {
    // Context-aware messages
    if (context.clothingField) {
      if (
        context.clothingField.includes('dirty') &&
        error.message.includes('empty')
      ) {
        return this.userMessages.no_dirty_clothing;
      }

      if (
        context.clothingField.includes('visible') &&
        error.message.includes('empty')
      ) {
        return this.userMessages.no_visible_clothing;
      }
    }

    if (context.actionType) {
      if (
        context.actionType === 'remove_clothing' &&
        error.message.includes('not removable')
      ) {
        return this.userMessages.clothing_not_removable;
      }

      if (
        context.actionType === 'wash_clothing' &&
        error.message.includes('already clean')
      ) {
        return this.userMessages.clothing_already_clean;
      }
    }

    // Default message
    return this.userMessages.invalid_clothing_operation;
  }

  /**
   * Generates diagnostic information for developers
   * @param {Error} error - Error object
   * @param {object} context - Error context
   * @returns {object} Diagnostic information
   * @private
   */
  generateDiagnosticInfo(error, context) {
    return {
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorStack: error.stack,
      context: {
        entityId: context.entityId,
        clothingField: context.clothingField,
        actionType: context.actionType,
        timestamp: new Date().toISOString(),
      },
      systemInfo: {
        nodejs: process.version,
        memory: process.memoryUsage(),
      },
    };
  }
}
```

### 3.2.2: Integrate Error Handler into Resolvers (1 hour)

**File**: `src/scopeDsl/nodes/clothingStepResolver.js` (enhancements)

```javascript
import ClothingErrorHandler from '../errors/clothingErrorHandler.js';

export default function createClothingStepResolver({
  entitiesGateway,
  logger,
  userMessageService,
}) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Initialize error handler
  const errorHandler = new ClothingErrorHandler({ logger, userMessageService });

  // Enhanced resolve method with comprehensive error handling
  function resolve(node, ctx) {
    const { field, parent, isArray } = node;

    try {
      const parentResults = ctx.dispatcher.resolve(parent, ctx);
      const resultSet = new Set();

      // Trace logging with error context
      if (ctx.trace) {
        ctx.trace.addLog(
          'info',
          `ClothingStepResolver: Processing ${field} field`,
          'ClothingStepResolver',
          { field, isArray, parentResultsSize: parentResults.size }
        );
      }

      for (const entityId of parentResults) {
        if (typeof entityId !== 'string') {
          continue;
        }

        try {
          const clothingData = resolveClothingField(
            entityId,
            field,
            isArray,
            ctx.trace
          );
          clothingData.forEach((id) => resultSet.add(id));
        } catch (entityError) {
          // Handle entity-specific errors
          const errorContext = {
            entityId,
            clothingField: field,
            isArray,
            parentResults: Array.from(parentResults),
            entitiesGateway,
          };

          const errorResult = errorHandler.handleClothingError(
            entityError,
            errorContext
          );

          if (errorResult.handled) {
            if (ctx.trace) {
              ctx.trace.addLog(
                'warning',
                `ClothingStepResolver: Handled error for entity ${entityId}`,
                'ClothingStepResolver',
                {
                  errorType: entityError.constructor.name,
                  recovered: errorResult.recovered,
                  userMessage: errorResult.userMessage,
                }
              );
            }

            // If recovery was successful, continue processing
            if (errorResult.recovered) {
              try {
                const recoveredData = resolveClothingField(
                  entityId,
                  field,
                  isArray,
                  ctx.trace
                );
                recoveredData.forEach((id) => resultSet.add(id));
              } catch (recoveryError) {
                // Log recovery failure but continue
                if (ctx.trace) {
                  ctx.trace.addLog(
                    'error',
                    `ClothingStepResolver: Recovery failed for entity ${entityId}`,
                    'ClothingStepResolver',
                    { recoveryError: recoveryError.message }
                  );
                }
              }
            }
          } else {
            // Re-throw unhandled errors
            throw entityError;
          }
        }
      }

      if (ctx.trace) {
        ctx.trace.addLog(
          'info',
          `ClothingStepResolver: Resolution complete, found ${resultSet.size} items`,
          'ClothingStepResolver',
          { resultSize: resultSet.size }
        );
      }

      return resultSet;
    } catch (error) {
      // Handle top-level resolution errors
      const errorContext = {
        clothingField: field,
        isArray,
        nodeType: node.type,
        entitiesGateway,
      };

      const errorResult = errorHandler.handleClothingError(error, errorContext);

      if (errorResult.handled) {
        if (ctx.trace) {
          ctx.trace.addLog(
            'error',
            `ClothingStepResolver: Top-level error handled`,
            'ClothingStepResolver',
            {
              errorType: error.constructor.name,
              userMessage: errorResult.userMessage,
              diagnosticInfo: errorResult.diagnosticInfo,
            }
          );
        }

        // Return empty set for handled errors to prevent cascading failures
        return new Set();
      }

      // Re-throw unhandled errors
      throw error;
    }
  }

  // Add error handler access to resolver
  const resolver = {
    canResolve,
    resolve,
    clearCache: () => cacheManager.clearCache(),
    getCacheStats: () => cacheManager.getStats(),
    invalidateEntity: (entityId) => cacheManager.invalidateEntity(entityId),

    // Error handling methods
    handleError: (error, context) =>
      errorHandler.handleClothingError(error, context),
    getErrorDiagnostics: (error, context) =>
      errorHandler.generateDiagnosticInfo(error, context),
  };

  return resolver;
}
```

### 3.2.3: Create Error Recovery Service (1 hour)

**File**: `src/scopeDsl/services/clothingErrorRecoveryService.js`

```javascript
/**
 * @file Service for recovering from clothing system errors
 * @description Provides automatic recovery and data repair for clothing systems
 */

import { validateDependency } from '../../utils/validationCore.js';

/**
 * Service for automatic error recovery in clothing systems
 */
export default class ClothingErrorRecoveryService {
  constructor({ entityManager, logger, eventBus } = {}) {
    validateDependency(entityManager, 'entityManager');
    validateDependency(logger, 'logger');
    validateDependency(eventBus, 'eventBus');

    this.entityManager = entityManager;
    this.logger = logger;
    this.eventBus = eventBus;

    this.recoveryStats = {
      totalRecoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      lastRecoveryTime: null,
    };
  }

  /**
   * Attempts to recover from a clothing system error
   * @param {string} entityId - Entity ID experiencing the error
   * @param {Error} error - The error to recover from
   * @returns {Promise<object>} Recovery result
   */
  async recoverFromError(entityId, error) {
    this.recoveryStats.totalRecoveryAttempts++;
    this.recoveryStats.lastRecoveryTime = new Date().toISOString();

    const result = {
      success: false,
      recoveryType: null,
      message: null,
      details: {},
    };

    try {
      this.logger.info(
        `ClothingErrorRecoveryService: Attempting recovery for ${entityId}`,
        {
          errorType: error.constructor.name,
          errorMessage: error.message,
        }
      );

      // Determine recovery strategy based on error type
      if (error.message.includes('equipment')) {
        result.recoveryType = 'equipment_repair';
        result.success = await this.repairEquipmentData(entityId);
      } else if (error.message.includes('slot')) {
        result.recoveryType = 'slot_validation';
        result.success = await this.validateAndRepairSlots(entityId);
      } else if (error.message.includes('layer')) {
        result.recoveryType = 'layer_consistency';
        result.success = await this.fixLayerInconsistencies(entityId);
      } else if (error.message.includes('component')) {
        result.recoveryType = 'component_rebuild';
        result.success = await this.rebuildClothingComponents(entityId);
      } else {
        result.recoveryType = 'general_repair';
        result.success = await this.performGeneralRepair(entityId);
      }

      if (result.success) {
        this.recoveryStats.successfulRecoveries++;
        result.message = `Successfully recovered from ${result.recoveryType}`;

        // Dispatch recovery event
        this.eventBus.dispatch({
          type: 'CLOTHING_ERROR_RECOVERED',
          payload: {
            entityId,
            recoveryType: result.recoveryType,
            originalError: error.message,
            timestamp: (result.details.timestamp = new Date().toISOString()),
          },
        });
      } else {
        this.recoveryStats.failedRecoveries++;
        result.message = `Failed to recover from ${result.recoveryType}`;
      }
    } catch (recoveryError) {
      this.recoveryStats.failedRecoveries++;
      result.success = false;
      result.message = `Recovery attempt failed: ${recoveryError.message}`;

      this.logger.error(
        'ClothingErrorRecoveryService: Recovery attempt failed',
        {
          entityId,
          originalError: error.message,
          recoveryError: recoveryError.message,
        }
      );
    }

    return result;
  }

  /**
   * Repairs corrupted equipment data
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async repairEquipmentData(entityId) {
    try {
      // Get current equipment component
      const currentEquipment = this.entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );

      // Create a repaired equipment structure
      const repairedEquipment = {
        equipped: {},
        unequipped: [],
        preferences: {},
      };

      // If current equipment exists but is malformed, try to salvage data
      if (currentEquipment) {
        if (
          currentEquipment.equipped &&
          typeof currentEquipment.equipped === 'object'
        ) {
          // Validate and repair equipped items
          for (const [slotName, slotData] of Object.entries(
            currentEquipment.equipped
          )) {
            if (
              this.isValidSlotName(slotName) &&
              slotData &&
              typeof slotData === 'object'
            ) {
              repairedEquipment.equipped[slotName] =
                this.repairSlotData(slotData);
            }
          }
        }

        if (Array.isArray(currentEquipment.unequipped)) {
          repairedEquipment.unequipped = currentEquipment.unequipped.filter(
            (id) => typeof id === 'string' && id.length > 0
          );
        }
      }

      // Update the component with repaired data
      this.entityManager.setComponentData(
        entityId,
        'clothing:equipment',
        repairedEquipment
      );

      this.logger.info(
        `ClothingErrorRecoveryService: Repaired equipment data for ${entityId}`,
        {
          equippedSlots: Object.keys(repairedEquipment.equipped).length,
          unequippedItems: repairedEquipment.unequipped.length,
        }
      );

      return true;
    } catch (error) {
      this.logger.error(
        `ClothingErrorRecoveryService: Equipment repair failed for ${entityId}`,
        error
      );
      return false;
    }
  }

  /**
   * Validates and repairs clothing slots
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async validateAndRepairSlots(entityId) {
    try {
      const equipment = this.entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );

      if (!equipment?.equipped) {
        return false;
      }

      const validSlots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      const repairedEquipped = {};
      let repairsMade = false;

      for (const [slotName, slotData] of Object.entries(equipment.equipped)) {
        if (validSlots.includes(slotName)) {
          repairedEquipped[slotName] = slotData;
        } else {
          // Try to map invalid slot names to valid ones
          const mappedSlot = this.mapInvalidSlot(slotName, validSlots);
          if (mappedSlot) {
            repairedEquipped[mappedSlot] = slotData;
            repairsMade = true;
            this.logger.info(
              `ClothingErrorRecoveryService: Mapped slot ${slotName} to ${mappedSlot}`
            );
          } else {
            repairsMade = true;
            this.logger.warn(
              `ClothingErrorRecoveryService: Removed invalid slot ${slotName}`
            );
          }
        }
      }

      if (repairsMade) {
        equipment.equipped = repairedEquipped;
        this.entityManager.setComponentData(
          entityId,
          'clothing:equipment',
          equipment
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `ClothingErrorRecoveryService: Slot validation failed for ${entityId}`,
        error
      );
      return false;
    }
  }

  /**
   * Fixes layer inconsistencies in clothing data
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async fixLayerInconsistencies(entityId) {
    try {
      const equipment = this.entityManager.getComponentData(
        entityId,
        'clothing:equipment'
      );

      if (!equipment?.equipped) {
        return false;
      }

      const validLayers = ['outer', 'base', 'underwear', 'accessories'];
      let repairsMade = false;

      for (const [slotName, slotData] of Object.entries(equipment.equipped)) {
        if (!slotData || typeof slotData !== 'object') {
          continue;
        }

        const repairedSlotData = {};

        for (const [layer, itemId] of Object.entries(slotData)) {
          if (validLayers.includes(layer) && typeof itemId === 'string') {
            repairedSlotData[layer] = itemId;
          } else if (typeof itemId === 'string') {
            // Try to map invalid layer to valid one
            const mappedLayer = this.mapInvalidLayer(layer, validLayers);
            if (mappedLayer) {
              repairedSlotData[mappedLayer] = itemId;
              repairsMade = true;
            }
          }
        }

        if (
          repairsMade ||
          Object.keys(repairedSlotData).length !== Object.keys(slotData).length
        ) {
          equipment.equipped[slotName] = repairedSlotData;
          repairsMade = true;
        }
      }

      if (repairsMade) {
        this.entityManager.setComponentData(
          entityId,
          'clothing:equipment',
          equipment
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `ClothingErrorRecoveryService: Layer consistency fix failed for ${entityId}`,
        error
      );
      return false;
    }
  }

  /**
   * Rebuilds clothing components from scratch
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async rebuildClothingComponents(entityId) {
    try {
      // Create minimal equipment component
      const newEquipment = {
        equipped: {},
        unequipped: [],
        preferences: {},
      };

      this.entityManager.setComponentData(
        entityId,
        'clothing:equipment',
        newEquipment
      );

      this.logger.info(
        `ClothingErrorRecoveryService: Rebuilt clothing components for ${entityId}`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `ClothingErrorRecoveryService: Component rebuild failed for ${entityId}`,
        error
      );
      return false;
    }
  }

  /**
   * Performs general repair operations
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async performGeneralRepair(entityId) {
    try {
      // Attempt multiple repair strategies
      const strategies = [
        () => this.repairEquipmentData(entityId),
        () => this.validateAndRepairSlots(entityId),
        () => this.fixLayerInconsistencies(entityId),
      ];

      for (const strategy of strategies) {
        if (await strategy()) {
          return true;
        }
      }

      // Last resort: rebuild components
      return await this.rebuildClothingComponents(entityId);
    } catch (error) {
      this.logger.error(
        `ClothingErrorRecoveryService: General repair failed for ${entityId}`,
        error
      );
      return false;
    }
  }

  /**
   * Helper methods for data validation and repair
   */

  isValidSlotName(slotName) {
    const validSlots = [
      'torso_upper',
      'torso_lower',
      'legs',
      'feet',
      'head_gear',
      'hands',
      'left_arm_clothing',
      'right_arm_clothing',
    ];
    return validSlots.includes(slotName);
  }

  repairSlotData(slotData) {
    const repaired = {};
    const validLayers = ['outer', 'base', 'underwear', 'accessories'];

    for (const [layer, itemId] of Object.entries(slotData)) {
      if (validLayers.includes(layer) && typeof itemId === 'string') {
        repaired[layer] = itemId;
      }
    }

    return repaired;
  }

  mapInvalidSlot(invalidSlot, validSlots) {
    const mappings = {
      upper_torso: 'torso_upper',
      lower_torso: 'torso_lower',
      head: 'head_gear',
      foot: 'feet',
      shoes: 'feet',
    };

    return mappings[invalidSlot.toLowerCase()] || null;
  }

  mapInvalidLayer(invalidLayer, validLayers) {
    const mappings = {
      top: 'outer',
      bottom: 'base',
      under: 'underwear',
      accessory: 'accessories',
    };

    return mappings[invalidLayer.toLowerCase()] || null;
  }

  /**
   * Gets recovery statistics
   * @returns {object} Recovery statistics
   */
  getRecoveryStats() {
    return { ...this.recoveryStats };
  }

  /**
   * Resets recovery statistics
   */
  resetRecoveryStats() {
    this.recoveryStats = {
      totalRecoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      lastRecoveryTime: null,
    };
  }
}
```

---

## Task 3.3: Production Documentation

**Files**: Documentation updates  
**Estimated Time**: 3 hours  
**Dependencies**: Tasks 3.1 and 3.2 complete

### 3.3.1: Create User Guide Documentation (2 hours)

**File**: `docs/clothing-scope-dsl-guide.md`

````markdown
# Clothing Target Resolution in Scope DSL

This guide explains how to use the clothing target resolution features in the Living Narrative Engine's Scope DSL system.

## Overview

The clothing target resolution system enables simple, intuitive syntax for targeting clothing items in actions and conditions. Instead of complex JSON Logic expressions, you can use straightforward dot notation to access clothing data.

## Basic Syntax

### Array Syntax - Get All Items

```dsl
# Get all topmost clothing items
all_removable := actor.topmost_clothing[]

# Get all outer layer items
outer_items := actor.outer_clothing[]

# Get all clothing items (all layers)
everything := actor.all_clothing[]
```
````

### Dot Notation - Get Specific Slot

```dsl
# Get topmost item in specific slot
upper_shirt := actor.topmost_clothing.torso_upper
lower_pants := actor.topmost_clothing.torso_lower
footwear := actor.topmost_clothing.feet
```

## Available Clothing Fields

### Basic Fields

- **`topmost_clothing`** - Returns the topmost layer item from each slot (priority: outer > base > underwear)
- **`all_clothing`** - Returns all clothing items from all layers and slots
- **`outer_clothing`** - Returns only outer layer clothing items
- **`base_clothing`** - Returns only base layer clothing items
- **`underwear`** - Returns only underwear layer items

### Advanced Fields

- **`visible_clothing`** - Returns clothing visible to others (outer + accessories)
- **`removable_clothing`** - Returns clothing that can be removed (outer + base, not underwear in public)
- **`formal_clothing`** - Returns clothing tagged as formal
- **`casual_clothing`** - Returns clothing not tagged as formal
- **`dirty_clothing`** - Returns clothing with dirty condition
- **`clean_clothing`** - Returns clothing without dirty condition

## Available Clothing Slots

- **`torso_upper`** - Upper body clothing (shirts, jackets, etc.)
- **`torso_lower`** - Lower body clothing (pants, skirts, etc.)
- **`legs`** - Leg coverings (stockings, leg warmers, etc.)
- **`feet`** - Footwear (shoes, boots, socks, etc.)
- **`head_gear`** - Head coverings (hats, helmets, etc.)
- **`hands`** - Hand coverings (gloves, rings, etc.)
- **`left_arm_clothing`** - Left arm specific clothing
- **`right_arm_clothing`** - Right arm specific clothing

## Practical Examples

### Action Template Examples

#### Remove Upper Clothing Action

```json
{
  "id": "remove_upper_shirt",
  "targetScopes": {
    "target_item": "actor.topmost_clothing.torso_upper"
  },
  "conditions": [
    {
      "description": "Has something to remove",
      "logic": {
        "!=": [{ "var": "target_item.length" }, 0]
      }
    }
  ],
  "operations": [
    {
      "type": "unequip_item",
      "targetId": { "var": "target_item.0" }
    }
  ]
}
```

#### Remove All Outer Clothing Action

```json
{
  "id": "remove_outer_clothing",
  "targetScopes": {
    "outer_items": "actor.outer_clothing[]"
  },
  "conditions": [
    {
      "description": "Has outer clothing to remove",
      "logic": {
        ">": [{ "var": "outer_items.length" }, 0]
      }
    },
    {
      "description": "Location allows clothing removal",
      "logic": {
        "==": [{ "var": "location.privacy_level" }, "private"]
      }
    }
  ],
  "operations": [
    {
      "type": "for_each_item",
      "targetScope": "outer_items",
      "operations": [
        {
          "type": "unequip_item",
          "targetId": { "var": "item.id" }
        }
      ]
    }
  ]
}
```

#### Inspect Visible Clothing Action

```json
{
  "id": "inspect_clothing",
  "targetScopes": {
    "visible_items": "actor.visible_clothing[]"
  },
  "conditions": [
    {
      "description": "Has visible clothing",
      "logic": {
        ">": [{ "var": "visible_items.length" }, 0]
      }
    }
  ],
  "operations": [
    {
      "type": "generate_description",
      "context": {
        "items": { "var": "visible_items" }
      }
    }
  ]
}
```

### Conditional Logic Examples

#### Check for Formal Attire

```dsl
formal_items := actor.formal_clothing[]

# Use in condition:
# ">=": [{"var": "formal_items.length"}, 3]
```

#### Check for Dirty Clothing

```dsl
dirty_items := actor.dirty_clothing[]

# Use in condition:
# ">": [{"var": "dirty_items.length"}, 0]
```

#### Check Specific Slot

```dsl
has_jacket := actor.topmost_clothing.torso_upper

# Use in condition:
# "!=": [{"var": "has_jacket.length"}, 0]
```

## Integration with JSON Logic

Clothing scopes work seamlessly with JSON Logic for complex conditions:

```json
{
  "and": [
    {
      ">": [{ "var": "actor.visible_clothing[].length" }, 0]
    },
    {
      "not": {
        "hasClothingTags": [
          { "var": "actor.topmost_clothing.torso_upper.0" },
          "inappropriate"
        ]
      }
    }
  ]
}
```

## Custom JSON Logic Operators

The system provides clothing-specific JSON Logic operators:

### `isInClothingLayer`

Checks if an item is in a specific clothing layer.

```json
{
  "isInClothingLayer": [{ "var": "item_id" }, "outer"]
}
```

### `isEquippedInSlot`

Checks if an item is equipped in a specific slot.

```json
{
  "isEquippedInSlot": [
    { "var": "actor.id" },
    { "var": "item_id" },
    "torso_upper"
  ]
}
```

### `hasClothingTags`

Checks if clothing item has specific tags.

```json
{
  "hasClothingTags": [{ "var": "item_id" }, ["formal", "business"]]
}
```

### `isClothingDirty`

Checks if clothing item is dirty.

```json
{
  "isClothingDirty": [{ "var": "item_id" }]
}
```

## Performance Considerations

### Efficient Usage

- **Use specific slots** when possible: `actor.topmost_clothing.torso_upper` is more efficient than `actor.topmost_clothing[]` with filtering
- **Cache results** in complex actions: Store clothing queries in target scopes rather than repeating them
- **Prefer layer-specific queries**: `actor.outer_clothing[]` is more efficient than `actor.all_clothing[]` with layer filtering

### Performance Tips

```dsl
# Efficient - targets specific slot
upper_item := actor.topmost_clothing.torso_upper

# Less efficient - gets all items then filters
all_items := actor.topmost_clothing[][{
  "==": [{"var": "entity.slot"}, "torso_upper"]
}]
```

## Error Handling

The system provides comprehensive error handling with user-friendly messages:

### Common Errors

- **No clothing equipped**: "You don't have any clothing equipped in that slot."
- **Invalid operation**: "That clothing operation isn't available right now."
- **Data corruption**: "There's a problem with your equipment data. Trying to fix it..."

### Error Recovery

The system automatically attempts to recover from common errors:

- **Equipment data corruption**: Automatically rebuilds equipment data structure
- **Invalid slots**: Maps common slot name variants to valid slots
- **Layer inconsistencies**: Fixes invalid layer assignments

## Best Practices

### Action Design

1. **Use appropriate scopes** for your action type:
   - Removal actions: `topmost_clothing` or `removable_clothing`
   - Inspection actions: `visible_clothing` or `topmost_clothing`
   - Washing actions: `dirty_clothing`

2. **Add safety conditions**:

   ```json
   {
     "description": "Clothing is removable in this context",
     "logic": {
       "or": [
         { "==": [{ "var": "location.privacy_level" }, "private"] },
         {
           "not": {
             "isInClothingLayer": [{ "var": "target_item.0" }, "underwear"]
           }
         }
       ]
     }
   }
   ```

3. **Handle empty results gracefully**:
   ```json
   {
     "description": "Has items to target",
     "logic": {
       ">": [{ "var": "target_items.length" }, 0]
     }
   }
   ```

### Scope Definition

1. **Use descriptive names**:

   ```dsl
   removable_upper := actor.topmost_clothing.torso_upper
   all_dirty_items := actor.dirty_clothing[]
   ```

2. **Group related scopes**:

   ```json
   {
     "targetScopes": {
       "upper_clothing": "actor.topmost_clothing.torso_upper",
       "lower_clothing": "actor.topmost_clothing.torso_lower",
       "all_topmost": "actor.topmost_clothing[]"
     }
   }
   ```

3. **Consider context**:
   ```dsl
   # Context-appropriate scopes
   inspection_items := actor.visible_clothing[]
   removal_candidates := actor.removable_clothing[]
   washing_items := actor.dirty_clothing[]
   ```

## Troubleshooting

### Common Issues

**Issue**: Scope returns empty results
**Solution**: Check that the entity has clothing equipped in the targeted slots/layers

**Issue**: "Invalid clothing slot" error  
**Solution**: Verify slot names match the supported slots list

**Issue**: Performance is slow
**Solution**: Use more specific scopes instead of broad queries with filters

**Issue**: Inconsistent results
**Solution**: Check for equipment data corruption - the system will attempt automatic recovery

### Debugging

Enable trace logging to see detailed resolution steps:

```javascript
const result = scopeEngine.resolve(ast, actor, runtimeContext, traceContext);
```

The trace will show:

- Which clothing fields are being resolved
- Equipment data structure
- Items found in each slot/layer
- Cache hit/miss information
- Error recovery attempts

````

### 3.3.2: Create Developer API Documentation (1 hour)

**File**: `docs/clothing-scope-api.md`

```markdown
# Clothing Scope DSL API Reference

This document provides technical API documentation for developers working with the clothing scope DSL system.

## Core Classes

### ClothingStepResolver

Handles clothing-specific field access in scope DSL expressions.

```javascript
import createClothingStepResolver from './src/scopeDsl/nodes/clothingStepResolver.js';

const resolver = createClothingStepResolver({
  entitiesGateway,
  logger,
  userMessageService
});
````

#### Methods

**`canResolve(node): boolean`**

- Determines if the resolver can handle a given AST node
- Returns true for Step nodes with clothing field names

**`resolve(node, ctx): Set<string>`**

- Resolves clothing field access to entity IDs
- Handles both array syntax (`actor.topmost_clothing[]`) and dot notation (`actor.topmost_clothing.torso_upper`)

**`clearCache(): void`**

- Clears all cached clothing data

**`getCacheStats(): object`**

- Returns cache performance statistics

**`invalidateEntity(entityId): void`**

- Invalidates cached data for specific entity

### SlotAccessResolver

Handles specific clothing slot access after clothing field resolution.

```javascript
import createSlotAccessResolver from './src/scopeDsl/nodes/slotAccessResolver.js';

const resolver = createSlotAccessResolver({ entitiesGateway });
```

#### Methods

**`canResolve(node): boolean`**

- Returns true for Step nodes with clothing slot names

**`resolve(node, ctx): Set<string>`**

- Resolves slot access from clothing access objects

### ClothingCacheManager

Manages caching for clothing resolution performance.

```javascript
import ClothingCacheManager from './src/scopeDsl/core/clothingCacheManager.js';

const cache = new ClothingCacheManager({ logger });
```

#### Configuration

- `maxCacheSize`: Maximum number of cached entries (default: 1000)
- `cacheTimeout`: Cache expiration time in milliseconds (default: 30000)

#### Methods

**`getCachedEquipment(entityId): object|null`**

- Retrieves cached equipment data

**`cacheEquipment(entityId, data): void`**

- Caches equipment data for entity

**`getStats(): object`**

- Returns cache performance statistics

### ClothingErrorHandler

Provides comprehensive error handling for clothing operations.

```javascript
import ClothingErrorHandler from './src/scopeDsl/errors/clothingErrorHandler.js';

const errorHandler = new ClothingErrorHandler({
  logger,
  userMessageService,
});
```

#### Methods

**`handleClothingError(error, context): object`**

- Handles clothing-specific errors with recovery attempts
- Returns error handling result with user messages

### ActionTemplateValidator

Validates action templates that use clothing scopes.

```javascript
import ActionTemplateValidator from './src/actions/actionTemplateValidator.js';

const validator = new ActionTemplateValidator({
  logger,
  scopeRegistry,
});
```

#### Methods

**`validateActionTemplate(template): object`**

- Validates action template for clothing scope usage
- Returns validation result with errors and warnings

## Configuration

### Resolver Registration

Add clothing resolvers to the scope engine:

```javascript
// In src/scopeDsl/engine.js
_createResolvers({ locationProvider, entitiesGateway, logicEval }) {
  const clothingStepResolver = createClothingStepResolver({ entitiesGateway });
  const slotAccessResolver = createSlotAccessResolver({ entitiesGateway });

  return [
    clothingStepResolver,    // Higher priority
    slotAccessResolver,
    // ... other resolvers
  ];
}
```

### Custom JSON Logic Operators

Register clothing operators:

```javascript
// In src/logic/jsonLogicCustomOperators.js
import { clothingOperators } from './clothingOperators.js';

export const customOperators = {
  ...existingOperators,
  ...clothingOperators,
};
```

## Data Structures

### Equipment Component Structure

```javascript
{
  "clothing:equipment": {
    "equipped": {
      "torso_upper": {
        "outer": "jacket_entity_id",
        "base": "shirt_entity_id",
        "underwear": "undershirt_entity_id"
      },
      "torso_lower": {
        "outer": "pants_entity_id",
        "base": "shorts_entity_id"
      }
      // ... other slots
    },
    "unequipped": ["item_id_1", "item_id_2"],
    "preferences": {
      "auto_equip": true,
      "layer_preferences": ["outer", "base"]
    }
  }
}
```

### Wearable Component Structure

```javascript
{
  "clothing:wearable": {
    "equipmentSlots": {
      "primary": "torso_upper",
      "secondary": null
    },
    "layer": "outer",
    "tags": ["formal", "business", "waterproof"],
    "restrictions": {
      "weather": ["rain", "cold"],
      "context": ["formal", "business"]
    }
  }
}
```

### Condition Component Structure

```javascript
{
  "clothing:condition": {
    "dirty": false,
    "cleanliness": 85,
    "durability": 92,
    "lastWashed": "2025-01-20T10:30:00Z",
    "wearCount": 5
  }
}
```

## Error Types

### ClothingEquipmentError

Thrown when equipment data is malformed or corrupted.

```javascript
throw new ClothingEquipmentError(entityId, {
  reason: 'corrupted_data',
  details: 'Equipment slots contain invalid data',
});
```

### InvalidClothingSlotError

Thrown when an invalid clothing slot is referenced.

```javascript
throw new InvalidClothingSlotError('invalid_slot', validSlots);
```

### InvalidClothingLayerError

Thrown when an invalid clothing layer is referenced.

```javascript
throw new InvalidClothingLayerError('invalid_layer', validLayers);
```

## Performance Optimization

### Caching Strategy

The system uses multi-level caching:

1. **Equipment data cache**: Caches raw equipment components
2. **Resolution cache**: Caches resolved clothing queries
3. **Component cache**: Caches wearable/condition component data

### Performance Monitoring

Monitor performance with cache statistics:

```javascript
const stats = clothingResolver.getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
```

### Memory Management

- Cache automatically evicts old entries when limits are reached
- Cache entries expire after configurable timeout
- Manual cache invalidation available for entity updates

## Testing Utilities

### Mock Data Helpers

```javascript
// Create mock equipment data
function createMockEquipment(slots = {}) {
  return {
    equipped: {
      torso_upper: { outer: 'jacket_1', base: 'shirt_1' },
      torso_lower: { outer: 'pants_1' },
      ...slots,
    },
    unequipped: [],
    preferences: {},
  };
}

// Create mock entities gateway
function createMockEntitiesGateway(equipmentData) {
  return {
    getComponentData: jest.fn().mockImplementation((entityId, componentId) => {
      if (componentId === 'clothing:equipment') {
        return equipmentData;
      }
      return null;
    }),
  };
}
```

### Test Patterns

```javascript
describe('Clothing Resolution', () => {
  let resolver;
  let mockEntitiesGateway;

  beforeEach(() => {
    const mockEquipment = createMockEquipment();
    mockEntitiesGateway = createMockEntitiesGateway(mockEquipment);
    resolver = createClothingStepResolver({
      entitiesGateway: mockEntitiesGateway,
    });
  });

  it('should resolve topmost clothing', () => {
    const node = { type: 'Step', field: 'topmost_clothing', isArray: true };
    const context = {
      dispatcher: { resolve: jest.fn().mockReturnValue(new Set(['actor_1'])) },
      trace: { addLog: jest.fn() },
    };

    const result = resolver.resolve(node, context);

    expect(result).toEqual(new Set(['jacket_1', 'pants_1']));
  });
});
```

## Migration Guide

### From Complex JSON Logic

Before:

```json
{
  "targetScope": "entities(clothing:wearable)[{\n  \"and\": [\n    {\"==\": [{\"var\": \"entity.components.clothing:wearable.equipmentSlots.primary\"}, \"torso_upper\"]},\n    {\"or\": [\n      {\"and\": [\n        {\"hasClothingInSlotLayer\": [\"actor\", \"torso_upper\", \"outer\"]},\n        {\"==\": [{\"var\": \"entity.components.clothing:wearable.layer\"}, \"outer\"]}\n      ]}\n    ]}\n  ]\n}]"
}
```

After:

```json
{
  "targetScope": "actor.topmost_clothing.torso_upper"
}
```

### Updating Existing Actions

1. Replace complex equipment queries with simple clothing scopes
2. Update conditions to use clothing-specific operators
3. Test thoroughly with existing equipment data
4. Monitor performance improvements

## Troubleshooting

### Common Issues

**Resolver not found**: Ensure clothing resolvers are registered in engine
**Cache not working**: Check cache configuration and entity invalidation
**Performance issues**: Monitor cache hit rates and optimize queries
**Error handling**: Verify error handler integration and recovery strategies

### Debug Information

Enable detailed logging:

```javascript
const trace = createTraceContext();
const result = engine.resolve(ast, actor, runtimeContext, trace);
console.log(trace.getLogs());
```

```

---

## Phase 3 Completion Checklist

### Action Integration Complete
- [ ] Action template validator created and integrated
- [ ] Clothing scope validation added to action loading
- [ ] Comprehensive action template examples created
- [ ] Action type compatibility validation implemented

### Error Handling System
- [ ] Comprehensive clothing error handler implemented
- [ ] Error recovery service with automatic repair strategies
- [ ] User-friendly error messages and recovery suggestions
- [ ] Error handling integrated into all resolvers
- [ ] Diagnostic information generation for developers

### Production Documentation
- [ ] Complete user guide with practical examples
- [ ] Technical API documentation for developers
- [ ] Performance optimization guidelines
- [ ] Troubleshooting and debugging guides
- [ ] Migration guide from complex JSON Logic

### Quality Assurance
- [ ] All error scenarios tested and handled
- [ ] Performance benchmarks met with error handling
- [ ] User message clarity verified
- [ ] Developer API documentation accuracy confirmed

### Integration Testing
- [ ] Action template validation tested with real templates
- [ ] Error recovery tested with corrupted data
- [ ] User experience tested with various error conditions
- [ ] Documentation examples verified to work correctly

### Production Readiness
- [ ] Error messages reviewed for user-friendliness
- [ ] Performance impact of error handling measured
- [ ] Logging and monitoring integration tested
- [ ] Recovery statistics tracking implemented

### Next Steps

Proceed to **Phase 4** for advanced features, comprehensive E2E testing, and final production validation.

**Continue to**: [scope-dsl-clothing-implementation-phase4.workflow.md](./scope-dsl-clothing-implementation-phase4.workflow.md)
```
