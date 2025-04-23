# Common JSON Logic Condition Patterns

**Parent Ticket:** 7 (Create JSON Logic Examples and Usage Documentation)
**Goal:** Identify and list common patterns for conditional logic using JSON Logic, based on game design requirements
for System Rules, Actions, and potentially phased-out Quests/Objectives.

**Background:**
JSON Logic provides a flexible way to define conditions within our game data (System Rules, Action prerequisites, IF
operations). This document outlines common patterns for expressing game logic conditions by accessing data available in
the `JsonLogicEvaluationContext`.

**JsonLogicEvaluationContext Overview:**
When a condition is evaluated, the following data is typically available:

* `event`: Information about the triggering event.
    * `event.type`: (String) The namespaced ID of the event (e.g., `"event:action_attempt"`).
    * `event.payload`: (Object) Data specific to the event (e.g., `{ "interactionType": "USE", "itemId": "item:key" }`).
* `actor`: The entity initiating or primarily involved in the action/event. Can be `null`.
    * `actor.id`: (String|Number) The entity ID.
    * `actor.components`: (Proxy Object) Access component data via `actor.components.componentId`. Returns the component
      data object or `null` if the component doesn't exist. Access nested properties like
      `actor.components.core:health.current`.
* `target`: The entity being acted upon or targeted by the action/event. Can be `null`.
    * `target.id`: (String|Number) The entity ID.
    * `target.components`: (Proxy Object) Access component data like `target.components.componentId`. Returns data or
      `null`. Access nested properties like `target.components.game:lockable.isLocked`.
