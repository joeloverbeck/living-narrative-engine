// src/types/eventTypes.js

/**
 * @fileoverview Defines event payload structures used in the event bus.
 * This can be a central place for event contract definitions.
 * Includes both game logic events (event:) and key UI events (ui:).
 */

// ========================================================================
// == Core Gameplay Events (event:) =======================================
// ========================================================================

/**
 * Defines the payload structure for the event:item_use_attempted event.
 * This event signifies that a user has successfully indicated an intent
 * to use a specific item from their inventory, potentially targeting another entity
 * OR a connection within the current location.
 * It is typically fired after basic command parsing and unique item identification
 * within the user's inventory, but before system-level validation (like usability
 * conditions or target validity checks).
 *
 * Fired By: useActionHandler
 * Consumed By: ItemUsageSystem
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
 * @property {string | null} explicitTargetEntityId The unique identifier of the *entity*
 * that the user explicitly targeted with the command (e.g., the ID resolved from
 * "use potion *on goblin*"). This is mutually exclusive with `explicitTargetConnectionId`.
 * It is `null` if the use command did not specify an explicit target or targeted a connection.
 * @property {string | null} explicitTargetConnectionId The unique identifier (`connectionId`) of the *connection*
 * within the current location that the user explicitly targeted (e.g., the ID resolved from
 * "use key *on north door*"). This is mutually exclusive with `explicitTargetEntityId`.
 * It is `null` if the use command did not specify an explicit target or targeted an entity.
 * // Note: We could pass the whole connection object, but ID might be simpler for event payload.
 * // The ItemUsageSystem can retrieve the object using the ID and location if needed.
 */

/**
 * Defines the payload structure for the event:attack_intended event.
 * Signals that an entity intends to perform an attack against a target after initial validation
 * (target exists, has health, is not defeated). Does not guarantee the attack hits or deals damage yet.
 *
 * Fired By: attackActionHandler
 * Consumed By: CombatSystem
 *
 * @typedef {object} AttackIntendedEventPayload
 * @property {string} attackerId The unique identifier of the attacking entity.
 * @property {string} targetId The unique identifier of the entity being targeted for the attack.
 * @property {number} potentialDamage The base calculated damage the attacker intends to inflict,
 * before target defenses or resistances are applied.
 */

/**
 * Defines the payload structure for the event:item_drop_attempted event.
 * Signals that a player has validated their intent to drop a specific item from their inventory
 * into their current location.
 *
 * Fired By: dropActionHandler
 * Consumed By: InventorySystem, WorldPresenceSystem
 *
 * @typedef {object} ItemDropAttemptedEventPayload
 * @property {string} playerId The unique identifier of the player entity attempting to drop the item.
 * @property {string} itemInstanceId The unique identifier of the specific item instance being dropped.
 * @property {string} locationId The unique identifier of the location entity where the item is intended to be dropped.
 */

/**
 * Defines the payload structure for the event:item_equip_attempted event.
 * Signals that a player has validated their intent to equip a specific item instance from their inventory
 * into a specific equipment slot. Validation includes item existence, equippability, and slot availability.
 * Note: This event passes full Entity instances, which might be less ideal than using IDs for decoupling.
 *
 * Fired By: equipActionHandler
 * Consumed By: EquipmentSystem
 *
 * @typedef {object} ItemEquipAttemptedEventPayload
 * @property {import('../entities/entity.js').default} playerEntity The full entity instance of the player attempting to equip.
 * @property {import('../entities/entity.js').default} itemInstanceToEquip The full entity instance of the item being equipped.
 * @property {string} targetSlotId The identifier of the equipment slot the item is intended for (e.g., 'core:slot_main_hand').
 */

