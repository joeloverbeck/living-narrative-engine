# ITESYSIMP-013: Implement Open Container Action

**Phase:** 3 - Container System
**Priority:** High
**Estimated Effort:** 2.5 hours

## Goal

Implement the `open_container` action to allow actors to open containers, with key requirements and state management.

## Context

Opening containers reveals their contents and enables item retrieval. Some containers require keys. This action must validate key possession and update container state.

## Tasks

### 1. Create OPEN_CONTAINER Handler

Create `src/logic/operationHandlers/openContainerHandler.js`:

```javascript
import { assertParamsObject, validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const CONTAINER_OPENED_EVENT = 'items:container_opened';
const CONTAINER_COMPONENT_ID = 'items:container';
const INVENTORY_COMPONENT_ID = 'items:inventory';

/**
 * Opens a container, checking for key requirements
 * @extends BaseOperationHandler
 */
class OpenContainerHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('OpenContainerHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'batchAddComponentsOptimized'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validates and normalizes operation parameters
   * @param {object} params - Raw parameters
   * @param {object} log - Logger instance
   * @returns {object|null} Validated parameters or null
   * @private
   */
  #validateParams(params, log) {
    if (!assertParamsObject(params, this.#dispatcher, 'OPEN_CONTAINER')) {
      return null;
    }

    const { actorEntity, containerEntity } = params;

    const validatedActor = validateStringParam(
      actorEntity,
      'actorEntity',
      log,
      this.#dispatcher
    );
    const validatedContainer = validateStringParam(
      containerEntity,
      'containerEntity',
      log,
      this.#dispatcher
    );

    if (!validatedActor || !validatedContainer) {
      return null;
    }

    return {
      actorEntity: validatedActor,
      containerEntity: validatedContainer,
    };
  }

  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'invalid_parameters' };
    }

    const { actorEntity, containerEntity } = validated;

    try {
      const container = this.#entityManager.getComponentData(
        containerEntity,
        CONTAINER_COMPONENT_ID
      );

      if (!container) {
        log.warn('OpenContainerHandler: No container component', { containerEntity });
        return { success: false, error: 'not_a_container' };
      }

      if (container.isOpen) {
        log.debug('OpenContainerHandler: Container already open', { containerEntity });
        return { success: false, error: 'already_open' };
      }

      // Check key requirement
      if (container.requiresKey) {
        const inventory = this.#entityManager.getComponentData(
          actorEntity,
          INVENTORY_COMPONENT_ID
        );

        if (!inventory || !inventory.items.includes(container.keyItemId)) {
          log.debug('OpenContainerHandler: Missing required key', {
            actorEntity,
            containerEntity,
            keyItemId: container.keyItemId,
          });
          return {
            success: false,
            error: 'missing_key',
            keyItemId: container.keyItemId,
          };
        }
      }

      // Open container
      const update = {
        entityId: containerEntity,
        componentId: CONTAINER_COMPONENT_ID,
        data: {
          ...container,
          isOpen: true,
        },
      };

      await this.#entityManager.batchAddComponentsOptimized([update]);

      this.#dispatcher.dispatch({
        type: CONTAINER_OPENED_EVENT,
        payload: { actorEntity, containerEntity, contents: container.contents },
      });

      log.debug('OpenContainerHandler: Container opened', {
        actorEntity,
        containerEntity,
      });
      return { success: true, contents: container.contents };
    } catch (error) {
      log.error('OpenContainerHandler: Open container failed', error, {
        actorEntity,
        containerEntity,
      });
      return { success: false, error: error.message };
    }
  }
}

export default OpenContainerHandler;
```

### 2. Create openable_containers_at_location Scope

Create `data/mods/items/scopes/openable_containers_at_location.scope`:

```
items:openable_containers_at_location := entities(core:position)[][{"and": [
  {"has": [{"var": "entity"}, "items:openable"]},
  {"has": [{"var": "entity"}, "items:container"]},
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]}
]}]
```

**Description:** Returns openable containers at the actor's current location.

### 3. Create open_container Action

Create `data/mods/items/actions/open_container.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:open_container",
  "name": "Open Container",
  "description": "Open a container to access its contents",
  "targets": {
    "primary": {
      "scope": "items:openable_containers_at_location",
      "placeholder": "container",
      "description": "Container to open",
      "contextFrom": "actor"
    }
  },
  "prerequisites": [],
  "template": "Open {primary.name}"
}
```

### 4. Create Condition

Create `data/mods/items/conditions/event-is-action-open-container.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-open-container",
  "description": "Checks if event is the open_container action",
  "jsonLogic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:open_container"
    ]
  }
}
```

### 5. Create Rule

