// src/systems/equipmentSystem.js

import {StatsComponent} from '../components/statsComponent.js';

/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../../eventBus.js').default} EventBus */

/**
 * Handles applying and removing effects from equipped items.
 * Listens for 'event:item_equipped' and 'event:item_unequipped'.
 */
class EquipmentSystem {
    /**
     * @param {{eventBus: EventBus, entityManager: EntityManager, dataManager: DataManager}} options
     */
    constructor({eventBus, entityManager, dataManager}) {
        if (!eventBus || !entityManager || !dataManager) {
            throw new Error("EquipmentSystem requires eventBus, entityManager, and dataManager.");
        }
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.dataManager = dataManager;
        console.log("EquipmentSystem initialized.");
    }

    /**
     * Subscribes to relevant events. Call this after instantiation.
     */
    initialize() {
        this.eventBus.subscribe('event:item_equipped', this.handleItemEquipped.bind(this));
        this.eventBus.subscribe('event:item_unequipped', this.handleItemUnequipped.bind(this));
        console.log("EquipmentSystem subscribed to events.");
    }

    /**
     * @param {{entity: import('../entities/entity.js').default, itemId: string, slotId: string}} eventData
     */
    handleItemEquipped(eventData) {
        const {entity, itemId} = eventData;
        if (!entity || !itemId) {
            console.warn("EquipmentSystem: Invalid eventData received for item_equipped:", eventData);
            return;
        }

        const itemDefinition = this.dataManager.getEntityDefinition(itemId);
        if (!itemDefinition || !itemDefinition.components || !itemDefinition.components.Item) {
            console.warn(`EquipmentSystem: Could not find valid item definition for equipped item '${itemId}'.`);
            return;
        }

        const itemCompData = itemDefinition.components.Item;
        const effects = itemCompData.equipEffects;

        if (Array.isArray(effects) && effects.length > 0) {
            const statsComp = entity.getComponent(StatsComponent);
            if (statsComp) {
                const modsToAdd = [];
                for (const effect of effects) {
                    if (effect.type === 'stat_mod' && effect.stat && typeof effect.value === 'number') {
                        modsToAdd.push({stat: effect.stat, value: effect.value});
                    } else {
                        console.warn(`EquipmentSystem: Unsupported or invalid equip effect on item '${itemId}':`, effect);
                    }
                }
                if (modsToAdd.length > 0) {
                    statsComp.addModifier(itemId, modsToAdd); // Use itemId as the sourceId
                    console.log(`EquipmentSystem: Applied ${modsToAdd.length} stat modifier(s) from item '${itemId}' to entity '${entity.id}'.`);
                    // Optionally dispatch stat change events here if StatsComponent doesn't
                    this.eventBus.dispatch('ui:message_display', {text: `(${itemId} effects applied)`, type: 'debug'}); // Debug message
                }
            } else {
                console.warn(`EquipmentSystem: Entity '${entity.id}' equipped item '${itemId}' with effects, but has no StatsComponent.`);
            }
        }
    }

    /**
     * @param {{entity: import('../entities/entity.js').default, itemId: string, slotId: string}} eventData
     */
    handleItemUnequipped(eventData) {
        const {entity, itemId} = eventData;
        if (!entity || !itemId) {
            console.warn("EquipmentSystem: Invalid eventData received for item_unequipped:", eventData);
            return;
        }

        const statsComp = entity.getComponent(StatsComponent);
        if (statsComp) {
            const removed = statsComp.removeModifier(itemId); // Use itemId as the sourceId
            if (removed) {
                console.log(`EquipmentSystem: Removed stat modifier(s) from item '${itemId}' for entity '${entity.id}'.`);
                // Optionally dispatch stat change events here if StatsComponent doesn't
                this.eventBus.dispatch('ui:message_display', {text: `(${itemId} effects removed)`, type: 'debug'}); // Debug message
            }
        }
        // No warning if entity has no statsComp, as maybe the item didn't modify stats anyway
    }
}

export default EquipmentSystem;