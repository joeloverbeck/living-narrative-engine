/**
 * @file Integration test utilities for setting up common test scenarios
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Set up integration test utilities
 * 
 * @param {object} testBed - The test bed instance
 * @returns {object} Utility functions for the test
 */
export function setupIntegrationTestUtilities(testBed) {
  const { entityManager, eventDispatcher, logger } = testBed;

  return {
    /**
     * Create an entity with equipment components
     * 
     * @param {object} options - Entity creation options
     * @param {object} [options.equipment] - Equipment configuration
     * @param {Array<string>} [options.inventory] - Initial inventory items
     * @param {string} [options.position] - Entity position/location
     * @returns {object} Created entity
     */
    createEntityWithEquipment(options = {}) {
      const entityId = options.id || uuidv4();
      
      // Build components
      const components = {
        'core:actor': { name: options.name || 'Test Actor' }
      };

      // Add equipment component if provided
      if (options.equipment) {
        components['clothing:equipment'] = {
          equipped: options.equipment
        };
      }

      // Add inventory component if provided
      if (options.inventory) {
        components['core:inventory'] = {
          items: options.inventory
        };
      }

      // Add position component if provided
      if (options.position) {
        components['core:position'] = {
          locationId: options.position
        };
      }

      // Create entity
      const entity = {
        id: entityId,
        components,
        getComponentData: (componentId) => components[componentId] || null,
        hasComponent: (componentId) => !!components[componentId],
      };

      // Register with entity manager
      entityManager.entities.set(entityId, entity);

      // Set component data
      Object.entries(components).forEach(([componentId, data]) => {
        entityManager.setComponentData(entityId, componentId, data);
      });

      return entity;
    },

    /**
     * Create a clothing item entity
     * 
     * @param {object} options - Item creation options
     * @param {string} options.id - Item ID
     * @param {string} [options.name] - Item name
     * @param {string} [options.layer] - Clothing layer
     * @param {string} [options.slot] - Clothing slot
     * @returns {object} Created item entity
     */
    createClothingItem(options = {}) {
      const itemId = options.id || uuidv4();
      
      // Build components
      const components = {
        'core:item': {
          name: options.name || 'Test Clothing',
          type: 'clothing'
        }
      };

      // Add wearable component
      if (options.layer || options.slot) {
        components['clothing:wearable'] = {
          slotId: options.slot || 'torso_upper',
          layer: options.layer || 'base',
          isWearable: true
        };
      }

      // Create item entity
      const item = {
        id: itemId,
        components,
        getComponentData: (componentId) => components[componentId] || null,
        hasComponent: (componentId) => !!components[componentId],
      };

      // Register with entity manager
      entityManager.entities.set(itemId, item);

      // Set component data
      Object.entries(components).forEach(([componentId, data]) => {
        entityManager.setComponentData(itemId, componentId, data);
      });

      return item;
    },

    /**
     * Create multiple entities at once
     * 
     * @param {Array<object>} entityConfigs - Array of entity configurations
     * @returns {Array<object>} Created entities
     */
    createEntities(entityConfigs) {
      return entityConfigs.map(config => {
        if (config.type === 'clothing') {
          return this.createClothingItem(config);
        }
        return this.createEntityWithEquipment(config);
      });
    },

    /**
     * Clean up created entities
     * 
     * @param {Array<string>} entityIds - IDs of entities to clean up
     */
    cleanupEntities(entityIds) {
      entityIds.forEach(id => {
        entityManager.entities.delete(id);
      });
    },

    /**
     * Subscribe to events and collect them
     * 
     * @param {string} eventType - Event type to subscribe to
     * @returns {object} Object with events array and unsubscribe function
     */
    subscribeToEvent(eventType) {
      const events = [];
      const unsubscribe = eventDispatcher.subscribe(eventType, (event) => {
        events.push(event);
      });

      return {
        events,
        unsubscribe
      };
    },

    /**
     * Wait for a specific event to be dispatched
     * 
     * @param {string} eventType - Event type to wait for
     * @param {number} [timeout] - Timeout in milliseconds
     * @returns {Promise<object>} The dispatched event
     */
    waitForEvent(eventType, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);

        const unsubscribe = eventDispatcher.subscribe(eventType, (event) => {
          clearTimeout(timer);
          unsubscribe();
          resolve(event);
        });
      });
    }
  };
}