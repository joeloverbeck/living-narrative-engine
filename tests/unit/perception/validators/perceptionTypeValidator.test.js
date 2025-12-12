/**
 * @file Unit tests for perceptionTypeValidator
 * @see src/perception/validators/perceptionTypeValidator.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  validatePerceptionType,
  createInvalidTypeMessage,
  createDeprecationWarning,
  formatValidTypesMessage,
  assertValidPerceptionType,
  validatePerceptionTypes,
} from '../../../../src/perception/validators/perceptionTypeValidator.js';

describe('perceptionTypeValidator', () => {
  describe('validatePerceptionType', () => {
    describe('valid new types', () => {
      it('should validate new dotted format types', () => {
        const result = validatePerceptionType('communication.speech');

        expect(result.isValid).toBe(true);
        expect(result.normalizedType).toBe('communication.speech');
        expect(result.isDeprecated).toBe(false);
        expect(result.errorMessage).toBeNull();
      });

      it('should validate all category types', () => {
        const types = [
          'communication.speech',
          'movement.arrival',
          'combat.attack',
          'item.pickup',
          'container.open',
          'connection.lock',
          'consumption.consume',
          'state.observable_change',
          'social.gesture',
          'physical.self_action',
          'intimacy.sexual',
          'performance.music',
          'magic.spell',
          'error.action_failed',
        ];

        for (const type of types) {
          const result = validatePerceptionType(type);
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('valid legacy types', () => {
      it('should validate and mark legacy types as deprecated', () => {
        const result = validatePerceptionType('speech_local');

        expect(result.isValid).toBe(true);
        expect(result.normalizedType).toBe('communication.speech');
        expect(result.isDeprecated).toBe(true);
        expect(result.suggestion).toBe('communication.speech');
      });

      it('should normalize legacy type to new format', () => {
        const result = validatePerceptionType('entity_died');

        expect(result.isValid).toBe(true);
        expect(result.normalizedType).toBe('combat.death');
      });
    });

    describe('invalid types', () => {
      it('should reject empty string', () => {
        const result = validatePerceptionType('');

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain('empty');
      });

      it('should reject whitespace-only string', () => {
        const result = validatePerceptionType('   ');

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain('empty');
      });

      it('should reject null and undefined', () => {
        expect(validatePerceptionType(null).isValid).toBe(false);
        expect(validatePerceptionType(undefined).isValid).toBe(false);
      });

      it('should reject non-string values', () => {
        expect(validatePerceptionType(123).isValid).toBe(false);
        expect(validatePerceptionType({}).isValid).toBe(false);
        expect(validatePerceptionType([]).isValid).toBe(false);
      });

      it('should reject unknown type and provide error message', () => {
        const result = validatePerceptionType('totally_invalid_xyz');

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain('Invalid');
      });

      it('should suggest nearest type when possible', () => {
        // Use a type close enough to get a suggestion
        const result = validatePerceptionType('speech');

        expect(result.isValid).toBe(false);
        expect(result.suggestion).toBe('communication.speech');
      });
    });

    describe('context support', () => {
      it('should include source in error message', () => {
        const result = validatePerceptionType('invalid', { source: 'test rule' });

        expect(result.errorMessage).toContain('test rule');
      });

      it('should include file path in error message', () => {
        const result = validatePerceptionType('invalid', {
          file: 'data/mods/test/rule.json',
        });

        expect(result.errorMessage).toContain('data/mods/test/rule.json');
      });
    });
  });

  describe('createInvalidTypeMessage', () => {
    it('should create error message with type name', () => {
      const message = createInvalidTypeMessage('invalid_type', null);

      expect(message).toContain("'invalid_type'");
      expect(message).toContain('Invalid');
    });

    it('should include suggestion when provided', () => {
      const message = createInvalidTypeMessage(
        'speach_local',
        'communication.speech'
      );

      expect(message).toContain("'communication.speech'");
      expect(message).toContain('Did you mean');
    });

    it('should include sample valid types', () => {
      const message = createInvalidTypeMessage('invalid', null);

      expect(message).toContain('Valid types include');
    });

    it('should include context information', () => {
      const message = createInvalidTypeMessage('invalid', null, {
        source: 'rule file',
        file: 'test.json',
      });

      expect(message).toContain('rule file');
      expect(message).toContain('test.json');
    });
  });

  describe('createDeprecationWarning', () => {
    it('should create warning with legacy and new types', () => {
      const warning = createDeprecationWarning(
        'speech_local',
        'communication.speech'
      );

      expect(warning).toContain("'speech_local'");
      expect(warning).toContain("'communication.speech'");
      expect(warning).toContain('Deprecated');
      expect(warning).toContain('migrate');
    });

    it('should mention future removal', () => {
      const warning = createDeprecationWarning('old_type', 'new.type');

      expect(warning).toContain('removed');
      expect(warning).toContain('future');
    });

    it('should include context information', () => {
      const warning = createDeprecationWarning('old', 'new', {
        source: 'handler',
        file: 'test.js',
      });

      expect(warning).toContain('handler');
      expect(warning).toContain('test.js');
    });
  });

  describe('formatValidTypesMessage', () => {
    it('should return formatted message with categories', () => {
      const message = formatValidTypesMessage();

      expect(message).toContain('communication');
      expect(message).toContain('combat');
      expect(message).toContain('category');
    });

    it('should list types under their categories', () => {
      const message = formatValidTypesMessage();

      // Should have category prefixes
      expect(message).toMatch(/communication:.*speech/i);
      expect(message).toMatch(/combat:.*attack/i);
    });
  });

  describe('assertValidPerceptionType', () => {
    it('should not throw for valid types', () => {
      expect(() =>
        assertValidPerceptionType('communication.speech')
      ).not.toThrow();
      expect(() => assertValidPerceptionType('speech_local')).not.toThrow();
    });

    it('should throw for invalid types', () => {
      expect(() => assertValidPerceptionType('invalid_type')).toThrow();
      expect(() => assertValidPerceptionType('')).toThrow();
    });

    it('should return normalized type and deprecation status', () => {
      const result = assertValidPerceptionType('speech_local');

      expect(result.normalizedType).toBe('communication.speech');
      expect(result.isDeprecated).toBe(true);
    });

    it('should include context in thrown error message', () => {
      expect(() =>
        assertValidPerceptionType('invalid', { source: 'test' })
      ).toThrow(/test/);
    });
  });

  describe('validatePerceptionTypes', () => {
    it('should validate array of types', () => {
      const result = validatePerceptionTypes([
        'communication.speech',
        'combat.attack',
        'speech_local',
        'invalid_type',
      ]);

      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(1);
      expect(result.deprecated).toHaveLength(1);
    });

    it('should include normalized types in valid array', () => {
      const result = validatePerceptionTypes(['speech_local']);

      expect(result.valid).toContain('communication.speech');
    });

    it('should track invalid types with error messages', () => {
      const result = validatePerceptionTypes(['invalid_type']);

      expect(result.invalid[0].type).toBe('invalid_type');
      expect(result.invalid[0].error).toBeTruthy();
    });

    it('should handle empty array', () => {
      const result = validatePerceptionTypes([]);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
      expect(result.deprecated).toHaveLength(0);
    });

    it('should include suggestions for invalid types when available', () => {
      // Use 'speech' which is close enough to get a suggestion
      const result = validatePerceptionTypes(['speech']);

      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].suggestion).toBe('communication.speech');
    });
  });
});
