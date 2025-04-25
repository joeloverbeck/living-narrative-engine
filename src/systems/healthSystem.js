// src/systems/healthSystem.js

// Import required components and utilities
import {HealthComponent} from '../components/healthComponent.js';
import {getDisplayName} from '../utils/messages.js';
import gameEngine from '../core/gameEngine.js'; // Needed for entity names in messages

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */


/**
 * System responsible for handling direct changes to entity health,
 * such as applying healing or damage requested by events.
 * It also handles the transition to death when health reaches zero.
 */
class HealthSystem {
  /** @type {EventBus} */
  #eventBus;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {GameDataRepository} */
  #repository; // Kept for potential future use (e.g., resistances applied here)

  /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus
     * @param {EntityManager} dependencies.entityManager
     * @param {GameDataRepository} dependencies.gameDataRepository
     */
  constructor({eventBus, entityManager, gameDataRepository}) {
    if (!eventBus) throw new Error('HealthSystem requires EventBus.');
    if (!entityManager) throw new Error('HealthSystem requires EntityManager.');
    if (!gameDataRepository) throw new Error('HealthSystem requires GameDataRepository.'); // Keep injection
    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    this.#repository = gameDataRepository;
    console.log('HealthSystem: Instance created.');
  }

  /**
     * Initializes the system by subscribing to health-related events.
     */
  initialize() {
    this.#eventBus.subscribe('event:apply_heal_requested', this._handleApplyHealRequested.bind(this));
    this.#eventBus.subscribe('event:inflict_damage_requested', this._handleInflictDamageRequested.bind(this));
    console.log(`HealthSystem: Initialized and subscribed to ${'event:apply_heal_requested'} and ${'event:inflict_damage_requested'}.`);
  }

