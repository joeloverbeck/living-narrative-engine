// src/types/eventTypes.js

/**
 * @fileoverview Defines event payload structures used in the event bus.
 * This is the central contract definition for events exchanged between systems.
 * Includes core gameplay events (event:), UI events (ui:), and specific action request events.
 */

// ========================================================================
// == Core Gameplay Events (event:) =======================================
// ========================================================================

// --- Event Name Constants for Maintainability ---
export const EVENT_APPLY_HEAL_REQUESTED = 'event:apply_heal_requested';
export const EVENT_APPLY_STATUS_EFFECT_REQUESTED = 'event:apply_status_effect_requested';
export const EVENT_ATTACK_INTENDED = 'event:attack_intended';
export const EVENT_ENTITY_DIED = 'event:entity_died';
export const EVENT_ENTITY_LOCKED = 'event:entity_locked';
export const EVENT_ENTITY_LOOT_SPAWN_REQUESTED = 'event:entity_loot_spawn_requested';
export const EVENT_ENTITY_MOVED = 'event:entity_moved';
export const EVENT_ENTITY_OPENED = 'event:entity_opened';
export const EVENT_ENTITY_UNLOCKED = 'event:entity_unlocked';
export const EVENT_INFLICT_DAMAGE_REQUESTED = 'event:inflict_damage_requested';
export const EVENT_ITEM_CONSUME_REQUESTED = 'event:item_consume_requested';
export const EVENT_ITEM_DROP_ATTEMPTED = 'event:item_drop_attempted';
export const EVENT_ITEM_DROPPED = 'event:item_dropped';
export const EVENT_ITEM_EQUIP_ATTEMPTED = 'event:item_equip_attempted';
export const EVENT_ITEM_EQUIPPED = 'event:item_equipped';
// *** NEW CONSTANTS WILL GO HERE ALPHABETICALLY ***
export const EVENT_EXAMINE_INTENDED = 'event:examine_intended';
export const EVENT_LOOK_INTENDED = 'event:look_intended';
export const EVENT_ITEM_PICKED_UP = 'event:item_picked_up';
export const EVENT_ITEM_UNEQUIP_ATTEMPTED = 'event:item_unequip_attempted';
export const EVENT_ITEM_UNEQUIPPED = 'event:item_unequipped';
export const EVENT_ITEM_USE_ATTEMPTED = 'event:item_use_attempted';
export const EVENT_LOCK_ENTITY_ATTEMPT = 'event:lock_entity_attempt';
export const EVENT_MOVE_ATTEMPTED = 'event:move_attempted';
export const EVENT_MOVE_FAILED = 'event:move_failed';
export const EVENT_OPEN_ATTEMPTED = 'event:open_attempted';
export const EVENT_OPEN_FAILED = 'event:open_failed';
export const EVENT_REMOVE_STATUS_EFFECT_REQUESTED = 'event:remove_status_effect_requested';
export const EVENT_SPAWN_ENTITY_REQUESTED = 'event:spawn_entity_requested';
export const EVENT_UNLOCK_ENTITY_ATTEMPT = 'event:unlock_entity_attempt';
// ------------------------------------------------------------------------
//  Force‑unlock (scripted) – bypasses key validation in LockSystem
// ------------------------------------------------------------------------
/** @constant {string} */
export const EVENT_UNLOCK_ENTITY_FORCE = 'event:unlock_entity_force';
// Add more request event names as needed (e.g., change_state, teleport)


// --- Base Gameplay Event Payloads ---

/**
 * Payload for EVENT_LOOK_INTENDED. Signals intent to get information about a general scope.
 * @typedef {object} LookIntendedPayload
 * @property {string} actorId              – The unique ID of the entity initiating the look action (usually player).
 * @property {'location'|'self'|'target'} scope – The scope of the intended look action.
 * @property {string|null}  targetEntityId – The unique ID of the specific entity being looked at, only present when scope is 'target'. Null otherwise.
 */

/**
 * Payload for EVENT_EXAMINE_INTENDED. Signals intent to get detailed information about a specific target entity.
 * @typedef {object} ExamineIntendedPayload
 * @property {string} actorId – The unique ID of the entity initiating the examine action (usually player).
 * @property {string} targetEntityId – The unique ID of the specific entity being examined. Unique resolution happens in the handler.
 */


