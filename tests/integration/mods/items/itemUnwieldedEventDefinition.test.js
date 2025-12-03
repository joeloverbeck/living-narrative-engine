/**
 * @file Integration tests for missing items:item_unwielded event definition fix
 * Verifies that the item_unwielded event definition exists and is properly
 * configured to match the UnwieldItemHandler dispatch payload.
 * @see src/logic/operationHandlers/unwieldItemHandler.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Missing Event Definition Fix - items:item_unwielded', () => {
  const EVENTS_DIR = 'data/mods/items/events';
  const EVENT_SCHEMA_PATH = 'data/schemas/event.schema.json';

  let schemaValidator;
  let mockLogger;
  let eventSchema;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load the event schema for validation
    eventSchema = JSON.parse(
      fs.readFileSync(path.resolve(EVENT_SCHEMA_PATH), 'utf8')
    );

    if (!schemaValidator.isSchemaLoaded(eventSchema.$id || EVENT_SCHEMA_PATH)) {
      await schemaValidator.addSchema(eventSchema, eventSchema.$id || EVENT_SCHEMA_PATH);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Definition File Existence', () => {
    it('should have item_unwielded.event.json file in items events', () => {
      const filePath = path.resolve(EVENTS_DIR, 'item_unwielded.event.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Event Definition File Structure', () => {
    it('item_unwielded.event.json should have valid JSON structure', () => {
      const filePath = path.resolve(EVENTS_DIR, 'item_unwielded.event.json');
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed;
      expect(() => {
        parsed = JSON.parse(content);
      }).not.toThrow();

      // Verify required fields per event.schema.json
      expect(parsed.id).toBe('items:item_unwielded');
      expect(parsed.description).toBeDefined();
      expect(parsed.payloadSchema).toBeDefined();
      expect(parsed.payloadSchema.type).toBe('object');
      expect(parsed.payloadSchema.properties).toBeDefined();
      expect(parsed.payloadSchema.required).toBeDefined();
    });
  });

  describe('items:item_unwielded Payload Schema Validation', () => {
    let itemUnwieldedEvent;

    beforeEach(() => {
      const filePath = path.resolve(EVENTS_DIR, 'item_unwielded.event.json');
      itemUnwieldedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    it('should accept valid item_unwielded payload with empty remaining items', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const validPayload = {
        actorEntity: 'actor-001',
        itemEntity: 'item-001',
        remainingWieldedItems: [],
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept valid item_unwielded payload with remaining wielded items', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const validPayload = {
        actorEntity: 'actor-001',
        itemEntity: 'sword-001',
        remainingWieldedItems: ['shield-001', 'dagger-002'],
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should reject item_unwielded payload missing required actorEntity', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const invalidPayload = {
        // missing actorEntity
        itemEntity: 'item-001',
        remainingWieldedItems: [],
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'actorEntity')
      ).toBe(true);
    });

    it('should reject item_unwielded payload missing required itemEntity', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const invalidPayload = {
        actorEntity: 'actor-001',
        // missing itemEntity
        remainingWieldedItems: [],
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'itemEntity')
      ).toBe(true);
    });

    it('should reject item_unwielded payload missing required remainingWieldedItems', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const invalidPayload = {
        actorEntity: 'actor-001',
        itemEntity: 'item-001',
        // missing remainingWieldedItems
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'remainingWieldedItems')
      ).toBe(true);
    });

    it('should reject item_unwielded payload with remainingWieldedItems as string instead of array', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const invalidPayload = {
        actorEntity: 'actor-001',
        itemEntity: 'item-001',
        remainingWieldedItems: 'not-an-array',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject item_unwielded payload with additional properties', async () => {
      const payloadSchemaId = `${itemUnwieldedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(itemUnwieldedEvent.payloadSchema, payloadSchemaId);

      const invalidPayload = {
        actorEntity: 'actor-001',
        itemEntity: 'item-001',
        remainingWieldedItems: [],
        unknownField: 'should not be allowed',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Event Definition Consistency with Production Code', () => {
    it('item_unwielded event schema should match unwieldItemHandler dispatch payload', () => {
      const filePath = path.resolve(EVENTS_DIR, 'item_unwielded.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const props = eventDef.payloadSchema.properties;
      const required = eventDef.payloadSchema.required;

      // Verify all fields dispatched by unwieldItemHandler.js:188-192 are defined
      expect(props.actorEntity).toBeDefined();
      expect(props.itemEntity).toBeDefined();
      expect(props.remainingWieldedItems).toBeDefined();

      // Verify field types match handler dispatch
      expect(props.actorEntity.type).toBe('string');
      expect(props.itemEntity.type).toBe('string');
      expect(props.remainingWieldedItems.type).toBe('array');
      expect(props.remainingWieldedItems.items.type).toBe('string');

      // Verify all required fields are marked as required
      expect(required).toContain('actorEntity');
      expect(required).toContain('itemEntity');
      expect(required).toContain('remainingWieldedItems');
    });

    it('item_unwielded event id should use correct namespace', () => {
      const filePath = path.resolve(EVENTS_DIR, 'item_unwielded.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Must match ITEM_UNWIELDED_EVENT constant from unwieldItemHandler.js:27
      expect(eventDef.id).toBe('items:item_unwielded');
    });
  });

  describe('Mod Manifest Registration', () => {
    it('should have item_unwielded.event.json registered in mod-manifest.json', () => {
      const manifestPath = path.resolve('data/mods/items/mod-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(manifest.content.events).toContain('item_unwielded.event.json');
    });
  });
});
