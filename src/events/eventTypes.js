// src/events/eventTypes.js

/**
 * @fileoverview Defines event payload structures used in the event bus.
 * This can be a central place for event contract definitions.
 */

/**
 * Defines the payload structure for the event:item_use_attempted event.
 * This event signifies that a user has successfully indicated an intent
 * to use a specific item from their inventory, potentially targeting another entity.
 * It is typically fired after basic command parsing and unique item identification
 * within the user's inventory, but before system-level validation (like usability
 * conditions or target validity checks).
 *
 * Fired By: Refactored useActionHandler (or equivalent action processing step)
 * Consumed By: ItemUsageSystem (or other relevant systems)
 *
 * @typedef {object} ItemUseAttemptedEventPayload
 * @property {string} userEntityId The unique identifier of the entity (usually the player)
 * attempting to use the item. This identifies the initiator of the action.
 * @property {string} itemInstanceId The unique identifier for the specific *instance*
 * of the item entity being used from the user's inventory. This distinguishes it
 * from other items of the same type and is crucial for potential state changes
 * or consumption of the specific instance.
 * @property {string} itemDefinitionId The identifier for the item's template or definition
 * (e.g., 'potion_healing_lesser', 'sword_basic'). This is used by systems
 * to look up shared, definition-level properties like Usable component data,
 * effects, conditions, etc.
 * @property {string | null} explicitTargetEntityId The unique identifier of the entity
 * that the user explicitly targeted with the command (e.g., the ID resolved from
 * "use potion *on goblin*"). This represents the target specified in the player's
 * input *before* the system performs validation checks (like range, valid target type,
 * target conditions). It is `null` if the use command did not specify an explicit
 * target (e.g., "use potion").
 */

// Example of how it might be dispatched (conceptual):
// const payload: ItemUseAttemptedEventPayload = {
//     userEntityId: playerEntity.id,
//     itemInstanceId: uniqueItemInstance.id, // Assuming the found item instance has a unique ID
//     itemDefinitionId: finalItemId,         // The definition/template ID
//     explicitTargetEntityId: context.explicitTargetEntity?.id ?? null // From action context
// };
// eventBus.dispatch('event:item_use_attempted', payload);