/**
 * Defines the payload structure for the EVENT_ITEM_USE_ATTEMPTED event.
 * This event signifies that a user has successfully indicated an intent
 * to use a specific item from their inventory, potentially targeting another entity
 * or connection within the current scope.
 * It is typically fired after basic command parsing and unique item identification
 * within the user's inventory, and potential unique target identification,
 * but before system-level validation (like usability conditions or target validity checks).
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
 * **Note:** While included in the payload for context, the `ItemUsageSystem` (as of T-6)
 * now ignores this field and retrieves the ID directly from the item instance's
 * `DefinitionRefComponent` using `itemInstanceId`.
 * @property {string | null} explicitTargetEntityId The unique identifier of the regular *entity*
 * that the user explicitly targeted with the command (e.g., the ID resolved from
 * "use potion *on goblin*"). This is mutually exclusive with `explicitTargetConnectionEntityId`.
 * It is `null` if the use command did not specify an explicit entity target or targeted a connection.
 * @property {string | null} explicitTargetConnectionEntityId The unique identifier of the *connection entity*
 * that the user explicitly targeted with the command (e.g., the ID resolved from
 * "use key *on north door*"). This is mutually exclusive with `explicitTargetEntityId`.
 * It is `null` if the use command did not specify an explicit connection target or targeted a regular entity.
 */

/**
 * Defines the payload structure for the EVENT_ATTACK_INTENDED event.
 * Signals that an entity intends to perform an attack against a target after initial validation
 * (target exists, has health, is not defeated). Does not guarantee the attack hits or deals damage yet.
 *
 * Fired By: attackActionHandler
 * Consumed By: CombatSystem
 *
 * @typedef {object} AttackIntendedEventPayload
 * @property {string} attackerId The unique identifier of the attacking entity.
 * @property {string} targetId The unique identifier of the entity being targeted for the attack.
 * before target defenses or resistances are applied.
 */

/**
 * Defines the payload structure for the EVENT_ITEM_DROP_ATTEMPTED event.
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
 * Defines the payload structure for the EVENT_ITEM_EQUIP_ATTEMPTED event.
 * Signals that a player has validated their intent to equip a specific item instance from their inventory
 * into a specific equipment slot. Validation includes item existence, equippability, and slot availability.
 * Note: Passing full Entity instances might be less ideal than using IDs for decoupling. Consider refactoring if needed.
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
 * Defines the payload structure for the EVENT_MOVE_ATTEMPTED event.
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
 * Defines the payload structure for the EVENT_MOVE_FAILED event. (Consider renaming to event:move_failed)
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
 * @property {'TARGET_LOCATION_NOT_FOUND' | 'DIRECTION_LOCKED' | 'DIRECTION_BLOCKED' | 'BLOCKER_NOT_FOUND' | 'MOVE_EXECUTION_ERROR' | 'MOVEMENT_EXECUTION_FAILED' | 'COORDINATOR_INTERNAL_ERROR' | string} reasonCode A code indicating why the move failed.
 * @property {string | null} details A user-friendly or diagnostic description of the failure reason.
 * @property {string | null} [blockerDisplayName] The display name of the entity that blocked the movement, if applicable.
 * @property {string | null} [blockerEntityId] The unique identifier of the entity that blocked the movement, if applicable.
 */

/**
 * Defines the payload structure for the EVENT_ITEM_PICKED_UP event.
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
 * Defines the payload structure for the EVENT_ITEM_UNEQUIP_ATTEMPTED event.
 * Signals that a player has validated their intent to unequip an item currently in a specific equipment slot.
 * Validation involves identifying the correct item/slot based on user input.
 * Note: Passing full Entity instances might be less ideal than using IDs for decoupling. Consider refactoring if needed.
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
 * Defines the payload structure for the EVENT_ENTITY_DIED event.
 * Signals that an entity's health has reached zero or below as a result of an action (typically combat).
 *
 * Fired By: CombatSystem, HealthSystem
 * Consumed By: DeathSystem, TriggerSystem (potentially), QuestSystem
 *
 * @typedef {object} EntityDiedEventPayload
 * @property {string} deceasedEntityId The unique identifier of the entity that died.
 * @property {string | null} killerEntityId The unique identifier of the entity considered responsible for the death (e.g., the attacker), or null if cause is environmental/indirect.
 */

