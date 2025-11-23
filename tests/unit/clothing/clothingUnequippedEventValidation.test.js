/**
 * @file Tests for clothing:unequipped event payload validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

describe('clothing:unequipped Event Validation', () => {
  let schemaValidator;
  let eventDispatcher;
  let mockLogger;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load event schema and dependencies
    const fs = await import('fs');
    const path = await import('path');

    // Load dependencies first
    const commonSchema = JSON.parse(
      fs.readFileSync(path.resolve('data/schemas/common.schema.json'), 'utf8')
    );
    await schemaValidator.addSchema(commonSchema, commonSchema.$id);

    // Load base event schema
    const baseEventSchema = JSON.parse(
      fs.readFileSync(path.resolve('data/schemas/event.schema.json'), 'utf8')
    );
    await schemaValidator.addSchema(baseEventSchema, baseEventSchema.$id);

    const eventSchema = JSON.parse(
      fs.readFileSync(
        path.resolve(
          'data/mods/clothing/events/clothing_unequipped.event.json'
        ),
        'utf8'
      )
    );

    // Create a clean schema object for AJV - remove 'id' and add '$id'
    const { id, ...cleanEventSchema } = eventSchema;
    cleanEventSchema.$id = id;
    await schemaValidator.addSchema(cleanEventSchema, id);

    // Register the payload schema separately for validation
    // ValidatedEventDispatcher expects schema ID pattern: ${eventName}#payload
    await schemaValidator.addSchema(
      eventSchema.payloadSchema,
      'clothing:unequipped#payload'
    );

    // Create a basic event dispatcher
    const basicEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    // Create mock gameDataRepository
    const mockGameDataRepository = {
      getEventDefinition: jest.fn().mockReturnValue(eventSchema),
      getEventDefinitions: jest.fn().mockReturnValue([eventSchema]),
    };

    // Create validated event dispatcher
    eventDispatcher = new ValidatedEventDispatcher({
      eventBus: basicEventDispatcher,
      gameDataRepository: mockGameDataRepository,
      schemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid payloads', () => {
    it('should accept valid payload with reason "manual"', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual',
        cascadeCount: 0,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should accept valid payload with reason "conflict_resolution"', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'outer',
        reason: 'conflict_resolution',
        cascadeCount: 2,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should accept valid payload with reason "forced"', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'jacket_001',
        slotId: 'torso_upper',
        layer: 'outer',
        reason: 'forced',
        cascadeCount: 1,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should accept valid payload with reason "layer_requirement"', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'layer_requirement',
        cascadeCount: 0,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should accept valid payload with all valid layer types', async () => {
      const layers = ['underwear', 'base', 'outer', 'accessories', 'armor'];

      for (const layer of layers) {
        const payload = {
          entityId: 'player_1',
          clothingItemId: 'item_001',
          slotId: 'torso_upper',
          layer,
          reason: 'manual',
          cascadeCount: 0,
          timestamp: Date.now(),
        };

        const result = await eventDispatcher.dispatch(
          'clothing:unequipped',
          payload
        );
        expect(result).toBe(true);
      }
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Invalid payloads', () => {
    it('should reject payload with invalid reason "manual_action"', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual_action', // Invalid - should be 'manual'
        cascadeCount: 0,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });

    it('should reject payload with invalid layer', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'invalid_layer',
        reason: 'manual',
        cascadeCount: 0,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });

    it('should reject payload with missing required fields', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        // Missing slotId, layer, reason, timestamp
        cascadeCount: 0,
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });

    it('should reject payload with negative cascadeCount', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual',
        cascadeCount: -1, // Invalid - must be >= 0
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });

    it('should reject payload with additional properties', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual',
        cascadeCount: 0,
        timestamp: Date.now(),
        extraProperty: 'not allowed', // Additional property not allowed
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle cascadeCount of 0', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual',
        cascadeCount: 0,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle large cascadeCount', async () => {
      const payload = {
        entityId: 'player_1',
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual',
        cascadeCount: 999,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle empty string values appropriately', async () => {
      const payload = {
        entityId: '', // Empty string should be invalid
        clothingItemId: 'shirt_001',
        slotId: 'torso_upper',
        layer: 'base',
        reason: 'manual',
        cascadeCount: 0,
        timestamp: Date.now(),
      };

      const result = await eventDispatcher.dispatch(
        'clothing:unequipped',
        payload
      );
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });
  });
});
