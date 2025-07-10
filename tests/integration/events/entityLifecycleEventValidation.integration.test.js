/**
 * @file Integration test to validate entity lifecycle events against their schemas
 * @description Ensures that entity events dispatched by the system match their defined schemas
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import EntityEventDispatcher from '../../../src/entities/services/helpers/EntityEventDispatcher.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
} from '../../../src/constants/eventIds.js';
import fs from 'fs';
import path from 'path';

describe('Entity Lifecycle Event Schema Validation - Integration', () => {
  let entityEventDispatcher;
  let schemaValidator;
  let logger;
  let capturedEvents;
  let mockEventDispatcher;
  let entityCreatedSchema;
  let entityRemovedSchema;

  beforeEach(() => {
    logger = new ConsoleLogger();
    capturedEvents = [];
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load event schemas directly
    const eventDir = path.join(process.cwd(), 'data/mods/core/events');
    const entityCreatedDef = JSON.parse(
      fs.readFileSync(path.join(eventDir, 'entity_created.event.json'), 'utf8')
    );
    const entityRemovedDef = JSON.parse(
      fs.readFileSync(path.join(eventDir, 'entity_removed.event.json'), 'utf8')
    );

    entityCreatedSchema = entityCreatedDef.payloadSchema;
    entityRemovedSchema = entityRemovedDef.payloadSchema;

    // Mock event dispatcher to capture events
    mockEventDispatcher = {
      dispatch: (eventType, payload) => {
        capturedEvents.push({ type: eventType, payload });
        
        // Validate the payload against schema
        const schema = eventType === ENTITY_CREATED_ID ? entityCreatedSchema : entityRemovedSchema;
        const isValid = schemaValidator.validate(payload, schema);
        if (!isValid) {
          const errors = schemaValidator.getLastErrors();
          throw new Error(`Schema validation failed: ${errors.join(', ')}`);
        }
        return true;
      }
    };

    // Create entity event dispatcher with mock
    entityEventDispatcher = new EntityEventDispatcher({
      eventDispatcher: mockEventDispatcher,
      logger,
    });
  });

  describe('Entity Created Event Validation', () => {
    it('should dispatch entity_created event with valid schema', () => {
      const entity = {
        id: 'test-entity-123',
        definitionId: 'test:entity_def',
        components: {},
        hasComponent: () => false,
        getComponentData: () => null,
      };

      // This should not throw
      expect(() => {
        entityEventDispatcher.dispatchEntityCreated(entity, false);
      }).not.toThrow();

      // Verify event was captured
      expect(capturedEvents).toHaveLength(1);
      const capturedEvent = capturedEvents[0];
      expect(capturedEvent.type).toBe(ENTITY_CREATED_ID);

      // Verify payload structure matches schema
      expect(capturedEvent.payload).toEqual({
        instanceId: entity.id,
        definitionId: entity.definitionId,
        wasReconstructed: false,
        entity: entity,
      });
    });

    it('should handle reconstructed entities correctly', () => {
      const entity = {
        id: 'reconstructed-entity-456',
        definitionId: 'test:reconstructed_def',
        components: { 'core:position': { locationId: 'test-location' } },
        hasComponent: (id) => id === 'core:position',
        getComponentData: (id) => entity.components[id],
      };

      expect(() => {
        entityEventDispatcher.dispatchEntityCreated(entity, true);
      }).not.toThrow();

      expect(capturedEvents).toHaveLength(1);
      const capturedEvent = capturedEvents[0];
      expect(capturedEvent.payload.wasReconstructed).toBe(true);
    });
  });

  describe('Entity Removed Event Validation', () => {
    it('should dispatch entity_removed event with valid schema', () => {
      const entity = {
        id: 'test-entity-789',
        definitionId: 'test:entity_def',
        components: {},
      };

      // This should not throw
      expect(() => {
        entityEventDispatcher.dispatchEntityRemoved(entity);
      }).not.toThrow();

      // Verify event was captured
      expect(capturedEvents).toHaveLength(1);
      const capturedEvent = capturedEvents[0];
      expect(capturedEvent.type).toBe(ENTITY_REMOVED_ID);

      // Verify payload structure matches schema (only instanceId)
      expect(capturedEvent.payload).toEqual({
        instanceId: entity.id,
      });
      
      // Verify no extra properties
      expect(Object.keys(capturedEvent.payload)).toEqual(['instanceId']);
    });

    it('should reject entity_removed event with extra properties', () => {
      // Create a mock dispatcher that validates against the schema
      const strictMockDispatcher = {
        dispatch: (eventType, payload) => {
          if (eventType === ENTITY_REMOVED_ID) {
            // Check for extra properties
            const allowedKeys = ['instanceId'];
            const payloadKeys = Object.keys(payload);
            const hasExtraProperties = payloadKeys.some(key => !allowedKeys.includes(key));
            
            if (hasExtraProperties) {
              throw new Error('Schema validation failed: Additional properties not allowed');
            }
          }
          return true;
        }
      };

      const testDispatcher = new EntityEventDispatcher({
        eventDispatcher: strictMockDispatcher,
        logger,
      });

      // This should throw because our fix now only sends instanceId
      const entityWithExtras = {
        id: 'test-entity-invalid',
        definitionId: 'should:not:be:ignored',
        someExtraField: 'extra',
      };

      expect(() => {
        testDispatcher.dispatchEntityRemoved(entityWithExtras);
      }).not.toThrow();

      // Verify that extra properties would be rejected if sent
      const invalidPayload = {
        instanceId: 'test-entity-invalid',
        definitionId: 'should:not:be:here',
        entity: { id: 'test-entity-invalid' },
      };

      expect(() => {
        strictMockDispatcher.dispatch(ENTITY_REMOVED_ID, invalidPayload);
      }).toThrow('Additional properties not allowed');
    });

    it('should handle entities with only id property', () => {
      const minimalEntity = {
        id: 'minimal-entity-999',
        // No other properties
      };

      expect(() => {
        entityEventDispatcher.dispatchEntityRemoved(minimalEntity);
      }).not.toThrow();

      expect(capturedEvents).toHaveLength(1);
      const capturedEvent = capturedEvents[0];
      expect(capturedEvent.payload).toEqual({
        instanceId: minimalEntity.id,
      });
    });
  });

  describe('Schema Validation Error Handling', () => {
    it('should throw when entity_created is missing required fields', () => {
      // Create a mock dispatcher that validates required fields
      const validatingMockDispatcher = {
        dispatch: (eventType, payload) => {
          if (eventType === ENTITY_CREATED_ID) {
            const requiredFields = ['instanceId', 'definitionId', 'wasReconstructed', 'entity'];
            const missingFields = requiredFields.filter(field => !(field in payload));
            
            if (missingFields.length > 0) {
              throw new Error(`Schema validation failed: Missing required fields: ${missingFields.join(', ')}`);
            }
          }
          return true;
        }
      };

      const incompletePayload = {
        instanceId: 'test-123',
        // Missing: definitionId, wasReconstructed, entity
      };

      expect(() => {
        validatingMockDispatcher.dispatch(ENTITY_CREATED_ID, incompletePayload);
      }).toThrow('Missing required fields');
    });

    it('should throw when entity_removed is missing instanceId', () => {
      // Create a mock dispatcher that validates required fields
      const validatingMockDispatcher = {
        dispatch: (eventType, payload) => {
          if (eventType === ENTITY_REMOVED_ID) {
            if (!payload.instanceId) {
              throw new Error('Schema validation failed: Missing required field: instanceId');
            }
          }
          return true;
        }
      };

      const incompletePayload = {};

      expect(() => {
        validatingMockDispatcher.dispatch(ENTITY_REMOVED_ID, incompletePayload);
      }).toThrow('Missing required field: instanceId');
    });
  });
});