/**
 * Defines the payload structure for the EVENT_ENTITY_LOOT_SPAWN_REQUESTED event.
 * Signals a request to potentially spawn loot in a specific location following an entity's death.
 *
 * Fired By: DeathSystem
 * Consumed By: LootSystem
 *
 * @typedef {object} EntityLootSpawnRequestedPayload
 * @property {string} deceasedEntityId The unique identifier of the entity that died, whose loot is requested.
 * @property {string} locationId The unique identifier of the location where the loot should potentially be spawned.
 * @property {string | null} [killerEntityId] The unique identifier of the killer, if available (optional, may influence loot).
 */

/**
 * Defines the payload structure for the EVENT_ITEM_CONSUME_REQUESTED event.
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
 * Defines the payload structure for the EVENT_ITEM_UNEQUIPPED event.
 * Signals that an item has been successfully removed from an entity's equipment slot and placed into their inventory.
 * This event confirms the state change is complete.
 * Note: Passing full Entity instances might be less ideal than using IDs for decoupling. Consider refactoring if needed.
 *
 * Fired By: EquipmentSystem (handleItemUnequipAttempted)
 * Consumed By: EffectSystem (for effect removal), other systems reacting to equipment changes.
 *
 * @typedef {object} ItemUnequippedEventPayload
 * @property {import('../entities/entity.js').default} entity The full entity instance whose equipment changed.
 * @property {string} itemId The unique identifier of the item instance that was unequipped.
 * @property {string} slotId The identifier of the equipment slot the item was removed from.
 * @property {import('../entities/entity.js').default} itemInstance The full entity instance of the item that was unequipped.
 */

/**
 * Defines the payload structure for the EVENT_ITEM_EQUIPPED event.
 * Signals that an item has been successfully removed from an entity's inventory and placed into an equipment slot.
 * This event confirms the state change is complete.
 * Note: Passing full Entity instances might be less ideal than using IDs for decoupling. Consider refactoring if needed.
 *
 * Fired By: EquipmentSystem (handleItemEquipAttempted)
 * Consumed By: EffectSystem (for effect application), other systems reacting to equipment changes.
 *
 * @typedef {object} ItemEquippedEventPayload
 * @property {import('../entities/entity.js').default} entity The full entity instance whose equipment changed.
 * @property {string} itemId The unique identifier of the item instance that was equipped.
 * @property {string} slotId The identifier of the equipment slot the item was placed into.
 * @property {import('../entities/entity.js').default} itemInstance The full entity instance of the item that was equipped.
 */

/**
 * Defines the payload structure for the EVENT_ENTITY_MOVED event.
 * Signals that an entity has successfully completed its move and its position has been updated.
 *
 * Fired By: MovementSystem, MoveCoordinatorSystem
 * Consumed By: TriggerSystem (for auto-look), potentially other systems reacting to location changes.
 *
 * @typedef {object} EntityMovedEventPayload
 * @property {string} entityId The unique identifier of the entity that moved.
 * @property {string} newLocationId The unique identifier of the location the entity has arrived in.
 * @property {string} oldLocationId The unique identifier of the location the entity moved from.
 * @property {string} direction The direction the entity moved to arrive at the new location.
 */

/**
 * Defines the payload structure for the EVENT_ITEM_DROPPED event.
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
 * Defines the payload structure for the EVENT_ENTITY_OPENED event.
 * Signals that an entity (e.g., door, container) was successfully opened by an actor.
 *
 * Fired By: OpenableSystem
 * Consumed By: UI/Renderer (for messages), TriggerSystem (potentially), LoggingSystem.
 *
 * @typedef {object} EntityOpenedEventPayload
 * @property {string} actorId - The unique identifier of the entity that initiated the open action.
 * @property {string} targetEntityId - The unique identifier of the entity that was successfully opened.
 * @property {string} targetDisplayName - The display name of the entity that was opened, for easy reference in logs or messages.
 */

