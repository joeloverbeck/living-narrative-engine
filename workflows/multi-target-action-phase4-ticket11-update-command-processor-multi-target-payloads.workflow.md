# Ticket: Update CommandProcessor for Multi-Target Payloads

## Ticket ID: PHASE4-TICKET11
## Priority: Medium
## Estimated Time: 5-7 hours
## Dependencies: PHASE2-TICKET4, PHASE2-TICKET5, PHASE2-TICKET6
## Blocks: PHASE4-TICKET14, PHASE5-TICKET17

## Overview

Update the command processor and event dispatcher to handle multi-target action payloads, ensuring that when multi-target actions are executed, all target information is properly propagated through the event system to rule handlers and other components.

## Key Changes

1. **Payload Structure**: Update event payload format for multi-target actions
2. **Command Processing**: Enhance command processor to handle new payload structure
3. **Event Dispatching**: Ensure proper event distribution with all target data
4. **Rule Compatibility**: Maintain backward compatibility with existing rules
5. **Error Handling**: Robust error handling for malformed payloads

## Current State Analysis

The current system likely expects single-target payloads with structure:
```javascript
{
  actionId: 'action:id',
  actorId: 'actor_001',
  targetId: 'target_001', // Single target
  // ... other properties
}
```

New system should support:
```javascript
{
  actionId: 'action:id',
  actorId: 'actor_001',
  targetId: 'target_001', // Legacy compatibility
  targets: {            // New multi-target structure
    primary: { id: 'target_001', ... },
    secondary: { id: 'target_002', ... },
    tertiary: { id: 'target_003', ... }
  },
  // ... other properties
}
```

## Implementation Steps

### Step 1: Update Event Payload Schema

Create file: `data/schemas/events/action-execution.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "action-execution.schema.json",
  "title": "Action Execution Event Payload",
  "description": "Schema for action execution event payloads supporting both single and multi-target actions",
  "type": "object",
  "properties": {
    "actionId": {
      "type": "string",
      "description": "ID of the action being executed",
      "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
    },
    "actorId": {
      "type": "string",
      "description": "ID of the entity performing the action"
    },
    "targetId": {
      "type": "string",
      "description": "Legacy single target ID for backward compatibility"
    },
    "targets": {
      "type": "object",
      "description": "Multi-target structure with named target groups",
      "properties": {
        "primary": {
          "$ref": "#/definitions/targetInfo"
        },
        "secondary": {
          "$ref": "#/definitions/targetInfo"
        },
        "tertiary": {
          "$ref": "#/definitions/targetInfo"
        }
      },
      "additionalProperties": {
        "$ref": "#/definitions/targetInfo"
      }
    },
    "context": {
      "type": "object",
      "description": "Additional context for action execution",
      "properties": {
        "location": {
          "type": "string",
          "description": "Location where action is performed"
        },
        "timestamp": {
          "type": "number",
          "description": "When the action was executed"
        }
      }
    },
    "metadata": {
      "type": "object",
      "description": "Additional metadata about the action execution",
      "properties": {
        "isMultiTarget": {
          "type": "boolean",
          "description": "Whether this is a multi-target action"
        },
        "formattedText": {
          "type": "string",
          "description": "Human-readable action description"
        },
        "combinations": {
          "type": "array",
          "description": "For combination actions, all target combinations",
          "items": {
            "type": "object"
          }
        }
      }
    }
  },
  "required": ["actionId", "actorId"],
  "anyOf": [
    {
      "required": ["targetId"]
    },
    {
      "required": ["targets"]
    }
  ],
  "definitions": {
    "targetInfo": {
      "type": "object",
      "description": "Information about a target entity",
      "properties": {
        "id": {
          "type": "string",
          "description": "Entity ID of the target"
        },
        "displayName": {
          "type": "string",
          "description": "Human-readable name of the target"
        },
        "placeholder": {
          "type": "string",
          "description": "Placeholder used in action template"
        },
        "components": {
          "type": "object",
          "description": "Relevant components of the target entity"
        }
      },
      "required": ["id"]
    }
  }
}
```

### Step 2: Update Command Processor

Update file: `src/commands/commandProcessor.js` (or similar path):