/**
 * Defines the payload structure for the event:move_attempted event.
 * Signals that an entity has validated its intent to move in a specific direction from its current location.
 * Validation checks for valid exits. Blocking logic (e.g., locked doors, blocker entities)
 * is handled by systems listening to this event (like MoveCoordinatorSystem).
 *
 * Fired By: moveActionHandler
 * Consumed By: MoveCoordinatorSystem
 *
 * @typedef {object} MoveAttemptedEventPayload
 * @property {string} entityId The unique identifier of the entity attempting to move.
 * @property {string} targetLocationId The unique identifier of the location entity the entity intends to move to.
 * @property {string} direction The direction the entity attempted to move (e.g., 'north', 'south').
 * @property {string} previousLocationId The unique identifier of the location entity the entity is currently in.
 * @property {string} [blockerEntityId] Optional. The unique identifier of an entity that
 * might block this connection (e.g., a door), if specified in the connection data.
 */

/**
 * Defines the payload structure for the action:move_failed event.
 * Signals that a move attempt, after initial validation (e.g., exit exists), has failed
 * due to a subsequent check (e.g., target location missing, path blocked, internal error).
 *
 * Fired By: MoveCoordinatorSystem
 * Consumed By: UI/Renderer (to display failure messages), potentially other systems logging actions.
 *
 * @typedef {object} ActionMoveFailedPayload
 * @property {string} actorId The unique identifier of the entity whose move failed.
 * @property {string} direction The direction the entity attempted to move.
 * @property {string} previousLocationId The unique identifier of the location the entity was in.
 * @property {string} attemptedTargetLocationId The unique identifier of the location entity the entity tried to move to.
 * @property {'TARGET_LOCATION_NOT_FOUND' | 'DIRECTION_LOCKED' | 'DIRECTION_BLOCKED' | 'BLOCKER_NOT_FOUND' | 'MOVE_EXECUTION_ERROR' | 'MOVEMENT_EXECUTION_FAILED' | 'COORDINATOR_INTERNAL_ERROR' | string} reasonCode A code indicating why the move failed. Includes specific codes for target/blocker issues, movement execution problems, and unexpected coordinator errors. // <<< UPDATED: Added specific codes and enhanced description
 * @property {string | null} details A user-friendly or diagnostic description of the failure reason. // <<< UPDATED: Clarified scope
 * @property {string | null} [blockerDisplayName] The display name of the entity that blocked the movement, if applicable (present if failure was due to a blocker).
 * @property {string | null} [blockerEntityId] The unique identifier of the entity that blocked the movement, if applicable (present if failure was due to a blocker).
 */

 /**
 * Defines the payload structure for the event:item_picked_up event.
 * Signals that an entity has successfully taken an item from a location. The UI message has already been dispatched.
 * This event triggers the necessary state changes in inventory and world state.
 *
 * Fired By: takeActionHandler
 * Consumed By: InventorySystem, WorldPresenceSystem
 *
 * @typedef {object} ItemPickedUpEventPayload
 * @property {string} pickerId The unique identifier of the entity that picked up the item.
 * @property {string} itemId The unique identifier of the item instance that was picked up.
 * @property {string} locationId The unique identifier of the location from which the item was picked up.
 */

/**
 * Defines the payload structure for the event:item_unequip_attempted event.
 * Signals that a player has validated their intent to unequip an item currently in a specific equipment slot.
 * Validation involves identifying the correct item/slot based on user input.
 * Note: This event passes full Entity instances, which might be less ideal than using IDs for decoupling.
 *
 * Fired By: unequipActionHandler
 * Consumed By: EquipmentSystem
 *
 * @typedef {object} ItemUnequipAttemptedEventPayload
 * @property {import('../entities/entity.js').default} playerEntity The full entity instance of the player attempting to unequip.
 * @property {import('../entities/entity.js').default} itemInstanceToUnequip The full entity instance of the item being unequipped.
 * @property {string} slotIdToUnequip The identifier of the equipment slot the item is being removed from.
 */

/**
 * Defines the payload structure for the event:entity_died event.
 * Signals that an entity's health has reached zero or below as a result of an action (typically combat).
 *
 * Fired By: CombatSystem
 * Consumed By: DeathSystem, TriggerSystem (potentially)
 *
 * @typedef {object} EntityDiedEventPayload
 * @property {string} deceasedEntityId The unique identifier of the entity that died.
 * @property {string} killerEntityId The unique identifier of the entity considered responsible for the death (e.g., the attacker).
 */