/**
 * Defines the payload structure for the event:open_failed event.
 * Signals that an attempt to open an entity failed for a specific reason.
 *
 * Fired By: OpenableSystem
 * Consumed By: UI/Renderer (for failure messages), LoggingSystem.
 *
 * @typedef {object} OpenFailedEventPayload
 * @property {string} actorId - The unique identifier of the entity that initiated the failed open action.
 * @property {string} targetEntityId - The unique identifier of the entity that failed to open.
 * @property {string} targetDisplayName - The display name of the entity that failed to open.
 * @property {'ALREADY_OPEN' | 'LOCKED' | 'TARGET_NOT_OPENABLE' | 'OTHER'} reasonCode - A code indicating the specific reason for the failure.
 */

/**
 * Defines the payload structure for the event:open_attempted event.
 * Signals that an actor is attempting to open a target entity.
 * This event is fired *before* any state checks (like already open or locked).
 *
 * Fired By: openActionHandler
 * Consumed By: OpenableSystem
 *
 * @typedef {object} OpenAttemptedEventPayload
 * @property {string} actorId - The unique identifier of the entity attempting the open action.
 * @property {string} targetEntityId - The unique identifier of the entity being targeted for opening.
 */

/**
 * Defines the payload structure for the EVENT_UNLOCK_ENTITY_ATTEMPT event.
 * Signals that an entity is attempting to unlock another entity (e.g., a door, a chest, a mechanism).
 * This event is typically fired *before* validation or state changes occur.
 * (Confirmation: Payload structure compatible with ItemUsageSystem context)
 *
 * Fired By: ItemUsageSystem (via 'attempt_unlock' or 'trigger_event' effect), InteractionSystem
 * Consumed By: LockingSystem
 *
 * @typedef {object} UnlockEntityAttemptEventPayload
 * @property {string} userId The unique identifier of the entity attempting the unlock action.
 * @property {string} targetEntityId The unique identifier of the entity being targeted for unlocking.
 * @property {string | null} keyItemId The unique identifier of the item instance being used for the attempt, if any (typically the item triggering this event if fired by ItemUsageSystem).
 */

/**
 * Defines the payload structure for the EVENT_UNLOCK_ENTITY_FORCE event.
 * Used by cut‑scenes, triggers, or designer scripts to unlock an entity
 * without consuming / validating a key.
 *
 * Fired by: TriggerDispatcher, ItemUsageSystem (trigger_event effect), etc.
 * Consumed by: LockSystem
 *
 * @typedef {object} ForceUnlockEventPayload
 * @property {string} targetEntityId   The entity to unlock.
 * @property {string|null} [userId]    Who caused it (null for world events).
 * @property {true} [force]            Always true – lets analytics separate
 *                                     forced unlocks from player actions.
 */

/**
 * Defines the payload structure for the event:lock_entity_attempt event.
 * Signals that an entity is attempting to lock another entity (e.g., a door, a chest).
 * This event is typically fired *before* validation or state changes occur.
 * (Confirmation: Payload structure compatible with ItemUsageSystem context)
 *
 * Fired By: ItemUsageSystem (via 'attempt_lock' or 'trigger_event' effect), InteractionSystem
 * Consumed By: LockingSystem
 *
 * @typedef {object} LockEntityAttemptEventPayload
 * @property {string} userId The unique identifier of the entity attempting the lock action.
 * @property {string} targetEntityId The unique identifier of the entity being targeted for locking.
 * @property {string | null} keyItemId The unique identifier of the item instance being used for the attempt, if any.
 */