```javascript
/**
 * @file Enhanced CommandProcessor with multi-target support
 */

// Type imports
/** @typedef {import('../actions/actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../events/eventBus.js').default} IEventBus */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */

import { validateDependency } from '../utils/validationUtils.js';
import { CommandResult } from './commandResult.js';

/**
 * @typedef {Object} ActionCommand
 * @property {string} actionId - Action definition ID
 * @property {string} actorId - Actor entity ID
 * @property {string} [targetId] - Legacy single target ID
 * @property {Object} [targets] - Multi-target structure
 * @property {Object} [context] - Additional context
 * @property {Object} [metadata] - Action metadata
 */

/**
 * Processes action commands and dispatches appropriate events
 */
export class CommandProcessor {
  #eventBus;
  #entityManager;
  #actionRegistry;
  #logger;
  #payloadValidator;

  /**
   * @param {Object} deps
   * @param {IEventBus} deps.eventBus
   * @param {IEntityManager} deps.entityManager
   * @param {IActionRegistry} deps.actionRegistry
   * @param {ILogger} deps.logger
   * @param {Function} [deps.payloadValidator] - Custom payload validator
   */
  constructor({ 
    eventBus, 
    entityManager, 
    actionRegistry, 
    logger,
    payloadValidator 
  }) {
    validateDependency(eventBus, 'IEventBus');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(actionRegistry, 'IActionRegistry');
    validateDependency(logger, 'ILogger');

    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    this.#actionRegistry = actionRegistry;
    this.#logger = logger;
    this.#payloadValidator = payloadValidator || this.#defaultPayloadValidator.bind(this);
  }

  /**
   * Process an action command
   * @param {ActionCommand} command - Command to process
   * @returns {Promise<CommandResult>}
   */
  async processCommand(command) {
    try {
      this.#logger.debug(`Processing command: ${command.actionId}`, command);

      // Validate command structure
      const validationResult = this.#validateCommand(command);
      if (!validationResult.valid) {
        return CommandResult.failure(
          new Error(`Invalid command: ${validationResult.errors.join(', ')}`)
        );
      }

      // Get action definition
      const actionDef = this.#actionRegistry.getAction(command.actionId);
      if (!actionDef) {
        return CommandResult.failure(
          new Error(`Unknown action: ${command.actionId}`)
        );
      }

      // Validate entities exist
      const entityValidation = await this.#validateEntities(command);
      if (!entityValidation.valid) {
        return CommandResult.failure(
          new Error(`Entity validation failed: ${entityValidation.errors.join(', ')}`)
        );
      }

      // Build enhanced payload
      const payload = this.#buildEventPayload(command, actionDef);

      // Validate payload against schema
      const payloadValidation = this.#payloadValidator(payload);
      if (!payloadValidation.valid) {
        return CommandResult.failure(
          new Error(`Payload validation failed: ${payloadValidation.errors.join(', ')}`)
        );
      }

      // Dispatch core action event
      await this.#eventBus.dispatch({
        type: 'core:attempt_action',
        payload,
        source: 'CommandProcessor'
      });

      // Dispatch action-specific event if configured
      if (actionDef.emitSpecificEvent !== false) {
        await this.#eventBus.dispatch({
          type: `${command.actionId.replace(':', '_')}_attempted`,
          payload,
          source: 'CommandProcessor'
        });
      }

      this.#logger.info(`Command processed successfully: ${command.actionId}`);
      return CommandResult.success(payload);

    } catch (error) {
      this.#logger.error(`Error processing command ${command.actionId}:`, error);
      return CommandResult.failure(error);
    }
  }

  /**
   * Process multiple commands in sequence
   * @param {ActionCommand[]} commands - Commands to process
   * @returns {Promise<CommandResult[]>}
   */
  async processCommands(commands) {
    const results = [];
    
    for (const command of commands) {
      const result = await this.processCommand(command);
      results.push(result);
      
      // Stop on first failure if configured
      if (!result.success && this.#shouldStopOnFailure(command)) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Validate command structure
   * @private
   */
  #validateCommand(command) {
    const errors = [];

    if (!command.actionId) {
      errors.push('actionId is required');
    }

    if (!command.actorId) {
      errors.push('actorId is required');
    }

    // Must have either targetId (legacy) or targets (new format)
    if (!command.targetId && !command.targets) {
      errors.push('Either targetId or targets must be provided');
    }

    // Validate targets structure if present
    if (command.targets) {
      const targetValidation = this.#validateTargetsStructure(command.targets);
      if (!targetValidation.valid) {
        errors.push(...targetValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate targets structure
   * @private
   */
  #validateTargetsStructure(targets) {
    const errors = [];

    if (typeof targets !== 'object' || targets === null) {
      errors.push('targets must be an object');
      return { valid: false, errors };
    }

    for (const [key, target] of Object.entries(targets)) {
      if (!target || typeof target !== 'object') {
        errors.push(`targets.${key} must be an object`);
        continue;
      }

      if (!target.id) {
        errors.push(`targets.${key}.id is required`);
      }

      if (typeof target.id !== 'string') {
        errors.push(`targets.${key}.id must be a string`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate that all referenced entities exist
   * @private
   */
  async #validateEntities(command) {
    const errors = [];

    // Validate actor
    const actor = this.#entityManager.getEntity(command.actorId);
    if (!actor) {
      errors.push(`Actor entity not found: ${command.actorId}`);
    }

    // Validate legacy target
    if (command.targetId) {
      const target = this.#entityManager.getEntity(command.targetId);
      if (!target) {
        errors.push(`Target entity not found: ${command.targetId}`);
      }
    }

    // Validate multi-target entities
    if (command.targets) {
      for (const [key, target] of Object.entries(command.targets)) {
        const entity = this.#entityManager.getEntity(target.id);
        if (!entity) {
          errors.push(`Target entity not found: ${key}.${target.id}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build event payload from command
   * @private
   */
  #buildEventPayload(command, actionDef) {
    const payload = {
      actionId: command.actionId,
      actorId: command.actorId,
      timestamp: Date.now(),
      context: {
        location: command.context?.location,
        ...command.context
      },
      metadata: {
        isMultiTarget: Boolean(command.targets && Object.keys(command.targets).length > 1),
        formattedText: command.metadata?.formattedText,
        actionDefinition: actionDef,
        ...command.metadata
      }
    };

    // Add legacy targetId for backward compatibility
    if (command.targetId) {
      payload.targetId = command.targetId;
    } else if (command.targets?.primary) {
      // Use primary target as legacy targetId
      payload.targetId = command.targets.primary.id;
    }

    // Add multi-target information
    if (command.targets) {
      payload.targets = this.#enrichTargetInfo(command.targets);
    }

    return payload;
  }

  /**
   * Enrich target information with entity data
   * @private
   */
  #enrichTargetInfo(targets) {
    const enriched = {};

    for (const [key, target] of Object.entries(targets)) {
      const entity = this.#entityManager.getEntity(target.id);
      
      enriched[key] = {
        id: target.id,
        displayName: target.displayName || this.#getEntityDisplayName(entity),
        placeholder: target.placeholder,
        components: entity ? this.#getRelevantComponents(entity) : {},
        ...target // Preserve any additional properties
      };
    }

    return enriched;
  }

  /**
   * Get display name for entity
   * @private
   */
  #getEntityDisplayName(entity) {
    if (!entity) return 'Unknown';

    // Try common name sources
    const nameSources = [
      () => entity.getComponent('core:actor')?.name,
      () => entity.getComponent('core:item')?.name,
      () => entity.getComponent('core:location')?.name,
      () => entity.id
    ];

    for (const getNameFn of nameSources) {
      const name = getNameFn();
      if (name) return name;
    }

    return entity.id;
  }

  /**
   * Get relevant components for target info
   * @private
   */
  #getRelevantComponents(entity) {
    if (!entity) return {};

    // Get all components but filter out large or sensitive data
    const allComponents = entity.getAllComponents();
    const relevant = {};

    for (const [componentId, component] of Object.entries(allComponents)) {
      // Skip internal or large components
      if (componentId.startsWith('_') || 
          componentId.includes('cache') ||
          componentId.includes('internal')) {
        continue;
      }

      // Include relevant component data
      relevant[componentId] = component;
    }

    return relevant;
  }

  /**
   * Default payload validator
   * @private
   */
  #defaultPayloadValidator(payload) {
    const errors = [];

    // Basic required fields
    if (!payload.actionId) errors.push('actionId is required');
    if (!payload.actorId) errors.push('actorId is required');
    if (!payload.timestamp) errors.push('timestamp is required');

    // Target validation
    if (!payload.targetId && !payload.targets) {
      errors.push('Either targetId or targets is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if processing should stop on failure
   * @private
   */
  #shouldStopOnFailure(command) {
    // Could be configurable per action type
    return command.metadata?.stopOnFailure !== false;
  }
}

