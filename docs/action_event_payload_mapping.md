# Action Event Payload Source Mapping Conventions

## 1. Introduction

This document defines the standard conventions for specifying data sources within the `payload` object of the
`dispatch_event` property in `action-definition.json` files. The `dispatch_event` feature allows an action definition to
specify a game event that should be dispatched upon successful validation and target resolution of that action. This
mapping system provides a declarative way to dynamically construct the event payload using data available from the
runtime context (actor, target, location, parsed command, literals) at the moment the action succeeds.

## 2. Schema Reference (`action-definition.schema.json`)

The `dispatch_event` property is an optional addition to the root of the `action-definition.schema.json`. Its structure
is defined as follows:

```json
"dispatch_event": {
"description": "Optional. Defines the event to dispatch if this action passes validation and target resolution.",
"type": "object",
"required": ["eventName", "payload"],
"properties": {
"eventName": {
"type": "string",
"description": "The namespaced ID of the event to dispatch (e.g., 'event:move_attempted', 'core:event_item_picked_up')."
},
"payload": {
"type": "object",
"description": "Defines how to construct the event payload. Keys are payload field names, values are mapping strings specifying the source of the data.",
"additionalProperties": {
"type": "string",
"description": "Mapping string specifying the data source (e.g., 'actor.id', 'target.component.HealthComponent.current', 'literal.string.success', 'resolved.direction'). See documentation for full syntax.",
"examples": [
"actor.id",
"target.name",
"target.component.InventoryComponent.items",
"resolved.direction",
"context.currentLocation.id",
"parsed.directObjectPhrase",
"literal.boolean.true",
"literal.number.100"
]
}
}
},
"additionalProperties": false
}
```

## 3. Payload Source Mapping Conventions

The string values provided for keys within the `dispatch_event.payload` object define where the data for that payload
field should come from. The Action Executor (the system component responsible for processing successful actions and
dispatching events) is responsible for:

Parsing these mapping strings.
Retrieving the corresponding data from the runtime `ActionContext` (which includes the actor entity, resolved
target/direction, current location, parsed command, etc.).
Handling potential `null` or `undefined` values gracefully (e.g., by omitting the field from the final payload or
explicitly setting it to `null`).
Performing necessary type conversions, especially for `literal.*` mappings.
The following mapping string formats are defined:

## 3.1 Actor-Related Data

`actor.id`

Source: `context.playerEntity.id`
Description: The unique ID of the entity performing the action.
Type: String or Number (depending on entity ID type)

`actor.name`

Source: `getDisplayName(context.playerEntity)`
Description: The display name of the acting entity.
Type: String

`actor.component.<ComponentName>.<property>`

Source: `context.playerEntity.getComponent(ComponentName)?.<property>`
Description: Retrieves the value of `<property>` from the specified `<ComponentName>` attached to the acting entity.
Example: `actor.component.StatsComponent.strength`
Type: Varies based on the component property type.
Executor Note: Must handle cases where the component is not present on the actor or the specified property does not
exist on the component. Should resolve to `null` or `undefined` in such cases.

## 3.2 Target-Related Data

These mappings are only valid if the action's `target_domain` resulted in a resolved entity (i.e., not domains like
`none`, `self`, or `direction` unless direction is modeled via entities).

`target.id`

Source: `resolvedTargetEntity.id`
Description: The unique ID of the resolved target entity.
Condition: Only applicable if `target_domain` resolved to a specific entity.
Type: String or Number (depending on entity ID type)

`target.name`

Source: `getDisplayName(resolvedTargetEntity)`
Description: The display name of the resolved target entity.
Condition: Only applicable if `target_domain` resolved to a specific entity.
Type: String

`target.component.<ComponentName>.<property>`

Source: `resolvedTargetEntity.getComponent(ComponentName)?.<property>`
Description: Retrieves the value of `<property>` from the specified `<ComponentName>` attached to the resolved target
entity.
Example: `target.component.HealthComponent.current`
Condition: Only applicable if `target_domain` resolved to a specific entity.
Type: Varies based on the component property type.
Executor Note: Must handle cases where the target entity, the component, or the property doesn't exist. Should resolve
to `null` or `undefined` in such cases.

## 3.3 Resolved Data (Domain-Specific)