/**
 * Defines the payload structure for the EVENT_ENTITY_UNLOCKED event.
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
 * Defines the payload structure for the EVENT_ENTITY_LOCKED event.
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
 * Base structure for events dispatched via the 'trigger_event' effect in ItemUsageSystem.
 * It provides the core context of the item usage action that led to the event.
 * Listening systems consume specific event names defined in item data (e.g., 'event:quest_started')
 * which carry this payload structure, potentially merged with custom data from item parameters.
 * (Confirmation: Payload structure reviewed and compatible with ItemUsageSystem context)
 *
 * Fired By: ItemUsageSystem (#handleTriggerEventEffect or direct dispatch)
 * Consumed By: Systems listening for specific custom events defined in item data (e.g., QuestSystem, AreaEffectSystem, LockingSystem).
 *
 * @typedef {object} DynamicTriggerEventPayload
 * @property {string} userId The unique identifier of the entity (e.g., player) that used the item causing this event.
 * @property {string} itemInstanceId The unique identifier for the specific *instance* of the item entity being used.
 * @property {string} itemDefinitionId The definition ID (e.g., 'key_rusty', 'scroll_teleport') of the item used.
 * @property {string} sourceItemName The display name of the item used. Useful for logging or messages.
 * @property {string | null} validatedTargetId The unique identifier of the resolved Entity or Connection Entity that was targeted by the item use. Null if not targeted or target was invalid/not applicable.
 * @property {'entity' | 'connection' | 'none'} validatedTargetType Indicates the type of the resolved target ('connection' covers connection entities).
 * @property {Record<string, any>} [customPayload] Optional. Additional key-value data merged from the item's `effect.parameters.payload` in the 'trigger_event' effect definition. Allows passing arbitrary custom data specific to the item's effect.
 */

// --- Miscellaneous Core Events ---

/**
 * Event listened for by TriggerSystem for initial game load or room entry.
 * Not dispatched by provided code, but its expected payload is included for completeness.
 * Fired By: Game initialization logic, MovementSystem/MoveCoordinatorSystem (potentially adapting EntityMovedEventPayload)
 * Consumed By: TriggerSystem (#handleRoomEnteredInitialLook)
 *
 * @typedef {object} RoomEnteredEventPayload
 * @property {import('../entities/entity.js').default} newLocation The entity instance of the location being entered.
 * @property {import('../entities/entity.js').default} playerEntity The entity instance of the player entering the location.
 * @property {import('../entities/entity.js').default | null | undefined} previousLocation The entity instance of the location the player came from, or null/undefined on initial load.
 */


// ========================================================================
// == Item Effect Request Events (event:) (NEW - Ticket 0.3) ==============
// ========================================================================
// These events are fired by ItemUsageSystem when an item effect is triggered,
// requesting another system to perform the actual modification. They combine
// the context of the item use action with the specific parameters of the effect
// defined in the item's data (Usable component -> effects -> parameters).

/**
 * Defines the payload for the EVENT_APPLY_HEAL_REQUESTED event.
 * Signals a request to apply healing to an entity.
 *
 * Fired By: ItemUsageSystem
 * Consumed By: HealthSystem (or similar)
 *
 * @typedef {object} ApplyHealRequestedEventPayload
 * // --- Standard Context from ItemUsageSystem ---
 * @property {string} userId The ID of the entity that initiated the item use action.
 * @property {string} itemInstanceId The instance ID of the item used.
 * @property {string} itemDefinitionId The definition ID of the item used.
 * @property {string} sourceItemName The display name of the item used.
 * @property {string | null} validatedTargetId The ID of the entity/connection targeted by the item use command (if any).
 * @property {'entity' | 'connection' | 'none'} validatedTargetType The type of the target specified in the command.
 * // --- Custom Properties from Heal Effect Parameters ---
 * @property {number} amount The amount of health to restore (sourced from effect parameters).
 * @property {'user' | 'target'} healTargetSpecifier Specifies who should receive the heal relative to the action ('user' = the entity using the item, 'target' = the validated target of the item use) (sourced from effect parameters).
 */

/**
 * Defines the payload for the EVENT_INFLICT_DAMAGE_REQUESTED event.
 * Signals a request to inflict damage on an entity.
 *
 * Fired By: ItemUsageSystem
 * Consumed By: CombatSystem, HealthSystem (or similar)
 *
 * @typedef {object} InflictDamageRequestedEventPayload
 * // --- Standard Context from ItemUsageSystem ---
 * @property {string} userId The ID of the entity that initiated the item use action (the source of the damage).
 * @property {string} itemInstanceId The instance ID of the item used.
 * @property {string} itemDefinitionId The definition ID of the item used.
 * @property {string} sourceItemName The display name of the item used.
 * @property {string | null} validatedTargetId The ID of the entity/connection targeted by the item use command (if any).
 * @property {'entity' | 'connection' | 'none'} validatedTargetType The type of the target specified in the command.
 * // --- Custom Properties from Damage Effect Parameters ---
 * @property {number} damageAmount The base amount of damage to inflict (sourced from effect parameters).
 * @property {string} [damageType] Optional. The type of damage (e.g., 'physical', 'fire', 'arcane') (sourced from effect parameters). Defaults if not specified.
 * @property {'user' | 'target'} damageTargetSpecifier Specifies who should receive the damage relative to the action ('user' = the entity using the item, 'target' = the validated target of the item use) (sourced from effect parameters).
 */