export default CommandProcessor;
```

### Step 3: Create Command Result Type

Create file: `src/commands/commandResult.js`

```javascript
/**
 * @file Command processing result type
 */

/**
 * Result of command processing
 */
export class CommandResult {
  #success;
  #data;
  #error;
  #metadata;

  /**
   * @param {boolean} success - Whether command succeeded
   * @param {*} data - Result data if successful
   * @param {Error} [error] - Error if failed
   * @param {Object} [metadata] - Additional metadata
   */
  constructor(success, data, error = null, metadata = {}) {
    this.#success = success;
    this.#data = data;
    this.#error = error;
    this.#metadata = metadata;
  }

  /**
   * Create successful result
   * @param {*} data - Success data
   * @param {Object} [metadata] - Additional metadata
   * @returns {CommandResult}
   */
  static success(data, metadata = {}) {
    return new CommandResult(true, data, null, metadata);
  }

  /**
   * Create failure result
   * @param {Error} error - Error that occurred
   * @param {Object} [metadata] - Additional metadata
   * @returns {CommandResult}
   */
  static failure(error, metadata = {}) {
    return new CommandResult(false, null, error, metadata);
  }

  /**
   * Whether command succeeded
   */
  get success() {
    return this.#success;
  }

  /**
   * Result data (if successful)
   */
  get data() {
    return this.#data;
  }