  /**
     * Handles the request to apply healing to an entity.
     * @private
     * @param {ApplyHealRequestedEventPayload} payload
     */
  _handleApplyHealRequested(payload) {
    // ... (existing heal logic remains unchanged) ...
    console.debug(`[HealthSystem] Received event '${'event:apply_heal_requested'}' with payload:`, payload);
    let targetEntity = null;
    let targetEntityIdForLog = 'N/A';
    if (payload.healTargetSpecifier === 'user') {
      targetEntityIdForLog = payload.userId;
      targetEntity = this.#entityManager.getEntityInstance(payload.userId);
    } else if (payload.healTargetSpecifier === 'target') {
      targetEntityIdForLog = payload.validatedTargetId;
      targetEntity = payload.validatedTargetId ? this.#entityManager.getEntityInstance(payload.validatedTargetId) : null;
    } else {
      console.error(`[HealthSystem] Heal failed: Unknown healTargetSpecifier '${payload.healTargetSpecifier}' from item ${payload.itemDefinitionId} (Instance: ${payload.itemInstanceId})`);
      this.#eventBus.dispatch('event:display_message', {
        text: 'Internal error: Cannot determine heal target.',
        type: 'error'
      });
      return;
    }

    if (!targetEntity) {
      console.warn(`[HealthSystem] Heal failed: Target entity not found (Specifier: '${payload.healTargetSpecifier}', Attempted ID: ${targetEntityIdForLog}). Source Item: ${payload.sourceItemName} (${payload.itemDefinitionId})`);
      this.#eventBus.dispatch('event:display_message', {text: 'Cannot heal that.', type: 'warning'});
      return;
    }

    /** @type {HealthComponent | null} */
    const healthComponent = targetEntity.getComponent(HealthComponent);
    const targetName = getDisplayName(targetEntity);

    if (!healthComponent) {
      console.warn(`[HealthSystem] Heal failed: Target entity '${targetName}' (ID: ${targetEntity.id}) does not have a HealthComponent. Source Item: ${payload.sourceItemName}`);
      this.#eventBus.dispatch('event:display_message', {
        text: `The ${targetName} cannot be healed.`,
        type: 'warning'
      });
      return;
    }

    if (healthComponent.current >= healthComponent.max) {
      const subject = (targetEntity.id === payload.userId) ? 'You are' : `${targetName} is`;
      this.#eventBus.dispatch('event:display_message', {text: `${subject} already at full health.`, type: 'info'});
      console.debug(`[HealthSystem] Heal skipped: Target '${targetName}' (ID: ${targetEntity.id}) already at full health (${healthComponent.current}/${healthComponent.max}). Source Item: ${payload.sourceItemName}`);
      return;
    }

    const healAmount = payload.amount;
    if (typeof healAmount !== 'number' || healAmount < 0) {
      console.warn(`[HealthSystem] Heal failed: Invalid heal amount (${healAmount}) received for target '${targetName}'. Source Item: ${payload.sourceItemName}`);
      this.#eventBus.dispatch('event:display_message', {
        text: 'Cannot apply healing due to invalid amount.',
        type: 'warning'
      });
      return;
    }

    const healthBeforeHeal = healthComponent.current;
    const potentialNewHealth = healthBeforeHeal + healAmount;
    const newHealth = Math.min(healthComponent.max, potentialNewHealth);
    const actualHeal = newHealth - healthBeforeHeal;

    if (actualHeal > 0) {
      healthComponent.current = newHealth;
      console.debug(`[HealthSystem] Applied ${actualHeal} healing to '${targetName}' (ID: ${targetEntity.id}). New health: ${newHealth}/${healthComponent.max}. Source Item: ${payload.sourceItemName}`);

      let successMessage = '';
      if (targetEntity.id === payload.userId) {
        successMessage = `You heal yourself for ${actualHeal} health.`;
      } else {
        // Need user entity for the message source, but we only have userId from payload
        // Assuming the message should reflect the action taker (user)
        const userEntity = this.#entityManager.getEntityInstance(payload.userId);
        const userName = userEntity ? getDisplayName(userEntity) : 'Someone'; // Fallback
        // Or simplify the message:
        successMessage = `${targetName} is healed for ${actualHeal} health.`;
        // If you need "You heal X", you might need the user's ID explicitly passed or looked up.
        // Let's stick to a more generic one for healing others for now.
        // Reverting to the previous simpler logic:
        if (targetEntity.id === payload.userId) {
          successMessage = `You heal yourself for ${actualHeal} health.`;
        } else {
          successMessage = `You heal ${targetName} for ${actualHeal} health.`; // Assumes 'You' is the actor
        }

      }

      this.#eventBus.dispatch('event:display_message', {
        text: successMessage,
        type: 'success'
      });
    } else {
      console.debug(`[HealthSystem] Requested heal amount (${healAmount}) resulted in no actual health change for '${targetName}'. Current: ${healthComponent.current}/${healthComponent.max}. Source Item: ${payload.sourceItemName}`);
    }
  }

  /**
     * Handles the request to inflict damage on an entity based on the
     * "event:inflict_damage_requested" event. Applies damage, clamps health,
     * checks for death, and dispatches death-related events/messages.
     * @private
     * @param {InflictDamageRequestedEventPayload} payload - The event payload.
     */
  _handleInflictDamageRequested(payload) {
    console.debug(`[HealthSystem] Received event '${'event:inflict_damage_requested'}' with payload:`, payload);

    const {targetId, amount, sourceEntityId} = payload;

    // --- Validate Damage Amount ---
    if (typeof amount !== 'number' || amount < 0) {
      console.warn(`[HealthSystem] Damage failed: Invalid damage amount (${amount}) received for target ID '${targetId}'. Source: ${sourceEntityId || 'Unknown'}`);
      // Maybe dispatch an error message? Depends if this should ever happen.
      return; // Stop processing if damage amount is invalid
    }

    // --- Retrieve Target Entity ---
    const targetEntity = this.#entityManager.getEntityInstance(targetId);

    if (!targetEntity) {
      console.warn(`[HealthSystem] Damage failed: Target entity not found (ID: ${targetId}). Source: ${sourceEntityId || 'Unknown'}`);
      // No UI message here usually, as the CombatSystem might have already reported a miss or invalid target.
      return;
    }

    // --- Retrieve Health Component & Target Name ---
    /** @type {HealthComponent | null} */
    const healthComponent = targetEntity.getComponent(HealthComponent);
    const targetName = getDisplayName(targetEntity); // Get name for messages/logs

    if (!healthComponent) {
      console.warn(`[HealthSystem] Damage failed: Target entity '${targetName}' (ID: ${targetId}) does not have a HealthComponent. Source: ${sourceEntityId || 'Unknown'}`);
      // Again, CombatSystem likely handled the feedback if the attack was attempted.
      return;
    }

    // --- Check if Already Dead ---
    const healthBefore = healthComponent.current;
    if (healthBefore <= 0) {
      // Target is already dead, no need to apply more damage or trigger another death event.
      console.debug(`[HealthSystem] Damage ignored: Target '${targetName}' (ID: ${targetId}) already has 0 or less health (${healthBefore}). Source: ${sourceEntityId || 'Unknown'}`);
      return;
    }

    // --- Apply Damage & Clamp Health ---
    // TODO: Future: Apply resistances/vulnerabilities from gameDataRepository/components here
    const actualDamage = amount; // In future, calculate based on resistances etc.
    const newHealth = healthBefore - actualDamage;
    const clampedNewHealth = Math.max(0, newHealth);
    const actualDamageApplied = healthBefore - clampedNewHealth; // How much health was actually lost

    healthComponent.current = clampedNewHealth;
    console.log(`[HealthSystem] Applied ${actualDamageApplied} damage to '${targetName}' (ID: ${targetId}). Health: ${healthBefore} -> ${clampedNewHealth}. Source: ${sourceEntityId || 'Unknown'}`);


    // --- Check for Death (Transition) ---
    if (clampedNewHealth <= 0 /*&& healthBefore > 0 */) { // The healthBefore > 0 check is implicitly handled by the earlier "Already Dead" check
      console.log(`[HealthSystem] Target '${targetName}' (ID: ${targetId}) died as a result of damage from Source: ${sourceEntityId || 'Unknown'}.`);

      // --- 7a. Fire Death Event ---
      /** @type EntityDiedEventPayload */
      const deathPayload = {
        deceasedEntityId: targetId,
        killerEntityId: sourceEntityId // Can be null/undefined if damage source wasn't an entity (e.g., poison)
      };
      this.#eventBus.dispatch('event:entity_died', deathPayload);

      // --- 7b. Dispatch UI Death Message ---
      // Consider if killer name is needed/available
      // const killerEntity = sourceEntityId ? this.#entityManager.getEntityInstance(sourceEntityId) : null;
      // const killerName = killerEntity ? getDisplayName(killerEntity) : 'Something';
      const deathMessage = `The ${targetName} collapses, defeated!`; // Simple message
      this.#eventBus.dispatch('event:display_message', {text: deathMessage, type: 'combat_critical'}); // Critical event type

      // TODO: Future: Other systems listen to "event:entity_died" for XP, loot, quests etc.
    }
    // No specific UI message for *just* taking damage here, as CombatSystem handles the "hit" message.
    // We could add one if needed (e.g., "The Goblin takes 5 damage.") but it might be redundant.
  }


  /**
     * Cleans up subscriptions when the system is shut down.
     */
  shutdown() {
    this.#eventBus.unsubscribe('event:apply_heal_requested', this._handleApplyHealRequested);
    this.#eventBus.unsubscribe('event:inflict_damage_requested', this._handleInflictDamageRequested);
    console.log('HealthSystem: Unsubscribed from events.');
  }
}

export default HealthSystem;