/**
 * Defines the payload for the EVENT_APPLY_STATUS_EFFECT_REQUESTED event.
 * Signals a request to apply a status effect to an entity.
 *
 * Fired By: ItemUsageSystem
 * Consumed By: StatusEffectSystem (or similar)
 *
 * @typedef {object} ApplyStatusEffectRequestedEventPayload
 * // --- Standard Context from ItemUsageSystem ---
 * @property {string} userId The ID of the entity that initiated the item use action.
 * @property {string} itemInstanceId The instance ID of the item used.
 * @property {string} itemDefinitionId The definition ID of the item used.
 * @property {string} sourceItemName The display name of the item used.
 * @property {string | null} validatedTargetId The ID of the entity/connection targeted by the item use command (if any).
 * @property {'entity' | 'connection' | 'none'} validatedTargetType The type of the target specified in the command.
 * // --- Custom Properties from ApplyStatusEffect Effect Parameters ---
 * @property {string} effectId The unique identifier of the status effect definition to apply (e.g., 'poisoned', 'blessed') (sourced from effect parameters).
 * @property {number | null} duration The duration of the effect in game ticks or seconds (specific unit depends on game design). Null might mean permanent until removed (sourced from effect parameters).
 * @property {number} [stacks=1] Optional. The number of stacks to apply (sourced from effect parameters). Defaults to 1 if not specified.
 * @property {Record<string, any>} [effectOverrides] Optional. Key-value pairs to override default parameters of the status effect definition (e.g., potency, specific stat changes) (sourced from effect parameters).
 * @property {'user' | 'target'} statusEffectTargetSpecifier Specifies who should receive the status effect relative to the action ('user' = the entity using the item, 'target' = the validated target of the item use) (sourced from effect parameters).
 */

/**
 * Defines the payload for the EVENT_REMOVE_STATUS_EFFECT_REQUESTED event.
 * Signals a request to remove a status effect (or stacks) from an entity.
 *
 * Fired By: ItemUsageSystem
 * Consumed By: StatusEffectSystem (or similar)
 *
 * @typedef {object} RemoveStatusEffectRequestedEventPayload
 * // --- Standard Context from ItemUsageSystem ---
 * @property {string} userId The ID of the entity that initiated the item use action.
 * @property {string} itemInstanceId The instance ID of the item used.
 * @property {string} itemDefinitionId The definition ID of the item used.
 * @property {string} sourceItemName The display name of the item used.
 * @property {string | null} validatedTargetId The ID of the entity/connection targeted by the item use command (if any).
 * @property {'entity' | 'connection' | 'none'} validatedTargetType The type of the target specified in the command.
 * // --- Custom Properties from RemoveStatusEffect Effect Parameters ---
 * @property {string} effectId The unique identifier of the status effect definition to remove (e.g., 'poisoned', 'cursed'). Can also be a category like 'all_negative' (sourced from effect parameters).
 * @property {number | 'all'} [stacksToRemove='all'] Optional. The number of stacks to remove. 'all' removes all stacks of the specified effect (sourced from effect parameters). Defaults to 'all' if not specified.
 * @property {'user' | 'target'} statusEffectTargetSpecifier Specifies who the effect should be removed from relative to the action ('user' = the entity using the item, 'target' = the validated target of the item use) (sourced from effect parameters).
 */

