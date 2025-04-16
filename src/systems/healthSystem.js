// src/systems/healthSystem.js

// Import event types
import {
    EVENT_APPLY_HEAL_REQUESTED,
    EVENT_INFLICT_DAMAGE_REQUESTED,
    UI_MESSAGE_DISPLAY // Needed for feedback
} from '../types/eventTypes.js';
// Import required components and utilities
import {HealthComponent} from '../components/healthComponent.js';
import {getDisplayName} from '../utils/messages.js'; // Needed for entity names in messages

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/eventTypes.js').ApplyHealRequestedEventPayload} ApplyHealRequestedEventPayload */
/** @typedef {import('../types/eventTypes.js').InflictDamageRequestedEventPayload} InflictDamageRequestedEventPayload */

/** @typedef {import('../types/eventTypes.js').UIMessageDisplayPayload} UIMessageDisplayPayload */

/**
 * System responsible for handling direct changes to entity health,
 * such as applying healing or damage requested by item effects or other actions.
 */
class HealthSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {DataManager} */
    #dataManager; // Kept for potential future use, though not used in heal handler

    /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus
     * @param {EntityManager} dependencies.entityManager
     * @param {DataManager} dependencies.dataManager
     */
    constructor({eventBus, entityManager, dataManager}) {
        if (!eventBus) throw new Error("HealthSystem requires EventBus.");
        if (!entityManager) throw new Error("HealthSystem requires EntityManager.");
        // dataManager might not be strictly needed yet but good practice to inject dependencies
        if (!dataManager) throw new Error("HealthSystem requires DataManager.");

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;

        console.log("HealthSystem: Instance created.");
    }

    /**
     * Initializes the system by subscribing to health-related events.
     * Confirms subscription required by Ticket 2.1.
     */
    initialize() {
        // Task: Add/confirm the subscription
        this.#eventBus.subscribe(EVENT_APPLY_HEAL_REQUESTED, this._handleApplyHealRequested.bind(this));
        // Existing subscription for damage (can remain or be implemented later)
        this.#eventBus.subscribe(EVENT_INFLICT_DAMAGE_REQUESTED, this._handleInflictDamageRequested.bind(this));
        console.log("HealthSystem: Initialized and subscribed to APPLY_HEAL_REQUESTED and INFLICT_DAMAGE_REQUESTED.");
    }

    /**
     * Handles the request to apply healing to an entity based on the
     * EVENT_APPLY_HEAL_REQUESTED event.
     * Implements the logic described in Ticket 2.1.
     *
     * @private
     * @param {ApplyHealRequestedEventPayload} payload - The event payload containing details for the heal request.
     */
    _handleApplyHealRequested(payload) {
        // Task: Cast or treat payload as ApplyHealRequestedEventPayload (Handled by JSDoc/parameter type)

        // Task: Log the received payload for debugging.
        console.debug(`[HealthSystem] Received event '${EVENT_APPLY_HEAL_REQUESTED}' with payload:`, payload);

        // Task: Determine the target Entity
        let targetEntity = null;
        let targetEntityIdForLog = 'N/A'; // For logging purposes

        if (payload.healTargetSpecifier === 'user') {
            targetEntityIdForLog = payload.userId;
            targetEntity = this.#entityManager.getEntityInstance(payload.userId);
        } else if (payload.healTargetSpecifier === 'target') {
            targetEntityIdForLog = payload.validatedTargetId;
            // Task: Handle cases where validatedTargetId might be null or not an entity.
            // getEntityInstance handles null/undefined input gracefully, returning null/undefined.
            targetEntity = payload.validatedTargetId ? this.#entityManager.getEntityInstance(payload.validatedTargetId) : null;
        } else {
            // Unknown specifier is an error
            console.error(`[HealthSystem] Heal failed: Unknown healTargetSpecifier '${payload.healTargetSpecifier}' from item ${payload.itemDefinitionId} (Instance: ${payload.itemInstanceId})`);
            // Provide minimal feedback, though this indicates a data setup error
            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                text: "Internal error: Cannot determine heal target.",
                type: 'error'
            });
            return; // Stop processing
        }

        // Task: Validate the target entity: Check if it exists and has a HealthComponent.
        if (!targetEntity) {
            console.warn(`[HealthSystem] Heal failed: Target entity not found (Specifier: '${payload.healTargetSpecifier}', Attempted ID: ${targetEntityIdForLog}). Source Item: ${payload.sourceItemName} (${payload.itemDefinitionId})`);
            // Task: If not, dispatch an appropriate ui:message_display ("Cannot heal that.") and return.
            // Note: ItemUsageSystem might have already filtered invalid targets, but this provides a safety net.
            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: "Cannot heal that.", type: 'warning'});
            return;
        }

        // Task: Get the HealthComponent.
        /** @type {HealthComponent | null} */
        const healthComponent = targetEntity.getComponent(HealthComponent);
        const targetName = getDisplayName(targetEntity); // Get name for messages

        if (!healthComponent) {
            console.warn(`[HealthSystem] Heal failed: Target entity '${targetName}' (ID: ${targetEntity.id}) does not have a HealthComponent. Source Item: ${payload.sourceItemName}`);
            // Task: If not, dispatch an appropriate ui:message_display ("Cannot heal that.") and return.
            // Provide slightly more context if possible.
            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: `The ${targetName} cannot be healed.`, type: 'warning'});
            return;
        }

        // Task: Check if health is already full.
        if (healthComponent.current >= healthComponent.max) {
            // Determine subject for the message
            const subject = (targetEntity.id === payload.userId) ? "You are" : `${targetName} is`;
            // Task: If yes, dispatch "Health is full." message (type: 'info') and return
            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: `${subject} already at full health.`, type: 'info'});
            console.debug(`[HealthSystem] Heal skipped: Target '${targetName}' (ID: ${targetEntity.id}) already at full health (${healthComponent.current}/${healthComponent.max}). Source Item: ${payload.sourceItemName}`);
            // Task: (unless item should fail here based on a potential fail_if_already_max flag in payload).
            // No such flag defined in ApplyHealRequestedEventPayload, so we return.
            return;
        }

        // Task: Apply the healing: healthComponent.current = Math.min(healthComponent.max, healthComponent.current + payload.amount);. Calculate actualHeal.
        const healAmount = payload.amount;
        if (typeof healAmount !== 'number' || healAmount < 0) {
            console.warn(`[HealthSystem] Heal failed: Invalid heal amount (${healAmount}) received for target '${targetName}'. Source Item: ${payload.sourceItemName}`);
            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                text: `Cannot apply healing due to invalid amount.`,
                type: 'warning'
            });
            return;
        }

        const healthBeforeHeal = healthComponent.current;
        const potentialNewHealth = healthBeforeHeal + healAmount;
        const newHealth = Math.min(healthComponent.max, potentialNewHealth);

        // Calculate the actual amount of health restored
        const actualHeal = newHealth - healthBeforeHeal;

        // Only update and report if actual healing occurred.
        if (actualHeal > 0) {
            healthComponent.current = newHealth;
            console.debug(`[HealthSystem] Applied ${actualHeal} healing to '${targetName}' (ID: ${targetEntity.id}). New health: ${newHealth}/${healthComponent.max}. Source Item: ${payload.sourceItemName}`);

            // Task: Dispatch success ui:message_display (e.g., You heal ${targetName} for ${actualHeal} health., type: 'success').
            let successMessage = "";
            // Customize message based on who was healed
            if (targetEntity.id === payload.userId) {
                // User healed themselves
                successMessage = `You heal yourself for ${actualHeal} health.`;
            } else {
                // User healed someone/something else
                successMessage = `You heal ${targetName} for ${actualHeal} health.`;
            }

            this.#eventBus.dispatch(UI_MESSAGE_DISPLAY, {
                text: successMessage,
                type: 'success'
            });

            // Optional: Dispatch another event like 'event:entity_healed' if other systems need to react
            // this.#eventBus.dispatch('event:entity_healed', {
            //    healerId: payload.userId, // The initiator of the item use
            //    targetId: targetEntity.id,
            //    amountHealed: actualHeal,
            //    sourceItemId: payload.itemDefinitionId,
            //    newHealth: newHealth,
            //    maxHealth: healthComponent.max
            // });

        } else {
            // This branch might be reached if healAmount was 0, or if health was already max (though the earlier check should prevent that).
            // Log it, but don't send a user message unless it was an error condition (like negative amount, handled above).
            console.debug(`[HealthSystem] Requested heal amount (${healAmount}) resulted in no actual health change for '${targetName}'. Current: ${healthComponent.current}/${healthComponent.max}. Source Item: ${payload.sourceItemName}`);
            // No UI message needed if no change occurred.
        }
    }

    /**
     * Stub handler for inflicting damage requests.
     * Needs implementation based on CombatSystem/Damage logic.
     * @private
     * @param {InflictDamageRequestedEventPayload} payload
     */
    _handleInflictDamageRequested(payload) {
        console.log(`[HealthSystem] STUB Handler: Received event '${EVENT_INFLICT_DAMAGE_REQUESTED}' with payload:`, payload);
        // TODO: Implement damage application logic, considering target validation,
        // HealthComponent, defenses, resistances, and potentially dispatching
        // EVENT_ENTITY_DIED if health drops to 0 or below.
        // This might delegate to a CombatSystem or handle directly.
    }

    /**
     * Cleans up subscriptions when the system is shut down.
     */
    shutdown() {
        this.#eventBus.unsubscribe(EVENT_APPLY_HEAL_REQUESTED, this._handleApplyHealRequested);
        this.#eventBus.unsubscribe(EVENT_INFLICT_DAMAGE_REQUESTED, this._handleInflictDamageRequested);
        console.log("HealthSystem: Unsubscribed from events.");
    }
}

export default HealthSystem;