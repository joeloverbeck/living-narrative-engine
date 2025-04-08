// src/systems/combatSystem.js

import {HealthComponent} from '../components/healthComponent.js';
import {NameComponent} from '../components/nameComponent.js';

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../dataManager.js').default} DataManager */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles the application of damage based on attack intentions and processes entity death.
 */
class CombatSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {DataManager} */
    #dataManager; // Included for future enhancements (resistances, etc.)

    /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus
     * @param {EntityManager} dependencies.entityManager
     * @param {DataManager} dependencies.dataManager
     */
    constructor({eventBus, entityManager, dataManager}) {
        if (!eventBus || !entityManager || !dataManager) {
            throw new Error("CombatSystem requires EventBus, EntityManager, and DataManager.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
    }

    /**
     * Subscribes to relevant events. Call this after instantiation.
     */
    initialize() {
        // Bind the handler to ensure 'this' context is correct when called by EventBus
        this.#eventBus.subscribe('event:attack_intended', this._handleAttackIntended.bind(this));
        console.log("CombatSystem: Initialized and subscribed to 'event:attack_intended'.");
    }

    /**
     * Handles the 'event:attack_intended' event, calculates and applies damage,
     * and checks for death.
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
            // Dispatch a message? Maybe not, the handler already did.
            return;
        }

        // --- 2. Retrieve Target Health Component ---
        const targetHealthComp = targetEntity.getComponent(HealthComponent);
        if (!targetHealthComp) {
            console.error(`CombatSystem: Target entity ${targetId} does not have a HealthComponent. Cannot apply damage.`);
            const targetNameComp = targetEntity.getComponent(NameComponent);
            const targetDisplayName = targetNameComp ? targetNameComp.value : `entity ${targetEntity.id}`;
            this.#eventBus.dispatch('ui:message_display', {
                text: `You cannot damage the ${targetDisplayName}.`,
                type: 'warning'
            });
            return;
        }

        // --- 3. Check if Target Already Dead ---
        // We process the intent even if dead to allow messages, but maybe skip damage?
        // Let's apply damage anyway, but clamp at 0. The check for *transition* is key.
        const healthBefore = targetHealthComp.current;
        if (healthBefore <= 0) {
            // We might still get here if multiple attacks land in the same 'tick' before death processing
            // No need to apply more damage or fire another death event.
            // console.log(`CombatSystem: Target ${targetId} already has 0 or less health. Ignoring further damage application.`);
            // Optionally, add a message like "It's already dead!" - but attack handler might cover this.
            return;
        }

        // --- 4. Calculate Actual Damage (MVP: Simple Application) ---
        // TODO: Implement defense, resistance, armor checks here using dataManager/components
        const actualDamage = potentialDamage;

        // --- 5. Apply Damage & Clamp Health ---
        const newHealth = healthBefore - actualDamage;
        const clampedNewHealth = Math.max(0, newHealth);
        targetHealthComp.current = clampedNewHealth;

        console.log(`CombatSystem: Applied ${actualDamage} damage to ${targetId}. Health: ${healthBefore} -> ${clampedNewHealth}`);

        // --- 6. Dispatch UI Hit Message ---
        const attackerNameComp = attackerEntity.getComponent(NameComponent);
        const attackerDisplayName = attackerNameComp ? attackerNameComp.value : 'Attacker';
        const targetNameComp = targetEntity.getComponent(NameComponent);
        const targetDisplayName = targetNameComp ? targetNameComp.value : `entity ${targetEntity.id}`;
        const hitMessage = `${attackerDisplayName} hit${attackerDisplayName === 'You' ? '' : 's'} the ${targetDisplayName} for ${actualDamage} damage!`;
        this.#eventBus.dispatch('ui:message_display', {text: hitMessage, type: 'combat_hit'}); // Use a specific type

        // --- 7. Check for Death (Transition) ---
        if (clampedNewHealth <= 0 && healthBefore > 0) {
            console.log(`CombatSystem: Target ${targetId} died.`);

            // --- 7a. Fire Death Event ---
            this.#eventBus.dispatch('event:entity_died', {
                deceasedEntityId: targetId,
                killerEntityId: attackerId
            });

            // --- 7b. Dispatch UI Death Message ---
            const deathMessage = `The ${targetDisplayName} collapses, defeated!`;
            this.#eventBus.dispatch('ui:message_display', {text: deathMessage, type: 'combat_critical'}); // Critical event type

            // TODO: Future: Trigger loot drops, XP gain, quest updates via listeners on 'event:entity_died'
        }
    }
}

export default CombatSystem;