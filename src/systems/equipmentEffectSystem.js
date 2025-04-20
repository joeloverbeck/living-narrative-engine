// src/systems/equipmentEffectSystem.js

import {StatsComponent} from '../components/statsComponent.js';
import {getDisplayName} from "../utils/messages.js";

/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/eventBus.js').default} EventBus */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles applying and removing the effects (e.g., stat modifiers) associated
 * with equipped items. Listens for "event:item_equipped" and "event:item_unequipped".
 */
class EquipmentEffectSystem {
    #eventBus;
    #entityManager;
    #repository; // Renamed from gameDataRepository

    constructor({eventBus, entityManager, gameDataRepository}) { // Updated param name
        if (!eventBus || !entityManager || !gameDataRepository) { // Updated check
            throw new Error("EquipmentEffectSystem requires eventBus, entityManager, and gameDataRepository."); // Updated error
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#repository = gameDataRepository; // Updated assignment
        console.log("EquipmentEffectSystem initialized.");
    }

    /**
     * Subscribes to relevant events. Call this after instantiation.
     */
    initialize() {
        this.#eventBus.subscribe("event:item_equipped", this.handleItemEquipped.bind(this));
        this.#eventBus.subscribe("event:item_unequipped", this.handleItemUnequipped.bind(this));
        console.log("EquipmentEffectSystem subscribed to events: item_equipped, item_unequipped.");
    }

    /**
     * Applies effects when an item is successfully equipped.
     * @param {{entity: Entity, itemId: string, slotId: string, itemInstance?: Entity}} eventData
     */
    handleItemEquipped(eventData) {
        const {entity, itemId} = eventData;
        if (!entity || !itemId) {
            console.warn("EquipmentEffectSystem (Equipped): Invalid eventData received:", eventData);
            return;
        }
        const itemDefinition = this.#repository.getEntityDefinition(itemId);
        if (!itemDefinition || !itemDefinition.components || !itemDefinition.components.Equippable) {
            if (!itemDefinition) {
                console.warn(`EquipmentEffectSystem (Equipped): Could not find item definition for '${itemId}'.`);
            }
            return; // No effects to apply
        }
        const equippableCompData = itemDefinition.components.Equippable;
        const effects = equippableCompData.equipEffects;

        if (Array.isArray(effects) && effects.length > 0) {
            const statsComp = entity.getComponent(StatsComponent);
            if (statsComp) {
                const modsToAdd = [];
                for (const effect of effects) {
                    if (effect.type === 'stat_mod' && effect.stat && typeof effect.value === 'number') {
                        modsToAdd.push({stat: effect.stat, value: effect.value});
                    } else {
                        console.warn(`EquipmentEffectSystem (Equipped): Unsupported/invalid effect on item '${itemId}':`, effect);
                    }
                }
                if (modsToAdd.length > 0) {
                    statsComp.addModifier(itemId, modsToAdd); // Use itemId as sourceId
                    console.log(`EquipmentEffectSystem (Equipped): Applied ${modsToAdd.length} stat modifier(s) from '${itemId}' to entity '${entity.id}'.`);
                }
            } else {
                console.warn(`EquipmentEffectSystem (Equipped): Entity '${entity.id}' equipped item '${itemId}' with effects, but has no StatsComponent.`);
            }
        }
    }

    /**
     * Removes effects when an item is unequipped.
     * @param {{entity: Entity, itemId: string, slotId: string, itemInstance?: Entity}} eventData
     */
    handleItemUnequipped(eventData) {
        const {entity, itemId} = eventData;
        if (!entity || !itemId) {
            console.warn("EquipmentEffectSystem (Unequipped): Invalid eventData received:", eventData);
            return;
        }

        const statsComp = entity.getComponent(StatsComponent);
        if (statsComp) {
            const removed = statsComp.removeModifier(itemId); // Use itemId as sourceId
            if (removed) {
                // Attempt to get display name for logging, fallback to ID
                const itemInstance = eventData.itemInstance || this.entityManager.getEntityInstance(itemId);
                const itemDisplayName = itemInstance ? getDisplayName(itemInstance) : itemId;
                console.log(`EquipmentEffectSystem (Unequipped): Removed stat modifier(s) associated with item '${itemDisplayName}' (${itemId}) from entity '${entity.id}'.`);
            }
        }
        // No UI message needed here usually, the main unequip message was sent by EquipmentSystem.
    }
}

export default EquipmentEffectSystem;