  /**
   * Error (if failed)
   */
  get error() {
    return this.#error;
  }

  /**
   * Additional metadata
   */
  get metadata() {
    return this.#metadata;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      success: this.#success,
      data: this.#data,
      error: this.#error ? {
        message: this.#error.message,
        stack: this.#error.stack
      } : null,
      metadata: this.#metadata
    };
  }
}

export default CommandResult;
```

### Step 4: Update Event Dispatcher Integration

Create file: `src/commands/multiTargetEventDispatcher.js`

```javascript
/**
 * @file Event dispatcher specifically for multi-target actions
 */

import { validateDependency } from '../utils/validationUtils.js';

/**
 * Handles dispatching events for multi-target actions
 */
export class MultiTargetEventDispatcher {
  #eventBus;
  #logger;

  /**
   * @param {Object} deps
   * @param {IEventBus} deps.eventBus
   * @param {ILogger} deps.logger
   */
  constructor({ eventBus, logger }) {
    validateDependency(eventBus, 'IEventBus');
    validateDependency(logger, 'ILogger');

    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  /**
   * Dispatch events for multi-target action
   * @param {Object} payload - Action payload
   * @param {ActionDefinition} actionDef - Action definition
   */
  async dispatchMultiTargetEvents(payload, actionDef) {
    try {
      // Dispatch main action event
      await this.#dispatchMainEvent(payload, actionDef);

      // Dispatch per-target events if configured
      if (actionDef.emitPerTargetEvents) {
        await this.#dispatchPerTargetEvents(payload, actionDef);
      }

      // Dispatch combination events for combination actions
      if (payload.metadata?.combinations) {
        await this.#dispatchCombinationEvents(payload, actionDef);
      }

    } catch (error) {
      this.#logger.error('Error dispatching multi-target events:', error);
      throw error;
    }
  }

  /**
   * Dispatch main action event
   * @private
   */
  async #dispatchMainEvent(payload, actionDef) {
    const event = {
      type: 'core:attempt_action',
      payload,
      source: 'MultiTargetEventDispatcher',
      timestamp: Date.now()
    };

    await this.#eventBus.dispatch(event);
    this.#logger.debug(`Dispatched main event for ${payload.actionId}`);
  }

  /**
   * Dispatch individual events for each target
   * @private
   */
  async #dispatchPerTargetEvents(payload, actionDef) {
    if (!payload.targets) return;