Create `data/mods/items/rules/handle_open_container.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_open_container",
  "description": "Handles open_container action with key validation and perception logging",
  "priority": 100,
  "eventType": "ATTEMPT_ACTION",
  "conditions": [
    "items:event-is-action-open-container"
  ],
  "operations": [
    {
      "type": "OPEN_CONTAINER",
      "comment": "Attempt to open container with key validation",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "containerEntity": "{event.payload.targetId}",
        "result_variable": "openResult"
      }
    },
    {
      "type": "CONDITIONAL_BRANCH",
      "comment": "Branch based on open result",
      "condition": {
        "==": [
          { "var": "context.openResult.success" },
          false
        ]
      },
      "thenOperations": [
        {
          "type": "CONDITIONAL_BRANCH",
          "comment": "Check if failure was due to missing key",
          "condition": {
            "==": [
              { "var": "context.openResult.error" },
              "missing_key"
            ]
          },
          "thenOperations": [
            {
              "type": "GET_COMPONENT",
              "parameters": {
                "entity_id": "{event.payload.actorId}",
                "component_id": "core:position",
                "result_variable": "actorPosition"
              }
            },
            {
              "type": "GET_NAME",
              "parameters": {
                "entity_ref": "actor",
                "result_variable": "actorName"
              }
            },
            {
              "type": "GET_NAME",
              "parameters": {
                "entity_ref": "target",
                "result_variable": "containerName"
              }
            },
            {
              "type": "BUILD_MESSAGE",
              "parameters": {
                "template": "{actorName} tried to open {containerName}, but it's locked.",
                "result_variable": "logMessage"
              }
            },
            {
              "type": "ADD_PERCEPTION_LOG_ENTRY",
              "parameters": {
                "location_id": "{context.actorPosition.locationId}",
                "entry": {
                  "descriptionText": "{context.logMessage}",
                  "timestamp": "{timestamp}",
                  "perceptionType": "container_open_failed",
                  "actorId": "{event.payload.actorId}",
                  "containerId": "{event.payload.targetId}",
                  "reason": "missing_key"
                }
              }
            }
          ]
        }
      ],
      "elseOperations": [
        {
          "type": "GET_COMPONENT",
          "parameters": {
            "entity_id": "{event.payload.actorId}",
            "component_id": "core:position",
            "result_variable": "actorPosition"
          }
        },
        {
          "type": "GET_NAME",
          "parameters": {
            "entity_ref": "actor",
            "result_variable": "actorName"
          }
        },
        {
          "type": "GET_NAME",
          "parameters": {
            "entity_ref": "target",
            "result_variable": "containerName"
          }
        },
        {
          "type": "BUILD_MESSAGE",
          "parameters": {
            "template": "{actorName} opened {containerName}.",
            "result_variable": "logMessage"
          }
        },
        {
          "type": "ADD_PERCEPTION_LOG_ENTRY",
          "comment": "Log successful opening",
          "parameters": {
            "location_id": "{context.actorPosition.locationId}",
            "entry": {
              "descriptionText": "{context.logMessage}",
              "timestamp": "{timestamp}",
              "perceptionType": "container_opened",
              "actorId": "{event.payload.actorId}",
              "containerId": "{event.payload.targetId}",
              "contents": "{context.openResult.contents}"
            }
          }
        },
        {
          "type": "END_TURN",
          "comment": "End actor's turn after opening container"
        }
      ]
    }
  ]
}
```

### 6. Create container_opened Event

Create `data/mods/items/events/container_opened.event.json`:

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:container_opened",
  "description": "Dispatched when a container is opened",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorEntity": {
        "type": "string",
        "description": "Actor who opened the container"
      },
      "containerEntity": {
        "type": "string",
        "description": "Container that was opened"
      },
      "contents": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Entity IDs of items contained"
      }
    },
    "required": ["actorEntity", "containerEntity"]
  }
}
```

### 7. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json` under the `content` key:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "items",
  "version": "1.0.0",
  "dependencies": ["core", "positioning"],
  "content": {
    "components": [...],
    "actions": [
      "give_item.action.json",
      "drop_item.action.json",
      "pick_up_item.action.json",
      "open_container.action.json"
    ],
    "conditions": [
      "event-is-action-give-item.condition.json",
      "event-is-action-drop-item.condition.json",
      "event-is-action-pick-up-item.condition.json",
      "event-is-action-open-container.condition.json"
    ],
    "rules": [
      "handle_give_item.rule.json",
      "handle_drop_item.rule.json",
      "handle_pick_up_item.rule.json",
      "handle_open_container.rule.json"
    ],
    "scopes": [
      "actor_inventory_items.scope",
      "close_actors_with_inventory.scope",
      "items_at_location.scope",
      "openable_containers_at_location.scope"
    ],
    "events": [
      "item_dropped.event.json",
      "item_picked_up.event.json",
      "container_opened.event.json"
    ],
    "entities": {
      "definitions": [...],
      "instances": []
    }
  }
}
```

### 8. Register Handler in DI Container

**Step 8.1:** Add token to `src/dependencyInjection/tokens-core.js`:

```javascript
export const tokens = {
  // ... existing tokens
  OpenContainerHandler: 'OpenContainerHandler',
};
```

**Step 8.2:** Register in `src/dependencyInjection/operationHandlerRegistrations.js`:

```javascript
// 1. Add import at top
import OpenContainerHandler from '../../logic/operationHandlers/openContainerHandler.js';

