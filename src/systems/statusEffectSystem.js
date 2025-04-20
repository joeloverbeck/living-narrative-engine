// src/systems/statusEffectSystem.js

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */

/**
 * System responsible for managing status effects on entities,
 * including application, removal, and potentially ticking effects over time.
 */
class StatusEffectSystem {
    #eventBus;
    #entityManager;
    #repository; // Renamed

    constructor({eventBus, entityManager, gameDataRepository}) { // Updated param name
        if (!eventBus) throw new Error("StatusEffectSystem requires EventBus.");
        if (!entityManager) throw new Error("StatusEffectSystem requires EntityManager.");
        if (!gameDataRepository) throw new Error("StatusEffectSystem requires GameDataRepository."); // Updated check

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#repository = gameDataRepository; // Updated assignment
        console.log("StatusEffectSystem: Instance created.");
    }

    /**
     * Initializes the system by subscribing to status effect related events.
     */
    initialize() {
        this.#eventBus.subscribe("event:apply_status_effect_requested", this._handleApplyStatusEffectRequested.bind(this));
        this.#eventBus.subscribe("event:remove_status_effect_requested", this._handleRemoveStatusEffectRequested.bind(this));
        console.log("StatusEffectSystem: Initialized and subscribed to APPLY_STATUS_EFFECT_REQUESTED and REMOVE_STATUS_EFFECT_REQUESTED.");
    }

    /**
     * Stub handler for applying status effect requests.
     * @private
     * @param {ApplyStatusEffectRequestedEventPayload} payload
     */
    _handleApplyStatusEffectRequested(payload) {
        console.log(`[StatusEffectSystem] Stub Handler: Received event '${"event:apply_status_effect_requested"}' with payload:`, payload);
        // Phase 1: Implement actual status effect application logic here.
        // Needs StatusEffect component on entities.
    }

    /**
     * Stub handler for removing status effect requests.
     * @private
     * @param {RemoveStatusEffectRequestedEventPayload} payload
     */
    _handleRemoveStatusEffectRequested(payload) {
        console.log(`[StatusEffectSystem] Stub Handler: Received event '${"event:remove_status_effect_requested"}' with payload:`, payload);
        // Phase 1: Implement actual status effect removal logic here.
    }

    // Optional: Add shutdown method if needed
    shutdown() {
        this.#eventBus.unsubscribe("event:apply_status_effect_requested", this._handleApplyStatusEffectRequested);
        this.#eventBus.unsubscribe("event:remove_status_effect_requested", this._handleRemoveStatusEffectRequested);
        console.log("StatusEffectSystem: Unsubscribed from events.");
    }
}

export default StatusEffectSystem;