* `context`: A temporary object holding results from previous operations within the *same* SystemRule action sequence (
  primarily from `QUERY_COMPONENT`'s `result_variable`).
    * Example: `context.targetHealthComponent` might hold the result of a query. Access properties like
      `context.targetHealthComponent.current`. Resolves to `undefined` (treated as `null` by JSON Logic) if the variable
      doesn't exist.

---

## Common Condition Patterns

Here are 15 common patterns identified for use in `SystemRule` root conditions, `ActionDefinition` prerequisites, and
`IF` operation conditions:

**Category: Component Existence & State**

**1. Component Existence Check (Actor/Target)**

* **Description:** Checks if the actor or target entity possesses a specific component. Useful for verifying
  capabilities, status effects, or required attributes. Often used in Action prerequisites. **This pattern works by
  using the `var` operator to access the component via the underlying proxy. If the component is missing, the access
  resolves to `null` (which is falsy); if it exists, it resolves to the component data object (which is truthy).**
* **Context Access:** `actor.components`, `target.components`
* **Example (Is actor alive? Checks if 'core:health' component exists):**
    ```json
    { "!!": { "var": "actor.components.core:health" } }
    ```
* **Example (Does target have 'game:is_container' component?):**
    ```json
    { "!!": { "var": "target.components.game:is_container" } }
    ```
* *(Note: `{"!!": ...}` converts the truthy (component data object) or falsy (`null`) result of the `var` access to a
  strict boolean `true`/`false`, respectively.)*

**2. Component Value Comparison (Numeric)**

* **Description:** Compares a numeric value within a component's data against a literal or another variable. Common
  for checking health, stats, energy, counts, etc.
* **Context Access:** `actor.components`, `target.components`, `context`
* **Example (Is target's health <= 0?):**
    ```json
    { "<=": [ { "var": "target.components.core:health.current" }, 0 ] }
    ```
* **Example (Does actor have > 5 gold?):**
    ```json
    { ">": [ { "var": "actor.components.game:inventory.currency.gold" }, 5 ] }
    ```
* **Example (Is context variable 'rollResult' >= 10?):**
    ```json
    { ">=": [ { "var": "context.rollResult" }, 10 ] }
    ```
* ***Important Note on Missing Data:*** *If the component or property accessed via `var` is missing, the path resolves
  to `null`. In `json-logic-js`, `null` is often coerced to `0` during numeric comparisons. This means:*
    * `{"<=": [null, 0]}` *evaluates to `true` (because `0 <= 0`).*
    * `{">=": [null, 0]}` *evaluates to `true` (because `0 >= 0`).*
    * `{"<": [null, 0]}` *evaluates to `false` (because `0 < 0` is false).*
    * `{">": [null, 0]}` *evaluates to `false` (because `0 > 0` is false).*
    * `{"==": [null, 0]}` *evaluates to `false`.*
    * *Be mindful of this behavior when checking conditions like "health <= 0" if the health component/property might be
      missing.*

**3. Component Value Comparison (String)**

* **Description:** Compares a string value within a component's data against a literal. Useful for checking states,
  types, or specific identifiers.
* **Context Access:** `actor.components`, `target.components`, `context`
* **Example (Is the target door's state 'locked'?):**
    ```json
    { "==": [ { "var": "target.components.game:lockable.state" }, "locked" ] }
    ```
* **Example (Is the actor's class 'mage'?):**
    ```json
    { "==": [ { "var": "actor.components.core:class.id" }, "core:class_mage" ] }
    ```

**4. Component Value Check (Boolean)**

* **Description:** Checks if a boolean property within a component's data is true or false.
* **Context Access:** `actor.components`, `target.components`, `context`
* **Example (Is the target 'game:openable' component currently open?):**
    ```json
    { "==": [ { "var": "target.components.game:openable.isOpen" }, true ] }
    ```
  *Shorthand:*
    ```json
    { "var": "target.components.game:openable.isOpen" }
    ```
* **Example (Is the actor hidden?):**
    ```json
    { "var": "actor.components.game:status_hidden.isActive" }
    ```

**5. Check for Specific Item in Inventory (Simplified)**

* **Description:** Checks if an actor possesses a specific item, assuming items might be represented as components
  on the actor or inventory component structure is known. (More complex inventory checks might need `some` or `in`
  operators, or a dedicated query).
* **Context Access:** `actor.components`
* **Example (Does actor have the 'game:quest_item_key' component?):**
    ```json
    { "!!": { "var": "actor.components.game:quest_item_key" } }
    ```
* **Example (Check inventory component structure - assuming `items` is an object map):**
    ```json
    { "!!": { "var": "actor.components.game:inventory.items.item:special_orb" } }
    ```

**Category: Event Data Checks**

**6. Event Type Check**

* **Description:** Checks if the triggering event is of a specific type. Primarily used in the root `condition` of a
  `SystemRule` to refine when it applies beyond just matching `event_type`.
* **Context Access:** `event.type`
* **Example (Is the event exactly 'event:entity_dies'?):**
    ```json
    { "==": [ { "var": "event.type" }, "event:entity_dies" ] }
    ```

**7. Event Payload Value Check**

* **Description:** Checks a specific value within the triggering event's payload. Allows rules to react differently
  based on event details.
* **Context Access:** `event.payload`
* **Example (Was the interaction type 'USE'?):**
    ```json
    { "==": [ { "var": "event.payload.interactionType" }, "USE" ] }
    ```
* **Example (Was the damage amount > 10?):**
    ```json
    { ">": [ { "var": "event.payload.damageAmount" }, 10 ] }
    ```
* **Example (Did the move event specify 'north'?):**
    ```json
    { "==": [ { "var": "event.payload.direction" }, "north" ] }
    ```

**Category: Context Variable Checks**

**8. Context Variable Existence Check**

* **Description:** Checks if a context variable (usually set by a previous `QUERY_COMPONENT` operation within the
  same rule's actions) exists (i.e., is not null/undefined). Useful in `IF` conditions.
* **Context Access:** `context`
* **Example (Did the 'findTargetHealth' query return a result?):**
    ```json
    { "!=": [ { "var": "context.findTargetHealth" }, null ] }
    ```
  *Shorthand (checks for truthiness):*
    ```json
    { "!!": { "var": "context.findTargetHealth" } }
    ```

**9. Context Variable Value Check**

* **Description:** Checks the value of a property within a context variable that holds component data (or other
  structured data).
* **Context Access:** `context`
* **Example (Is the queried health component's current value <= 0?):**
    ```json
    { "<=": [ { "var": "context.targetHealthComponent.current" }, 0 ] }
    ```
  *(Note: If `context.targetHealthComponent` or its `current` property is missing or explicitly `null`, the `var` path
  resolves to `null`. In this comparison, `json-logic-js` treats `null` as `0`, resulting in `0 <= 0`, which evaluates
  to **`true`**.)*
* **Example (Does the queried inventory context variable show >= 1 keys?):**
    ```json
    { ">=": [ { "var": "context.actorInventory.items.key_count" }, 1 ] }
    ```
  *(Note: If the path `context.actorInventory.items.key_count` resolves to `null`, this comparison becomes `0 >= 1`,
  which evaluates to **`false`**.)*
* ***Important Note on Missing Data:*** *As shown in the examples, if a context variable or a nested property is missing
  or explicitly `null`, the `var` path resolves to `null`. `json-logic-js` often coerces `null` to `0` in numeric
  comparisons. This means `null <= 0` evaluates to **`true`**, while comparisons
  like `null >= 1`, `null > 0`, `null < 0`, or `null == 0` evaluate to **`false`**. Always consider this null coercion
  when writing numeric comparisons where data might be missing.*

**Category: Entity Identity & Context State**

**10. Entity ID Check**

* **Description:** Checks if the actor or target entity has a specific ID. Useful for targeting specific NPCs, the
  player, or unique items/locations.
* **Context Access:** `actor.id`, `target.id`
* **Example (Is the target entity 'npc:shopkeeper'?):**
    ```json
    { "==": [ { "var": "target.id" }, "npc:shopkeeper" ] }
    ```
* **Example (Is the actor the player 'core:player'?):**
    ```json
    { "==": [ { "var": "actor.id" }, "core:player" ] }
    ```

**11. Actor/Target Existence Check**

* **Description:** Checks if the `actor` or `target` context itself is not null. Important before trying to access
  their components if their presence isn't guaranteed by the event/action context.
* **Context Access:** `actor`, `target`
* **Example (Is there a valid target defined?):**
    ```json
    { "!=": [ { "var": "target" }, null ] }
    ```
* **Example (Is there a valid actor defined?):**
    ```json
    { "!=": [ { "var": "actor" }, null ] }
    ```

**Category: Compound Logic**

**12. Logical AND**

* **Description:** Combines multiple conditions, requiring all of them to be true.
* **Context Access:** Any (`event`, `actor`, `target`, `context`)
* **Example (Is the target lockable AND is its state 'locked'?):**
    ```json
    { "and": [
        { "!!": { "var": "target.components.game:lockable" } },
        { "==": [ { "var": "target.components.game:lockable.state" }, "locked" ] }
      ]
    }
    ```
* **Example (Does actor have key AND is target the locked door?):**
    ```json
    { "and": [
        { "!!": { "var": "actor.components.game:quest_item_key" } },
        { "==": [ { "var": "target.id" }, "blocker:main_gate_door" ] },
        { "==": [ { "var": "target.components.game:lockable.state" }, "locked" ] }
      ]
    }
    ```

**13. Logical OR**

* **Description:** Combines multiple conditions, requiring at least one of them to be true.
* **Context Access:** Any (`event`, `actor`, `target`, `context`)
* **Example (Is actor poisoned OR diseased?):**
    ```json
    { "or": [
        { "!!": { "var": "actor.components.effect:poison" } },
        { "!!": { "var": "actor.components.effect:disease" } }
      ]
    }
    ```

**14. Logical NOT**

* Description: Inverts the result of a condition using the `!` operator.
* Context Access: Any (`event`, `actor`, `target`, `context`)
* Example (Is the target NOT locked?):
    ```json
    { "!": { "==": [ { "var": "target.components.game:lockable.state" }, "locked" ] } }
    ```
  *Alternative (often clearer for simple comparisons):*
    ```json
    { "!=": [ { "var": "target.components.game:lockable.state" }, "locked" ] }
    ```
* Example (Actor does NOT have the 'burdened' status effect):
    ```json
    { "!": { "var": "actor.components.status:burdened" } }
    ```
  *Note: `!` is the standard operator for logical NOT in json-logic-js.*

**Category: Quest/Objective State (Conceptual - Phasing Out)**

**15. Quest State Check (Legacy Pattern)**

* **Description:** Checks the status of a quest tracked on the actor (e.g., via a `QuestLogComponent`). *Note: This
  pattern is based on the older quest system approach and may be superseded by pure SystemRule logic.*
* **Context Access:** `actor.components`
* **Example (Is 'main:quest_1' in the actor's active quests list? Needs `in` operator):**
    ```json
    { "in": [ "main:quest_1", { "var": "actor.components.core:quest_log.active_quests" } ] }
    ```
* **Example (Is 'main:quest_2' NOT in the actor's completed quests list?):**
    ```json
    { "!" : { "in": [ "main:quest_2", { "var": "actor.components.core:quest_log.completed_quests" } ] } }
    ```

---

This list covers a wide range of common scenarios for conditional game logic using JSON Logic within the defined
evaluation context. These patterns should serve as a foundation for writing conditions in `SystemRule` definitions,
`ActionDefinition` prerequisites, and `IF` operations.

---