// 2. Add to handlerFactories array
const handlerFactories = [
  // ... existing handlers
  [
    tokens.OpenContainerHandler,
    OpenContainerHandler,
    (c, Handler) =>
      new Handler({
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      }),
  ],
];
```

**Step 8.3:** Register operation in `src/dependencyInjection/interpreterRegistrations.js`:

```javascript
// Add to operation registry
registry.register('OPEN_CONTAINER', bind(tokens.OpenContainerHandler));
```

### 9. Create Tests

Create `tests/unit/logic/operationHandlers/openContainerHandler.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import OpenContainerHandler from '../../../../src/logic/operationHandlers/openContainerHandler.js';

describe('OpenContainerHandler', () => {
  /** @type {jest.Mocked<import('../../../../src/interfaces/ILogger.js').ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<import('../../../../src/entities/entityManager.js').default>} */
  let mockEntityManager;
  /** @type {{ dispatch: jest.Mock }} */
  let mockDispatcher;
  let handler;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      batchAddComponentsOptimized: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    handler = new OpenContainerHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new OpenContainerHandler({})).toThrow();
    });

    it('should accept valid dependencies', () => {
      expect(handler).toBeInstanceOf(OpenContainerHandler);
    });
  });

  describe('execute - success scenarios', () => {
    it('should open container without key requirement', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        isOpen: false,
        requiresKey: false,
        contents: ['item1', 'item2'],
      });

      mockEntityManager.batchAddComponentsOptimized.mockResolvedValue(undefined);

      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.contents).toEqual(['item1', 'item2']);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'items:container_opened',
        payload: {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
          contents: ['item1', 'item2'],
        },
      });
    });

    it('should open container with key when actor has key', async () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          isOpen: false,
          requiresKey: true,
          keyItemId: 'key1',
          contents: ['treasure'],
        })
        .mockReturnValueOnce({
          items: ['key1', 'sword'],
        });

      mockEntityManager.batchAddComponentsOptimized.mockResolvedValue(undefined);

      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.contents).toEqual(['treasure']);
    });
  });

  describe('execute - failure scenarios', () => {
    it('should fail when container not found', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
        },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_a_container');
    });

    it('should fail when container already open', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        isOpen: true,
        requiresKey: false,
        contents: [],
      });

      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
        },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('already_open');
    });

    it('should fail when missing required key', async () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          isOpen: false,
          requiresKey: true,
          keyItemId: 'key1',
          contents: [],
        })
        .mockReturnValueOnce({
          items: ['sword'],
        });

      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
        },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_key');
      expect(result.keyItemId).toBe('key1');
    });

    it('should fail when actor has no inventory', async () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          isOpen: false,
          requiresKey: true,
          keyItemId: 'key1',
          contents: [],
        })
        .mockReturnValueOnce(null);

      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'chest1',
        },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_key');
    });

    it('should fail with invalid parameters', async () => {
      const result = await handler.execute({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_parameters');
    });
  });

  describe('parameter trimming', () => {
    it('should trim whitespace from string parameters', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        isOpen: false,
        requiresKey: false,
        contents: [],
      });

      mockEntityManager.batchAddComponentsOptimized.mockResolvedValue(undefined);

      const result = await handler.execute(
        {
          actorEntity: '  actor1  ',
          containerEntity: '  chest1  ',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'chest1',
        'items:container'
      );
    });
  });
});
```

Create integration tests covering:
- Full action workflow with rule execution
- Perception logging for success and failure
- State updates persisting correctly
- Turn ending after successful opening

## Validation

- [ ] Handler extends BaseOperationHandler with proper DI
- [ ] Handler uses getComponentData() method
- [ ] Handler uses #validateParams() pattern
- [ ] Handler uses safeEventDispatcher
- [ ] Handler uses getLogger(executionContext)
- [ ] Scope uses entities(core:position)[][] syntax with location matching
- [ ] Action uses template field and prerequisites array
- [ ] Key validation works correctly
- [ ] Container state updated (isOpen = true)
- [ ] Already-open containers handled gracefully
- [ ] Perception logs created for success and failure
- [ ] Contents returned in success result
- [ ] Turn ends after successful opening
- [ ] Unit tests cover all scenarios with jest.Mocked types
- [ ] Integration tests verify full workflow
- [ ] All tests pass
- [ ] Mod manifest updated under content key
- [ ] Handler registered in operationHandlerRegistrations.js
- [ ] Token added to tokens-core.js
- [ ] Operation registered in interpreterRegistrations.js

## Dependencies

- ITESYSIMP-012: Container component must exist
- Positioning mod for entities_at_location scope
- BaseOperationHandler and validation utilities

## Next Steps

After completion, proceed to:
- ITESYSIMP-014: Implement take_from_container action