/**
 * Defines the payload structure for the event:entity_loot_spawn_requested event.
 * Signals a request to potentially spawn loot in a specific location following an entity's death.
 *
 * Fired By: DeathSystem
 * Consumed By: LootSystem (hypothetical), other systems reacting to death consequences.
 *
 * @typedef {object} EntityLootSpawnRequestedPayload
 * @property {string} deceasedEntityId The unique identifier of the entity that died, whose loot is requested.
 * @property {string} locationId The unique identifier of the location where the loot should potentially be spawned.
 * @property {string} [killerEntityId] The unique identifier of the killer, if available (optional, may influence loot).
 */

/**
 * Defines the payload structure for the event:item_consume_requested event.
 * Signals that an item instance should be removed from an entity's inventory
 * following successful usage and effect execution.
 *
 * Fired By: ItemUsageSystem
 * Consumed By: InventorySystem
 *
 * @typedef {object} ItemConsumeRequestedEventPayload
 * @property {string} userId The unique identifier of the entity whose item should be consumed.
 * @property {string} itemInstanceId The unique identifier of the specific item instance to consume.
 */

/**
 * Defines the payload structure for the event:item_unequipped event.
 * Signals that an item has been successfully removed from an entity's equipment slot and placed into their inventory.
 * This event confirms the state change is complete.
 * Note: This event passes full Entity instances, which might be less ideal than using IDs for decoupling.
 *
 * Fired By: EquipmentSystem (handleItemUnequipAttempted)
 * Consumed By: EquipmentSystem (handleItemUnequipped - for effect removal), other systems reacting to equipment changes.
 *
 * @typedef {object} ItemUnequippedEventPayload
 * @property {import('../entities/entity.js').default} entity The full entity instance whose equipment changed.
 * @property {string} itemId The unique identifier of the item instance that was unequipped.
 * @property {string} slotId The identifier of the equipment slot the item was removed from.
 * @property {import('../entities/entity.js').default} itemInstance The full entity instance of the item that was unequipped.
 */

/**
 * Defines the payload structure for the event:item_equipped event.
 * Signals that an item has been successfully removed from an entity's inventory and placed into an equipment slot.
 * This event confirms the state change is complete.
 * Note: This event passes full Entity instances, which might be less ideal than using IDs for decoupling.
 *
 * Fired By: EquipmentSystem (handleItemEquipAttempted)
 * Consumed By: EquipmentSystem (handleItemEquipped - for effect application), other systems reacting to equipment changes.
 *
 * @typedef {object} ItemEquippedEventPayload
 * @property {import('../entities/entity.js').default} entity The full entity instance whose equipment changed.
 * @property {string} itemId The unique identifier of the item instance that was equipped.
 * @property {string} slotId The identifier of the equipment slot the item was placed into.
 * @property {import('../entities/entity.js').default} itemInstance The full entity instance of the item that was equipped.
 */

/**
 * Defines the payload structure for the event:entity_moved event.
 * Signals that an entity has successfully completed its move and its position has been updated.
 *
 * Fired By: MovementSystem
 * Consumed By: TriggerSystem (for auto-look), potentially other systems reacting to location changes.
 *
 * @typedef {object} EntityMovedEventPayload
 * @property {string} entityId The unique identifier of the entity that moved.
 * @property {string} newLocationId The unique identifier of the location the entity has arrived in.
 * @property {string} oldLocationId The unique identifier of the location the entity moved from.
 * @property {string} direction The direction the entity moved to arrive at the new location.
 */

/**
 * Defines the payload structure for the event:item_dropped event.
 * Signals that an item has been successfully removed from a player's inventory and placed into a location.
 * This is fired *after* the state change (inventory removal, world placement) is complete.
 *
 * Fired By: WorldPresenceSystem (handleItemDropAttempted)
 * Consumed By: Potentially systems logging actions or triggering location-based events on item presence.
 *
 * @typedef {object} ItemDroppedEventPayload
 * @property {string} playerId The unique identifier of the player who dropped the item.
 * @property {string} itemId The unique identifier of the item instance that was dropped.
 * @property {string} locationId The unique identifier of the location where the item was dropped.
 */