/**
 * Defines the payload for the EVENT_SPAWN_ENTITY_REQUESTED event.
 * Signals a request to spawn a new entity into the game world.
 *
 * Fired By: ItemUsageSystem
 * Consumed By: WorldSystem, EntityManager (or similar spawning logic)
 *
 * @typedef {object} SpawnEntityRequestedEventPayload
 * // --- Standard Context from ItemUsageSystem ---
 * @property {string} userId The ID of the entity that initiated the item use action.
 * @property {string} itemInstanceId The instance ID of the item used.
 * @property {string} itemDefinitionId The definition ID of the item used.
 * @property {string} sourceItemName The display name of the item used.
 * @property {string | null} validatedTargetId The ID of the entity/connection targeted by the item use command (if any). Might influence spawn location.
 * @property {'entity' | 'connection' | 'none'} validatedTargetType The type of the target specified in the command.
 * // --- Custom Properties from SpawnEntity Effect Parameters ---
 * @property {string} entityDefinitionId The definition ID of the entity to be spawned (e.g., 'goblin_warrior', 'item_gold_coins') (sourced from effect parameters).
 * @property {number} [quantity=1] Optional. The number of entities to spawn (sourced from effect parameters). Defaults to 1.
 * @property {string | null} [spawnLocationId] Optional. Explicit location ID where the entity should spawn (sourced from effect parameters). If null, the consuming system might default to the user's location or the target's location based on `spawnLocationSpecifier`.
 * @property {'user_location' | 'target_location' | 'explicit_location'} [spawnLocationSpecifier='user_location'] Optional. Specifies how to determine the spawn location ('user_location', 'target_location' if target is valid, or 'explicit_location' requires `spawnLocationId`) (sourced from effect parameters). Defaults to 'user_location'.
 * @property {Record<string, any>} [initialStateOverrides] Optional. Key-value pairs to override components or state of the spawned entity upon creation (e.g., setting initial health, inventory items) (sourced from effect parameters).
 */


// ========================================================================
// == UI Events (ui:) =====================================================
// ========================================================================

// --- UI Event Name Constants ---
export const EVENT_DISPLAY_MESSAGE = 'event:display_message';
export const EVENT_DISPLAY_LOCATION = 'event:display_location';
export const EVENT_UPDATE_ACTIONS = 'event:update_actions';
// Add other UI event names as needed

/**
 * Defines the payload structure for the ui:message_display event.
 * Used extensively throughout action handlers and systems to send textual feedback to the user interface.
 *
 * Fired By: Numerous Action Handlers and Systems.
 * Consumed By: Renderer/UI Layer.
 *
 * @typedef {object} UIMessageDisplayPayload
 * @property {string} text The message content to display to the user.
 * @property {'info' | 'warning' | 'error' | 'success' | 'combat' | 'combat_hit' | 'combat_critical' | 'sound' | 'prompt' | 'internal' | 'debug'} type A category hint for the message. Used for formatting or filtering in the UI. Added 'debug'.
 */

/**
 * Defines the payload structure for the EVENT_DISPLAY_LOCATION event.
 * Sends the necessary data for the UI to render the description and contents of the player's current location.
 *
 * Fired By: PerceptionSystem (when looking at the current location), potentially MovementSystem after move.
 * Consumed By: Renderer/UI Layer.
 *
 * @typedef {object} LocationDisplayPayload
 * @property {string} name The display name of the location.
 * @property {string} description The descriptive text for the location.
 * @property {Array<{direction: string, locationId: string, displayName?: string, isLocked?: boolean, isBlocked?: boolean}>} exits An array of objects describing available exits, including direction, target location ID, and potentially display name/state.
 * @property {Array<{id: string, name: string, description?: string}>} [items] An optional list of objects describing items visible in the location.
 * @property {Array<{id: string, name: string, description?: string}>} [entities] An optional list of objects describing other entities (NPCs, players) visible in the location. // Changed from npcs for generality
 * @property {Array<{id: string, name: string, description?: string}>} [connections] An optional list of objects describing interactive connection entities (doors, passages) visible in the location. // Added connections
 */

/**
 * Defines the payload structure for the EVENT_UPDATE_ACTIONS.
 * Communicates the list of currently available actions for the player to the UI.
 * This allows the UI to dynamically render action buttons or other interactive elements.
 *
 * Fired By: GameLoop (after discovering actions via ActionDiscoverySystem).
 * Consumed By: DomRenderer (or other UI rendering components).
 * Purpose: To update the UI with clickable actions relevant to the current game state.
 *
 * @typedef {object} UIUpdateActionsPayload  // AC2: Payload definition
 * @property {string[]} actions - An array of strings, where each string represents an available action command (e.g., "look", "go north", "take potion", "attack goblin").
 */
