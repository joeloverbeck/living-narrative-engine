// src/systems/statusEffectSystem.js

// Import event types
import {
    EVENT_APPLY_STATUS_EFFECT_REQUESTED,
    EVENT_REMOVE_STATUS_EFFECT_REQUESTED
} from '../types/eventTypes.js';

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../types/eventTypes.js').ApplyStatusEffectRequestedEventPayload} ApplyStatusEffectRequestedEventPayload */

/** @typedef {import('../types/eventTypes.js').RemoveStatusEffectRequestedEventPayload} RemoveStatusEffectRequestedEventPayload */

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
        this.#eventBus.subscribe(EVENT_APPLY_STATUS_EFFECT_REQUESTED, this._handleApplyStatusEffectRequested.bind(this));
        this.#eventBus.subscribe(EVENT_REMOVE_STATUS_EFFECT_REQUESTED, this._handleRemoveStatusEffectRequested.bind(this));
        console.log("StatusEffectSystem: Initialized and subscribed to APPLY_STATUS_EFFECT_REQUESTED and REMOVE_STATUS_EFFECT_REQUESTED.");
    }

    /**
     * Stub handler for applying status effect requests.
     * @private
     * @param {ApplyStatusEffectRequestedEventPayload} payload
     */
    _handleApplyStatusEffectRequested(payload) {
        console.log(`[StatusEffectSystem] Stub Handler: Received event '${EVENT_APPLY_STATUS_EFFECT_REQUESTED}' with payload:`, payload);
        // Phase 1: Implement actual status effect application logic here.
        // Needs StatusEffect component on entities.
    }

    /**
     * Stub handler for removing status effect requests.
     * @private
     * @param {RemoveStatusEffectRequestedEventPayload} payload
     */
    _handleRemoveStatusEffectRequested(payload) {
        console.log(`[StatusEffectSystem] Stub Handler: Received event '${EVENT_REMOVE_STATUS_EFFECT_REQUESTED}' with payload:`, payload);
        // Phase 1: Implement actual status effect removal logic here.
    }

    // Optional: Add shutdown method if needed
    shutdown() {
        this.#eventBus.unsubscribe(EVENT_APPLY_STATUS_EFFECT_REQUESTED, this._handleApplyStatusEffectRequested);
        this.#eventBus.unsubscribe(EVENT_REMOVE_STATUS_EFFECT_REQUESTED, this._handleRemoveStatusEffectRequested);
        console.log("StatusEffectSystem: Unsubscribed from events.");
    }
}

export default StatusEffectSystem;