/**
 * Defines the payload structure for the event:unlock_entity_attempt event.
 * Signals that an entity is attempting to unlock another entity (e.g., a door, a chest, a mechanism).
 * This event is typically fired *before* validation or state changes occur.
 *
 * Fired By: InteractionSystem, ItemUsageSystem (via 'trigger_event' effect)
 * Consumed By: LockingSystem, potentially specific entity interaction handlers.
 *
 * @typedef {object} UnlockEntityAttemptEventPayload
 * @property {string} userId The unique identifier of the entity attempting the unlock action.
 * @property {string} targetEntityId The unique identifier of the entity being targeted for unlocking.
 * @property {string | null} keyItemId The unique identifier of the item instance being used for the attempt, if any.
 * Null if the unlock attempt doesn't involve a specific item (e.g., a puzzle interaction).
 */

/**
 * Defines the payload structure for the event:lock_entity_attempt event.
 * Signals that an entity is attempting to lock another entity (e.g., a door, a chest).
 * This event is typically fired *before* validation or state changes occur.
 *
 * Fired By: InteractionSystem, ItemUsageSystem (via 'trigger_event' effect)
 * Consumed By: LockingSystem, potentially specific entity interaction handlers.
 *
 * @typedef {object} LockEntityAttemptEventPayload
 * @property {string} userId The unique identifier of the entity attempting the lock action.
 * @property {string} targetEntityId The unique identifier of the entity being targeted for locking.
 * @property {string | null} keyItemId The unique identifier of the item instance being used for the attempt, if any (e.g., using chains).
 * Null if the lock attempt doesn't involve a specific item.
 */

/**
 * Defines the payload structure for the event:entity_unlocked event.
 * Signals that an entity has been successfully unlocked.
 * This event is fired *after* the entity's state has been updated.
 *
 * Fired By: LockingSystem (after successful unlock attempt validation)
 * Consumed By: QuestSystem, TriggerSystem, LoggingSystem, systems reacting to state changes.
 *
 * @typedef {object} EntityUnlockedEventPayload
 * @property {string} userId The unique identifier of the entity who performed the action leading to the unlock.
 * @property {string} targetEntityId The unique identifier of the entity that was unlocked.
 * @property {string | null} keyItemId The unique identifier of the item instance used to unlock the entity, if applicable.
 */

/**
 * Defines the payload structure for the event:entity_locked event.
 * Signals that an entity has been successfully locked.
 * This event is fired *after* the entity's state has been updated.
 *
 * Fired By: LockingSystem (after successful lock attempt validation)
 * Consumed By: QuestSystem, TriggerSystem, LoggingSystem, systems reacting to state changes.
 *
 * @typedef {object} EntityLockedEventPayload
 * @property {string} userId The unique identifier of the entity who performed the action leading to the lock.
 * @property {string} targetEntityId The unique identifier of the entity that was locked.
 * @property {string | null} keyItemId The unique identifier of the item instance used to lock the entity, if applicable.
 */

/**
 * Special Case: Dynamically Named Events Triggered by Items/Effects.
 * The ItemUsageSystem's 'trigger_event' effect allows items to dispatch arbitrary events.
 * The exact event name is defined in the item's effect data (`eventName` parameter).
 * The payload structure is consistent but includes data passed from the effect parameters.
 *
 * Fired By: ItemUsageSystem (#handleTriggerEventEffect)
 * Consumed By: Systems listening for specific custom events defined in item data (e.g., QuestSystem, AreaEffectSystem).
 *
 * @typedef {object} DynamicTriggerEventPayload
 * @property {any} [payload_property_1] - Properties defined in the `event_payload` parameter of the 'trigger_event' effect.
 * @property {any} [payload_property_n] - ...
 * @property {string} userId The unique identifier of the entity that used the item causing the event trigger.
 * @property {string | null} targetId The unique identifier of the validated target entity of the item use, if applicable.
 * @property {string} sourceItemId The display name (or ID) of the item whose use triggered this event.
 */