    for (const [targetKey, target] of Object.entries(payload.targets)) {
      const perTargetEvent = {
        type: `${payload.actionId.replace(':', '_')}_target_${targetKey}`,
        payload: {
          ...payload,
          currentTarget: target,
          targetKey
        },
        source: 'MultiTargetEventDispatcher',
        timestamp: Date.now()
      };

      await this.#eventBus.dispatch(perTargetEvent);
      this.#logger.debug(`Dispatched per-target event for ${targetKey}: ${target.id}`);
    }
  }

  /**
   * Dispatch events for action combinations
   * @private
   */
  async #dispatchCombinationEvents(payload, actionDef) {
    for (const [index, combination] of payload.metadata.combinations.entries()) {
      const combinationEvent = {
        type: `${payload.actionId.replace(':', '_')}_combination`,
        payload: {
          ...payload,
          currentCombination: combination,
          combinationIndex: index
        },
        source: 'MultiTargetEventDispatcher',
        timestamp: Date.now()
      };

      await this.#eventBus.dispatch(combinationEvent);
    }

    this.#logger.debug(`Dispatched ${payload.metadata.combinations.length} combination events`);
  }
}

export default MultiTargetEventDispatcher;
```

### Step 5: Create Unit Tests

Create file: `tests/unit/commands/commandProcessor.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CommandProcessor } from '../../../src/commands/commandProcessor.js';
import { CommandResult } from '../../../src/commands/commandResult.js';

