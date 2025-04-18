// src/systems/combatSystem.js
import {HealthComponent} from '../components/healthComponent.js';
import {NameComponent} from '../components/nameComponent.js';
import {
    EVENT_ATTACK_INTENDED,
    EVENT_DISPLAY_MESSAGE,
    EVENT_ENTITY_DIED, // Keep for reference/context, but won't dispatch directly
    EVENT_INFLICT_DAMAGE_REQUESTED // Import the new event type
} from "../types/eventTypes.js";

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */


/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles the *intention* to attack, calculates potential damage,
 * and requests damage application via event dispatch. It no longer
 * directly modifies health or handles death events.
 */
class CombatSystem {
    #eventBus;
    #entityManager;
    #repository;

    constructor({eventBus, entityManager, gameDataRepository}) { // Updated param name
        if (!eventBus || !entityManager || !gameDataRepository) { // Updated check
            throw new Error("CombatSystem requires EventBus, EntityManager, and GameDataRepository."); // Updated error
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#repository = gameDataRepository; // Updated assignment
    }

    /**
     * Subscribes to relevant events. Call this after instantiation.
     */
    initialize() {
        // Bind the handler to ensure 'this' context is correct when called by EventBus
        this.#eventBus.subscribe(EVENT_ATTACK_INTENDED, this._handleAttackIntended.bind(this));
        console.log("CombatSystem: Initialized and subscribed to '" + EVENT_ATTACK_INTENDED + "'.");
    }

    /**
     * Handles the EVENT_ATTACK_INTENDED event, calculates potential damage,
     * dispatches a damage request, and sends a UI message about the attack.
     * @param {object} eventData
     * @param {string} eventData.attackerId
     * @param {string} eventData.targetId
     * @param {number} eventData.potentialDamage
     * @private
     */
    _handleAttackIntended(eventData) {
        const {attackerId, targetId, potentialDamage} = eventData;
        console.log(`CombatSystem: Handling attack intention from ${attackerId} to ${targetId} for ${potentialDamage} potential damage.`);

        // --- 1. Retrieve Entities ---
        const attackerEntity = this.#entityManager.getEntityInstance(attackerId);
        const targetEntity = this.#entityManager.getEntityInstance(targetId);

        if (!attackerEntity) {
            console.error(`CombatSystem: Attacker entity not found for ID: ${attackerId}. Cannot process attack.`);
            return;
        }
        if (!targetEntity) {
            console.error(`CombatSystem: Target entity not found for ID: ${targetId}. Cannot process attack.`);
            // Attack handler likely already sent a message if target was invalid.
            return;
        }

        // --- 2. Retrieve Target Health Component (for validation only) ---
        const targetHealthComp = targetEntity.getComponent(HealthComponent);
        const targetNameComp = targetEntity.getComponent(NameComponent); // For messages
        const targetDisplayName = targetNameComp ? targetNameComp.value : `entity ${targetEntity.id}`;

        if (!targetHealthComp) {
            console.warn(`CombatSystem: Target entity ${targetDisplayName} (ID: ${targetId}) does not have a HealthComponent. Cannot request damage.`);
            // Send feedback that the target is invalid for damage
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                text: `You cannot damage the ${targetDisplayName}.`,
                type: 'warning'
            });
            return;
        }

        // --- 3. Check if Target Already Seems Dead (basic check) ---
        // HealthSystem will perform the definitive check before applying damage.
        // This prevents spamming damage requests if multiple attacks resolve in one tick
        // after the target should already be considered dead by CombatSystem.
        if (targetHealthComp.current <= 0) {
            console.log(`CombatSystem: Target ${targetDisplayName} (ID: ${targetId}) already appears to have 0 or less health. Skipping damage request.`);
            // Optionally, add a message like "It's already dead!" - but the attack handler might cover this.
            // Or maybe the target selection should prevent targeting dead entities.
            // Let's keep it silent here for now.
            return;
        }

        // --- 4. Calculate Actual Damage (MVP: Simple Application) ---
        // TODO: Implement defense, resistance, armor checks here using gameDataRepository/components
        const actualDamage = potentialDamage;

        // --- 5. Dispatch Damage Request Event --- <<<<------ CHANGE HERE
        // Instead of applying damage directly, dispatch an event for HealthSystem
        this.#eventBus.dispatch(EVENT_INFLICT_DAMAGE_REQUESTED, {
            targetId: targetId,
            amount: actualDamage,
            sourceEntityId: attackerId // Pass attacker ID for death attribution
        });
        console.log(`CombatSystem: Dispatched ${EVENT_INFLICT_DAMAGE_REQUESTED} for ${actualDamage} damage to ${targetId} from ${attackerId}.`);


        // --- 6. Dispatch UI Hit Message ---
        // This remains appropriate here as it describes the attack action.
        const attackerNameComp = attackerEntity.getComponent(NameComponent);
        const attackerDisplayName = attackerNameComp ? attackerNameComp.value : 'Attacker';

        const hitMessage = `${attackerDisplayName} hit${attackerDisplayName === 'You' ? '' : 's'} the ${targetDisplayName} for ${actualDamage} damage!`;
        this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: hitMessage, type: 'combat_hit'});

        // --- 7. Death Check and Death Event/Message REMOVED ---
        // This logic is now the responsibility of the HealthSystem,
        // which will listen for EVENT_INFLICT_DAMAGE_REQUESTED.
    }

    /**
     * Cleans up subscriptions when the system is shut down.
     */
    shutdown() {
        this.#eventBus.unsubscribe(EVENT_ATTACK_INTENDED, this._handleAttackIntended);
        console.log("CombatSystem: Unsubscribed from " + EVENT_ATTACK_INTENDED + ".");
    }
}

export default CombatSystem;