/**
 * Event listened for by TriggerSystem for initial game load.
 * Not dispatched by provided code, but its expected payload (based on TriggerSystem handler) is included for completeness.
 *
 * Fired By: Game initialization logic (presumably)
 * Consumed By: TriggerSystem (#handleRoomEnteredInitialLook)
 *
 * @typedef {object} RoomEnteredEventPayload
 * @property {import('../entities/entity.js').default} newLocation The entity instance of the location being entered.
 * @property {import('../entities/entity.js').default} playerEntity The entity instance of the player entering the location.
 * @property {import('../entities/entity.js').default | null | undefined} previousLocation The entity instance of the location the player came from, or null/undefined on initial load.
 */

/**
 * Defines the payload structure for the event:connection_unlock_attempt event.
 * Signals that an entity is attempting to unlock a connection (like a door) using an item (like a key).
 * This event is typically triggered by an item's 'trigger_event' effect.
 *
 * Fired By: ItemUsageSystem (#handleTriggerEventEffect)
 * Consumed By: Systems responsible for handling connection state changes (e.g., DoorSystem, InteractionSystem).
 *
 * @typedef {object} ConnectionUnlockAttemptEventPayload
 * @property {string} connectionId The unique identifier of the connection (e.g., door) being targeted.
 * @property {string} keyId The unique identifier of the item instance used in the unlock attempt.
 * @property {string} userId The unique identifier of the entity (typically the player) performing the unlock attempt.
 * @property {string} locationId The unique identifier of the location where the unlock attempt is taking place.
 * @property {string} [sourceItemId] The display name (or ID) of the item whose use triggered this event (inherited from DynamicTriggerEventPayload if applicable).
 * @property {string | null} [targetId] This might be deprecated if the target is always the connection. If kept, should usually match connectionId in this context.
 */


// ========================================================================
// == UI Events (ui:) =====================================================
// ========================================================================

/**
 * Defines the payload structure for the ui:message_display event.
 * Used extensively throughout action handlers and systems to send textual feedback to the user interface.
 *
 * Fired By: Numerous Action Handlers and Systems.
 * Consumed By: Renderer/UI Layer.
 *
 * @typedef {object} UIMessageDisplayPayload
 * @property {string} text The message content to display to the user.
 * @property {'info' | 'warning' | 'error' | 'success' | 'combat' | 'combat_hit' | 'combat_critical' | 'sound' | 'prompt' | 'internal'} type A category hint for the message. Used for formatting or filtering in the UI.
 */

/**
 * Defines the payload structure for the ui:display_location event.
 * Sends the necessary data for the UI to render the description and contents of the player's current location.
 *
 * Fired By: lookActionHandler (when looking at the current location).
 * Consumed By: Renderer/UI Layer.
 *
 * @typedef {object} UIDisplayLocationPayload
 * @property {string} name The display name of the location.
 * @property {string} description The descriptive text for the location.
 * @property {string[]} exits A list of available exit directions (e.g., ['north', 'west']).
 * @property {string[]} [items] An optional list of display names for items visible in the location.
 * @property {string[]} [npcs] An optional list of display names for NPCs visible in the location.
 */

/**
 * Defines the payload structure for the event:door_unlocked event.
 * Signals that a connection (like a door) has been successfully unlocked,
 * typically as a result of an item use action (e.g., using a key).
 * This event fires *after* the connection's state has been updated.
 *
 * Fired By: DoorSystem (_handleConnectionUnlockAttempt)
 * Consumed By: QuestSystem, LoggingSystem, AchievementSystem, TriggerSystem (potentially), etc.
 *
 * @typedef {object} DoorUnlockedEventPayload
 * @property {string} userId The unique identifier of the entity (usually the player)
 * who performed the action leading to the unlock.
 * @property {string} locationId The unique identifier of the location entity where
 * the unlocked connection resides.
 * @property {string} connectionId The unique identifier of the specific connection
 * (e.g., 'north_door') that was unlocked.
 * @property {string | null} keyId The unique identifier of the specific item instance
 * used to unlock the connection. May be null if the unlock mechanism
 * didn't directly involve a tracked item ID (though typically expected from
 * connection_unlock_attempt).
 * @property {string} previousState The state of the connection *before* it was
 * unlocked (expected to be 'locked').
 * @property {string} newState The state of the connection *after* it was
 * unlocked (expected to be 'unlocked').
 */