describe('CommandProcessor', () => {
  let processor;
  let mockEventBus;
  let mockEntityManager;
  let mockActionRegistry;
  let mockLogger;

  beforeEach(() => {
    mockEventBus = {
      dispatch: jest.fn()
    };

    mockEntityManager = {
      getEntity: jest.fn()
    };

    mockActionRegistry = {
      getAction: jest.fn()
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    processor = new CommandProcessor({
      eventBus: mockEventBus,
      entityManager: mockEntityManager,
      actionRegistry: mockActionRegistry,
      logger: mockLogger
    });
  });

  describe('Legacy Command Processing', () => {
    it('should process legacy single-target command', async () => {
      const command = {
        actionId: 'test:eat',
        actorId: 'player',
        targetId: 'apple_001',
        context: { location: 'kitchen' }
      };

      const actionDef = {
        id: 'test:eat',
        name: 'Eat',
        template: 'eat {target}'
      };

      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'player', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'apple_001', getComponent: jest.fn() });

      const result = await processor.processCommand(command);

      expect(result.success).toBe(true);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'core:attempt_action',
        payload: expect.objectContaining({
          actionId: 'test:eat',
          actorId: 'player',
          targetId: 'apple_001'
        }),
        source: 'CommandProcessor'
      });
    });
  });

  describe('Multi-Target Command Processing', () => {
    it('should process multi-target command', async () => {
      const command = {
        actionId: 'combat:throw',
        actorId: 'player',
        targets: {
          primary: { id: 'rock_001', displayName: 'Rock' },
          secondary: { id: 'goblin_001', displayName: 'Goblin' }
        },
        context: { location: 'battlefield' }
      };

      const actionDef = {
        id: 'combat:throw',
        name: 'Throw',
        targets: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' }
        },
        template: 'throw {item} at {target}'
      };

      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'player', getComponent: jest.fn(), getAllComponents: () => ({}) })
        .mockReturnValueOnce({ id: 'rock_001', getComponent: jest.fn(), getAllComponents: () => ({}) })
        .mockReturnValueOnce({ id: 'goblin_001', getComponent: jest.fn(), getAllComponents: () => ({}) });

      const result = await processor.processCommand(command);

      expect(result.success).toBe(true);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'core:attempt_action',
        payload: expect.objectContaining({
          actionId: 'combat:throw',
          actorId: 'player',
          targetId: 'rock_001', // Primary target as legacy targetId
          targets: {
            primary: expect.objectContaining({
              id: 'rock_001',
              displayName: 'Rock'
            }),
            secondary: expect.objectContaining({
              id: 'goblin_001',
              displayName: 'Goblin'
            })
          },
          metadata: expect.objectContaining({
            isMultiTarget: true
          })
        }),
        source: 'CommandProcessor'
      });
    });

    it('should handle commands with only primary target', async () => {
      const command = {
        actionId: 'test:single_multi',
        actorId: 'player',
        targets: {
          primary: { id: 'item_001', displayName: 'Item' }
        }
      };

      const actionDef = {
        id: 'test:single_multi',
        name: 'Single Multi'
      };

      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'player', getComponent: jest.fn(), getAllComponents: () => ({}) })
        .mockReturnValueOnce({ id: 'item_001', getComponent: jest.fn(), getAllComponents: () => ({}) });

      const result = await processor.processCommand(command);

      expect(result.success).toBe(true);
      expect(result.data.metadata.isMultiTarget).toBe(false); // Only one target
    });
  });

  describe('Validation', () => {
    it('should reject command without actionId', async () => {
      const command = {
        actorId: 'player',
        targetId: 'target_001'
      };

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('actionId is required');
    });

    it('should reject command without actorId', async () => {
      const command = {
        actionId: 'test:action',
        targetId: 'target_001'
      };

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('actorId is required');
    });

    it('should reject command without targets or targetId', async () => {
      const command = {
        actionId: 'test:action',
        actorId: 'player'
      };

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Either targetId or targets must be provided');
    });

    it('should reject command with invalid targets structure', async () => {
      const command = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { /* missing id */ displayName: 'Test' }
        }
      };

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('targets.primary.id is required');
    });

    it('should reject command with non-existent entities', async () => {
      const command = {
        actionId: 'test:action',
        actorId: 'nonexistent_player',
        targetId: 'target_001'
      };

      const actionDef = { id: 'test:action' };
      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity.mockReturnValue(null);

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Actor entity not found');
    });

    it('should reject command for unknown action', async () => {
      const command = {
        actionId: 'unknown:action',
        actorId: 'player',
        targetId: 'target_001'
      };

      mockActionRegistry.getAction.mockReturnValue(null);

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Unknown action');
    });
  });

  describe('Payload Enrichment', () => {
    it('should enrich target information with entity data', async () => {
      const command = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { id: 'item_001' }
        }
      };

      const actionDef = { id: 'test:action' };
      const itemEntity = {
        id: 'item_001',
        getComponent: jest.fn().mockReturnValue({ name: 'Magic Sword' }),
        getAllComponents: jest.fn().mockReturnValue({
          'core:item': { name: 'Magic Sword', type: 'weapon' }
        })
      };

      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'player', getComponent: jest.fn(), getAllComponents: () => ({}) })
        .mockReturnValueOnce(itemEntity);

      const result = await processor.processCommand(command);

      expect(result.success).toBe(true);
      expect(result.data.targets.primary).toEqual({
        id: 'item_001',
        displayName: 'Magic Sword',
        placeholder: undefined,
        components: {
          'core:item': { name: 'Magic Sword', type: 'weapon' }
        }
      });
    });

    it('should use fallback display name when entity name not available', async () => {
      const command = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { id: 'unnamed_001' }
        }
      };

      const actionDef = { id: 'test:action' };
      const unnamedEntity = {
        id: 'unnamed_001',
        getComponent: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({})
      };

      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'player', getComponent: jest.fn(), getAllComponents: () => ({}) })
        .mockReturnValueOnce(unnamedEntity);

      const result = await processor.processCommand(command);

      expect(result.success).toBe(true);
      expect(result.data.targets.primary.displayName).toBe('unnamed_001');
    });
  });

  describe('Error Handling', () => {
    it('should handle event dispatch errors gracefully', async () => {
      const command = {
        actionId: 'test:action',
        actorId: 'player',
        targetId: 'target_001'
      };

      const actionDef = { id: 'test:action' };
      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity.mockReturnValue({ id: 'test', getComponent: jest.fn() });
      mockEventBus.dispatch.mockRejectedValue(new Error('Event bus error'));

      const result = await processor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Event bus error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple commands in sequence', async () => {
      const commands = [
        {
          actionId: 'test:action1',
          actorId: 'player',
          targetId: 'target_001'
        },
        {
          actionId: 'test:action2',
          actorId: 'player',
          targetId: 'target_002'
        }
      ];

      const actionDef = { id: 'test:action' };
      mockActionRegistry.getAction.mockReturnValue(actionDef);
      mockEntityManager.getEntity.mockReturnValue({ id: 'test', getComponent: jest.fn() });

      const results = await processor.processCommands(commands);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(4); // 2 main events + 2 specific events
    });

    it('should stop on failure when configured', async () => {
      const commands = [
        {
          actionId: 'unknown:action',
          actorId: 'player',
          targetId: 'target_001'
        },
        {
          actionId: 'test:action2',
          actorId: 'player',
          targetId: 'target_002'
        }
      ];

      mockActionRegistry.getAction.mockReturnValue(null); // First action doesn't exist

      const results = await processor.processCommands(commands);

      expect(results).toHaveLength(1); // Should stop after first failure
      expect(results[0].success).toBe(false);
    });
  });
});
```

### Step 6: Integration Tests

Create file: `tests/integration/commands/multiTargetCommandProcessing.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Multi-Target Command Processing Integration', () => {
  let testBed;
  let commandProcessor;
  let eventBus;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    commandProcessor = testBed.getService('commandProcessor');
    eventBus = testBed.getService('eventBus');

    // Set up event listeners to capture dispatched events
    testBed.setupEventCapture();
  });

  describe('End-to-End Command Processing', () => {
    it('should process throw action command with full event dispatch', async () => {
      // Create game entities
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Hero' },
        'core:inventory': { items: ['rock_001'] },
        'core:position': { locationId: 'battlefield' }
      });

      const rock = testBed.createEntity('rock_001', {
        'core:item': { name: 'Sharp Rock', type: 'throwable', damage: 5 }
      });

      const goblin = testBed.createEntity('goblin_001', {
        'core:actor': { name: 'Goblin Scout' },
        'core:health': { current: 30, max: 30 },
        'core:position': { locationId: 'battlefield' }
      });

      // Register throw action
      const throwAction = {
        id: 'combat:throw',
        name: 'Throw',
        targets: {
          primary: { scope: 'actor.core:inventory.items[]', placeholder: 'item' },
          secondary: { scope: 'location.core:actors[]', placeholder: 'target' }
        },
        template: 'throw {item} at {target}'
      };
      testBed.registerAction(throwAction);

      // Create command
      const command = {
        actionId: 'combat:throw',
        actorId: 'player',
        targets: {
          primary: { id: 'rock_001', displayName: 'Sharp Rock', placeholder: 'item' },
          secondary: { id: 'goblin_001', displayName: 'Goblin Scout', placeholder: 'target' }
        },
        context: { location: 'battlefield' },
        metadata: { formattedText: 'throw Sharp Rock at Goblin Scout' }
      };

      // Process command
      const result = await commandProcessor.processCommand(command);

      // Verify command processing
      expect(result.success).toBe(true);
      expect(result.data.targets.primary.id).toBe('rock_001');
      expect(result.data.targets.secondary.id).toBe('goblin_001');

      // Verify events were dispatched
      const capturedEvents = testBed.getCapturedEvents();
      
      const actionEvent = capturedEvents.find(e => e.type === 'core:attempt_action');
      expect(actionEvent).toBeDefined();
      expect(actionEvent.payload.actionId).toBe('combat:throw');
      expect(actionEvent.payload.targets.primary.id).toBe('rock_001');
      expect(actionEvent.payload.targets.secondary.id).toBe('goblin_001');
    });

    it('should handle clothing adjustment with context-dependent targets', async () => {
      // Create entities
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Tailor' },
        'tailoring:skill': { level: 3 }
      });

      const customer = testBed.createEntity('customer_001', {
        'core:actor': { name: 'Alice' },
        'clothing:equipment': {
          equipped: { torso_upper: { outer: 'jacket_001' } }
        }
      });

      const jacket = testBed.createEntity('jacket_001', {
        'core:item': { name: 'Blue Jacket' },
        'clothing:garment': { properties: ['adjustable'] }
      });

      // Register action
      const adjustAction = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        targets: {
          primary: { scope: 'location.core:actors[]', placeholder: 'person' },
          secondary: { 
            scope: 'target.topmost_clothing[]', 
            placeholder: 'garment',
            contextFrom: 'primary'
          }
        },
        template: 'adjust {person}\'s {garment}'
      };
      testBed.registerAction(adjustAction);

      const command = {
        actionId: 'intimacy:adjust_clothing',
        actorId: 'player',
        targets: {
          primary: { id: 'customer_001', displayName: 'Alice', placeholder: 'person' },
          secondary: { id: 'jacket_001', displayName: 'Blue Jacket', placeholder: 'garment' }
        },
        metadata: { formattedText: 'adjust Alice\'s Blue Jacket' }
      };

      const result = await commandProcessor.processCommand(command);

      expect(result.success).toBe(true);
      expect(result.data.metadata.isMultiTarget).toBe(true);

      // Verify proper target context was maintained
      const capturedEvents = testBed.getCapturedEvents();
      const actionEvent = capturedEvents.find(e => e.type === 'core:attempt_action');
      
      expect(actionEvent.payload.targets.primary.id).toBe('customer_001');
      expect(actionEvent.payload.targets.secondary.id).toBe('jacket_001');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid target references gracefully', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' }
      });

      const command = {
        actionId: 'test:invalid',
        actorId: 'player',
        targets: {
          primary: { id: 'nonexistent_001', displayName: 'Ghost Item' }
        }
      };

      testBed.registerAction({
        id: 'test:invalid',
        name: 'Invalid Action'
      });

      const result = await commandProcessor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Target entity not found');
    });

    it('should handle malformed command payloads', async () => {
      const command = {
        actionId: 'test:malformed',
        actorId: 'player',
        targets: null // Invalid targets
      };

      const result = await commandProcessor.processCommand(command);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Either targetId or targets must be provided');
    });
  });

  describe('Performance', () => {
    it('should process large multi-target commands efficiently', async () => {
      // Create many entities
      const itemIds = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const targetIds = Array.from({ length: 50 }, (_, i) => `target_${i}`);

      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' }
      });

      itemIds.forEach(id => {
        testBed.createEntity(id, {
          'core:item': { name: `Item ${id}` }
        });
      });

      targetIds.forEach(id => {
        testBed.createEntity(id, {
          'core:actor': { name: `Target ${id}` }
        });
      });

      const command = {
        actionId: 'test:large',
        actorId: 'player',
        targets: {
          primary: { id: 'item_0', displayName: 'Item 0' },
          secondary: { id: 'target_0', displayName: 'Target 0' }
        },
        metadata: {
          combinations: itemIds.slice(0, 10).map((itemId, i) => ({
            primary: { id: itemId },
            secondary: { id: targetIds[i % targetIds.length] }
          }))
        }
      };

      testBed.registerAction({
        id: 'test:large',
        name: 'Large Action'
      });

      const start = performance.now();
      const result = await commandProcessor.processCommand(command);
      const end = performance.now();

      expect(result.success).toBe(true);
      expect(end - start).toBeLessThan(100); // < 100ms
    });
  });
});
```

## Testing Strategy

### Unit Tests
1. **Command Validation**: Structure validation, entity existence
2. **Payload Building**: Proper payload construction and enrichment
3. **Event Dispatching**: Correct event types and payloads
4. **Error Handling**: Graceful handling of various error conditions
5. **Backward Compatibility**: Legacy single-target command support

### Integration Tests
1. **Full Pipeline**: End-to-end command processing with real entities
2. **Event Flow**: Verify events reach rule handlers correctly
3. **Multi-Target Scenarios**: Complex actions with multiple targets
4. **Performance**: Large-scale command processing efficiency

## Acceptance Criteria

1. ✅ Legacy single-target commands process correctly
2. ✅ Multi-target commands generate proper event payloads
3. ✅ Target information is enriched with entity data
4. ✅ Event schema validation passes for all payloads
5. ✅ Backward compatibility maintained for existing rules
6. ✅ Error handling provides clear, actionable messages
7. ✅ Performance targets met for complex commands
8. ✅ Integration tests validate end-to-end functionality
9. ✅ Event dispatching works for all action types
10. ✅ Payload validation prevents malformed data

## Performance Benchmarks

- Simple command processing: < 5ms
- Multi-target command with 3 targets: < 15ms
- Command with 10 target combinations: < 50ms
- Large entity enrichment (100 components): < 20ms
- Event dispatch overhead: < 2ms per event

## Migration Strategy

### Phase 1: Add Support
- Implement new payload structure alongside existing
- Maintain full backward compatibility
- Add comprehensive testing

### Phase 2: Gradual Migration
- Update core actions to use new format
- Provide migration tools for custom actions
- Document migration patterns

### Phase 3: Optimization
- Optimize performance for multi-target scenarios
- Remove deprecated code paths
- Enhance developer tools

## Future Enhancements

1. **Async Event Processing**: Non-blocking event dispatch for performance
2. **Event Batching**: Batch multiple related events for efficiency
3. **Command Queuing**: Queue commands for ordered execution
4. **Event Replay**: Ability to replay command sequences for debugging
5. **Command Metrics**: Detailed performance and usage analytics