These mappings are primarily applicable based on the specific `target_domain` of the action.

`resolved.direction`

Source: The resolved direction string (e.g., `"north"`, `"south"`)
Description: The specific direction string resolved for the action.
Condition: Only applicable if `target_domain` is `"direction"`.
Type: String

`resolved.connection.id`

Source: The ID of the resolved `Connection` entity used for movement/interaction.
Description: The unique ID of the connection entity associated with the resolved direction.
Condition: Only applicable if `target_domain` is `"direction"` (and directions are modeled via connection entities).
Type: String or Number

`resolved.connection.targetLocationId`

Source: The target location ID from the resolved `Connection` entity.
Description: The ID of the location reached via the resolved connection.
Condition: Only applicable if `target_domain` is `"direction"` (and directions are modeled via connection entities).
Type: String or Number

`resolved.connection.blockerEntityId`

Source: The blocker entity ID from the resolved `Connection` entity.
Description: The ID of an entity blocking the connection, if any. May be `null` or `undefined` if there is no blocker.
Condition: Only applicable if `target_domain` is `"direction"` (and directions are modeled via connection entities).
Type: String or Number, or `null`/`undefined`.
Executor Note: Handle potential `null`/`undefined` values naturally.

## 3.4 Contextual Data

`context.currentLocation.id`

Source: `context.currentLocation.id`
Description: The unique ID of the location entity where the action is being performed.
Type: String or Number

`context.currentLocation.name`

Source: `getDisplayName(context.currentLocation)`
Description: The display name of the current location.
Type: String

## 3.5 Parsed Command Data

`parsed.directObjectPhrase`

Source: `context.parsedCommand.directObjectPhrase`
Description: The raw direct object phrase extracted by the command parser from the player's input. Useful for logging or
events needing the original text.
Example: In "get red potion", this would be `"red potion"`.
Type: String

`parsed.indirectObjectPhrase`

Source: `context.parsedCommand.indirectObjectPhrase`
Description: The raw indirect object phrase extracted by the command parser.
Example: In "put key in chest", this would be `"chest"`.
Type: String

## 3.6 Literal Values

`literal.<type>.<value>`
Source: A hardcoded value defined directly in the action definition.
Description: Allows embedding fixed values into the event payload. The Executor parses the type and value.
Syntax: `literal.<type>.<value>` where `<type>` is one of:
`string`: The value part is treated as a string.
`number`: The value part is parsed as a number (integer or float).
`boolean`: The value part must be `true` or `false` (case-insensitive).
`null`: Represents the JavaScript `null` value. Syntax: `literal.null`.
Examples:
`literal.string.success` -> `"success"` (String)
`literal.string.hello world` -> `"hello world"` (String)
`literal.number.10` -> `10` (Number)
`literal.number.-5.5` -> `-5.5` (Number)
`literal.boolean.true` -> `true` (Boolean)
`literal.boolean.false` -> `false` (Boolean)
`literal.null` -> `null` (`null`)
Executor Note: Robust parsing is required to handle the `<value>` part correctly based on the specified `<type>`,
including potential spaces in strings, different number formats, and boolean values.

## 4. Example Usage (action-definition.json)

```json
{
  "id": "core:action_attack_creature",
  "name": "Attack",
  "target_domain": "environment",
  "actor_required_components": [
    "core:component_attacker"
  ],
  "target_required_components": [
    "core:component_health"
  ],
  "template": "attack {target}",
  "dispatch_event": {
    "eventName": "combat:event_attack_attempted",
    "payload": {
      "attacker_entity_id": "actor.id",
      "attacker_display_name": "actor.name",
      "target_entity_id": "target.id",
      "target_display_name": "target.name",
      "target_hp_before_attack": "target.component.HealthComponent.current",
      "attack_category": "literal.string.melee",
      "location_id": "context.currentLocation.id",
      "raw_command_target": "parsed.directObjectPhrase"
    }
  }
}
```

## 5. Deferred Features

`calculate.default(<source_string>, <literal_value_string>)`: A potential future enhancement to provide a default
literal value if the primary `<source_string>` resolves to `null` or `undefined`. Example:
`"calculate.default(actor.component.AttackComponent.damage, literal.number.1)"`.
Status: Deferred. This adds complexity and is not included in the initial implementation.