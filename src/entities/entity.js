// src/entities/entity.js

/**
 * Represents a game entity (player, NPC, item, etc.).
 * An entity is primarily an identifier associated with a collection of components.
 */
class Entity {
    /**
     * @param {string} id - The unique identifier for this entity instance.
     */
    constructor(id) {
        if (!id) {
            throw new Error("Entity must have an ID.");
        }
        this.id = id;
        /** @type {Map<Function, object>} */
        this.components = new Map(); // Map Component Class -> Component Instance
        console.log(`Entity created: ${this.id}`);
    }

    /**
     * Adds a component instance to this entity.
     * @param {object} componentInstance - An instance of a component class.
     * @throws {Error} If a component of the same type already exists.
     */
    addComponent(componentInstance) {
        const componentClass = componentInstance.constructor;
        if (this.components.has(componentClass)) {
            console.warn(`Entity ${this.id} already has component ${componentClass.name}. Overwriting.`);
            // throw new Error(`Entity ${this.id} already has component ${componentClass.name}`);
        }
        this.components.set(componentClass, componentInstance);
        // console.log(`Added component ${componentClass.name} to entity ${this.id}`);
    }

    /**
     * Retrieves the component instance of a specific class type.
     * @param {Function} ComponentClass - The class constructor of the component to retrieve.
     * @returns {object | undefined} The component instance, or undefined if not found.
     */
    getComponent(ComponentClass) {
        return this.components.get(ComponentClass);
    }

    /**
     * Checks if the entity has a component of a specific class type.
     * @param {Function} ComponentClass - The class constructor of the component to check for.
     * @returns {boolean} True if the entity has the component, false otherwise.
     */
    hasComponent(ComponentClass) {
        return this.components.has(ComponentClass);
    }

    /**
     * Removes a component instance of a specific class type.
     * @param {Function} ComponentClass - The class constructor of the component to remove.
     * @returns {boolean} True if the component was removed, false otherwise.
     */
    removeComponent(ComponentClass) {
        return this.components.delete(ComponentClass);
    }

    toString() {
        const componentNames = Array.from(this.components.keys()).map(cls => cls.name).join(', ');
        return `Entity[${this.id}] Components: ${componentNames || 'None'}`;
    }
}

export default Entity;