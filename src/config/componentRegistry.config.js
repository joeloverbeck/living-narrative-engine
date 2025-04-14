// src/config/componentRegistry.config.js

// Import ALL component classes referenced previously in main.js
import {AttackComponent} from '../components/attackComponent.js';
import {ConnectionsComponent} from '../components/connectionsComponent.js';
import {DescriptionComponent} from '../components/descriptionComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {EquippableComponent} from '../components/equippableComponent.js';
import {HealthComponent} from '../components/healthComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
import {MetaDescriptionComponent} from '../components/metaDescriptionComponent.js';
import {NameComponent} from '../components/nameComponent.js';
import {PositionComponent} from '../components/positionComponent.js';
import {SkillComponent} from '../components/skillComponent.js';
import {StatsComponent} from '../components/statsComponent.js';
import {UsableComponent} from '../components/usableComponent.js';
import {QuestLogComponent} from "../components/questLogComponent.js";
import BreakableComponent from "../components/breakableComponent.js";
import OpenableComponent from "../components/openableComponent.js";
import {PassageDetailsComponent} from "../components/passageDetailsComponent.js";
import LockableComponent from "../components/lockableComponent.js";

/**
 * Configuration mapping for component registration.
 * Maps the string keys used in entity JSON definitions to the
 * corresponding imported component class constructors.
 * Consumed during initialization to populate the EntityManager registry.
 * @type {Map<string, Function>}
 */
export const componentRegistryConfig = new Map([
    // Key (string from JSON) -> Value (Imported Class Constructor)
    ['Attack', AttackComponent],
    ['Breakable', BreakableComponent],
    ['Connections', ConnectionsComponent],
    ['Description', DescriptionComponent],
    ['Equipment', EquipmentComponent],
    ['Equippable', EquippableComponent],
    ['Health', HealthComponent],
    ['Inventory', InventoryComponent],
    ['Item', ItemComponent],
    ['Lockable', LockableComponent],
    ['MetaDescription', MetaDescriptionComponent],
    ['Name', NameComponent],
    ['Openable', OpenableComponent],
    ['PassageDetails', PassageDetailsComponent],
    ['Position', PositionComponent],
    ['QuestLog', QuestLogComponent],
    ['Skill', SkillComponent],
    ['Stats', StatsComponent],
    ['Usable', UsableComponent],
    // Add any future components here (alphabetical order is nice but not required)
]);

// Usage:
// import { componentRegistryConfig } from './config/componentRegistry.config.js';
//
// // In initialization code:
// const entityManager = new EntityManager(...);
// for (const [jsonKey, componentClass] of componentRegistryConfig.entries()) {
//     entityManager.registerComponent(jsonKey, componentClass);
// }