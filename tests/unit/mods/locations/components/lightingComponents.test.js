/**
 * @file Unit tests for locations mod lighting component schemas
 * @description Tests schema validation for naturally_dark, light_sources, and
 * description_in_darkness components defined in the locations mod.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('Locations - Lighting Components', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('locations:naturally_dark', () => {
    it('should accept empty object as valid marker', () => {
      const data = {};
      const result = testBed.validateAgainstSchema(
        data,
        'locations:naturally_dark'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject objects with extra properties', () => {
      const data = {
        someProperty: 'value',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:naturally_dark'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject non-object types', () => {
      const result = testBed.validateAgainstSchema(
        'not an object',
        'locations:naturally_dark'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject null value', () => {
      const result = testBed.validateAgainstSchema(
        null,
        'locations:naturally_dark'
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('locations:light_sources', () => {
    it('should accept valid sources array with entity IDs', () => {
      const data = {
        sources: ['lantern-001', 'torch-002', 'campfire-003'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(true);
    });

    it('should accept empty sources array', () => {
      const data = {
        sources: [],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(true);
    });

    it('should require sources property', () => {
      const data = {};
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject non-string items in sources array', () => {
      const data = {
        sources: ['lantern-001', 42, 'torch-002'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject sources as non-array type', () => {
      const data = {
        sources: 'lantern-001',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject additional properties', () => {
      const data = {
        sources: ['lantern-001'],
        extraField: 'not allowed',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(false);
    });

    it('should accept single light source', () => {
      const data = {
        sources: ['single-torch'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:light_sources'
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('locations:description_in_darkness', () => {
    it('should accept valid text description', () => {
      const data = {
        text: 'The sound of dripping water echoes through the pitch-black cavern. A musty smell fills the air.',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:description_in_darkness'
      );
      expect(result.isValid).toBe(true);
    });

    it('should require text property', () => {
      const data = {};
      const result = testBed.validateAgainstSchema(
        data,
        'locations:description_in_darkness'
      );
      expect(result.isValid).toBe(false);
    });

    it('should accept empty string for text', () => {
      const data = {
        text: '',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:description_in_darkness'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject non-string text value', () => {
      const data = {
        text: 123,
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:description_in_darkness'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject additional properties', () => {
      const data = {
        text: 'Darkness surrounds you.',
        mood: 'creepy',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:description_in_darkness'
      );
      expect(result.isValid).toBe(false);
    });

    it('should accept multi-line text descriptions', () => {
      const data = {
        text: 'The darkness is absolute.\nYou can hear distant footsteps.\nThe air feels cold and damp.',
      };
      const result = testBed.validateAgainstSchema(
        data,
        'locations:description_in_darkness'
      );
      expect(result.isValid).toBe(true);
    });
  });
});
