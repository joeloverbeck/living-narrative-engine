import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Items Mod - Aiming Event Schemas', () => {
  describe('item_aimed event schema', () => {
    let eventSchema;

    beforeAll(() => {
      const schemaPath = join(
        process.cwd(),
        'data/mods/items/events/item_aimed.event.json'
      );
      eventSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    });

    it('should have correct event ID', () => {
      expect(eventSchema.id).toBe('items:item_aimed');
    });

    it('should have proper schema reference', () => {
      expect(eventSchema.$schema).toBe(
        'schema://living-narrative-engine/event.schema.json'
      );
    });

    it('should have description', () => {
      expect(eventSchema.description).toBeDefined();
      expect(eventSchema.description.length).toBeGreaterThan(0);
    });

    it('should require actorEntity, itemEntity, targetEntity, and timestamp', () => {
      expect(eventSchema.payloadSchema.required).toEqual([
        'actorEntity',
        'itemEntity',
        'targetEntity',
        'timestamp'
      ]);
    });

    it('should define all required properties', () => {
      const properties = eventSchema.payloadSchema.properties;
      expect(properties.actorEntity).toBeDefined();
      expect(properties.itemEntity).toBeDefined();
      expect(properties.targetEntity).toBeDefined();
      expect(properties.timestamp).toBeDefined();
    });

    it('should use string type for entity fields with minLength', () => {
      const properties = eventSchema.payloadSchema.properties;
      expect(properties.actorEntity.type).toBe('string');
      expect(properties.actorEntity.minLength).toBe(1);
      expect(properties.itemEntity.type).toBe('string');
      expect(properties.itemEntity.minLength).toBe(1);
      expect(properties.targetEntity.type).toBe('string');
      expect(properties.targetEntity.minLength).toBe(1);
    });

    it('should use number type for timestamp', () => {
      expect(eventSchema.payloadSchema.properties.timestamp.type).toBe('number');
    });

    it('should disallow additional properties', () => {
      expect(eventSchema.payloadSchema.additionalProperties).toBe(false);
    });
  });

  describe('aim_lowered event schema', () => {
    let eventSchema;

    beforeAll(() => {
      const schemaPath = join(
        process.cwd(),
        'data/mods/items/events/aim_lowered.event.json'
      );
      eventSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    });

    it('should have correct event ID', () => {
      expect(eventSchema.id).toBe('items:aim_lowered');
    });

    it('should have proper schema reference', () => {
      expect(eventSchema.$schema).toBe(
        'schema://living-narrative-engine/event.schema.json'
      );
    });

    it('should have description', () => {
      expect(eventSchema.description).toBeDefined();
      expect(eventSchema.description.length).toBeGreaterThan(0);
    });

    it('should require only actorEntity, itemEntity, and timestamp (previousTargetEntity is optional)', () => {
      expect(eventSchema.payloadSchema.required).toEqual([
        'actorEntity',
        'itemEntity',
        'timestamp'
      ]);
    });

    it('should define all properties including optional previousTargetEntity', () => {
      const properties = eventSchema.payloadSchema.properties;
      expect(properties.actorEntity).toBeDefined();
      expect(properties.itemEntity).toBeDefined();
      expect(properties.previousTargetEntity).toBeDefined();
      expect(properties.timestamp).toBeDefined();
    });

    it('should use string type for entity fields with minLength', () => {
      const properties = eventSchema.payloadSchema.properties;
      expect(properties.actorEntity.type).toBe('string');
      expect(properties.actorEntity.minLength).toBe(1);
      expect(properties.itemEntity.type).toBe('string');
      expect(properties.itemEntity.minLength).toBe(1);
      expect(properties.previousTargetEntity.type).toBe('string');
      expect(properties.previousTargetEntity.minLength).toBe(1);
    });

    it('should use number type for timestamp', () => {
      expect(eventSchema.payloadSchema.properties.timestamp.type).toBe('number');
    });

    it('should disallow additional properties', () => {
      expect(eventSchema.payloadSchema.additionalProperties).toBe(false);
    });

    it('should NOT require previousTargetEntity (optional field)', () => {
      expect(eventSchema.payloadSchema.required).not.toContain(
        'previousTargetEntity'
      );
    });
  });
});
