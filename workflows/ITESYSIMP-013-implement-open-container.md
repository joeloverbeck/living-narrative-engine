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

Create `src/logic/operationHandlers/items/openContainerHandler.js`:

```javascript
import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Opens a container, checking for key requirements
 */
class OpenContainerHandler {
  #entityManager;
  #eventBus;
  #logger;

  constructor({ entityManager, eventBus, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(eventBus, 'eventBus is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  async execute(params, executionContext) {
    const { actorEntity, containerEntity } = params;

    assertNonBlankString(actorEntity, 'actorEntity', 'OPEN_CONTAINER', this.#logger);
    assertNonBlankString(containerEntity, 'containerEntity', 'OPEN_CONTAINER', this.#logger);

    try {
      const container = this.#entityManager.getComponent(containerEntity, 'items:container');

      if (!container) {
        this.#logger.warn(`No container component`, { containerEntity });
        return { success: false, error: 'not_a_container' };
      }

      if (container.isOpen) {
        this.#logger.debug(`Container already open`, { containerEntity });
        return { success: false, error: 'already_open' };
      }

      // Check key requirement
      if (container.requiresKey) {
        const inventory = this.#entityManager.getComponent(actorEntity, 'items:inventory');

        if (!inventory || !inventory.items.includes(container.keyItemId)) {
          this.#logger.debug(`Missing required key`, { actorEntity, containerEntity, keyItemId: container.keyItemId });
          return { success: false, error: 'missing_key', keyItemId: container.keyItemId };
        }
      }

      // Open container
      const update = {
        entityId: containerEntity,
        componentId: 'items:container',
        data: {
          ...container,
          isOpen: true
        }
      };

      await this.#entityManager.batchAddComponentsOptimized([update]);

      this.#eventBus.dispatch({
        type: 'CONTAINER_OPENED',
        payload: { actorEntity, containerEntity }
      });

      this.#logger.debug(`Container opened`, { actorEntity, containerEntity });
      return { success: true, contents: container.contents };

    } catch (error) {
      this.#logger.error(`Open container failed`, error, { actorEntity, containerEntity });
      return { success: false, error: error.message };
    }
  }
}

export default OpenContainerHandler;
```

### 2. Create openable_containers_at_location Scope

Create `data/mods/items/scopes/openable_containers_at_location.scope`:

```
positioning:entities_at_location[{"and": [
  {"has": [{"var": "entity"}, "items:openable"]},
  {"has": [{"var": "entity"}, "items:container"]}
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
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:openable_containers_at_location",
      "placeholder": "container",
      "description": "Container to open",
      "contextFrom": "actor"
    }
  },
  "conditions": [
    {
      "type": "HAS_COMPONENT",
      "entityRef": "primary",
      "componentId": "items:openable"
    },
    {
      "type": "HAS_COMPONENT",
      "entityRef": "primary",
      "componentId": "items:container"
    }
  ],
  "formatTemplate": "Open {primary.name}"
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
                "component_id": "positioning:position",
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
            "component_id": "positioning:position",
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
      }
    },
    "required": ["actorEntity", "containerEntity"]
  }
}
```

### 7. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
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
  ]
}
```

### 8. Register Handler in DI Container

Update `src/dependencyInjection/containerConfig.js`:

```javascript
import OpenContainerHandler from '../logic/operationHandlers/items/openContainerHandler.js';

container.register('OPEN_CONTAINER', OpenContainerHandler);
```

### 9. Create Tests

Create comprehensive tests covering:
- Successful opening without key requirement
- Failed opening due to missing key
- Already open container
- Perception logging
- State update (isOpen becomes true)
- Contents revealed in result

## Validation

- [ ] Handler follows standalone class pattern with DI
- [ ] Scope correctly finds openable containers at location
- [ ] Key validation works correctly
- [ ] Container state updated (isOpen = true)
- [ ] Already-open containers handled gracefully
- [ ] Perception logs created for success and failure
- [ ] Contents returned in success result
- [ ] Turn ends after successful opening
- [ ] Tests cover all scenarios
- [ ] All tests pass
- [ ] Mod manifest updated
- [ ] Handler registered in DI container

## Dependencies

- ITESYSIMP-012: Container component must exist
- Positioning mod for entities_at_location scope

## Next Steps

After completion, proceed to:
- ITESYSIMP-014: Implement take_from_container action
