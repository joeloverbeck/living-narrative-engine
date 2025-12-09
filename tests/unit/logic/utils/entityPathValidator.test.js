import {
  VALID_ENTITY_ROLES,
  ENTITY_PREFIX,
  validateModifierEntityPath,
  extractEntityPathsFromLogic,
  validateModifierCondition,
} from '../../../../src/logic/utils/entityPathValidator.js';

describe('EntityPathValidator', () => {
  describe('constants', () => {
    it('should export VALID_ENTITY_ROLES as a Set with expected roles', () => {
      expect(VALID_ENTITY_ROLES).toBeInstanceOf(Set);
      expect(VALID_ENTITY_ROLES.has('actor')).toBe(true);
      expect(VALID_ENTITY_ROLES.has('primary')).toBe(true);
      expect(VALID_ENTITY_ROLES.has('secondary')).toBe(true);
      expect(VALID_ENTITY_ROLES.has('tertiary')).toBe(true);
      expect(VALID_ENTITY_ROLES.has('location')).toBe(true);
      expect(VALID_ENTITY_ROLES.size).toBe(5);
    });

    it('should export ENTITY_PREFIX as "entity."', () => {
      expect(ENTITY_PREFIX).toBe('entity.');
    });
  });

  describe('validateModifierEntityPath', () => {
    // Valid paths
    describe('valid paths', () => {
      it('should accept "entity.actor"', () => {
        const result = validateModifierEntityPath('entity.actor');
        expect(result).toEqual({
          isValid: true,
          error: null,
          normalizedPath: 'entity.actor',
        });
      });

      it('should accept "entity.primary"', () => {
        const result = validateModifierEntityPath('entity.primary');
        expect(result).toEqual({
          isValid: true,
          error: null,
          normalizedPath: 'entity.primary',
        });
      });

      it('should accept "entity.secondary"', () => {
        const result = validateModifierEntityPath('entity.secondary');
        expect(result).toEqual({
          isValid: true,
          error: null,
          normalizedPath: 'entity.secondary',
        });
      });

      it('should accept "entity.tertiary"', () => {
        const result = validateModifierEntityPath('entity.tertiary');
        expect(result).toEqual({
          isValid: true,
          error: null,
          normalizedPath: 'entity.tertiary',
        });
      });

      it('should accept "entity.location"', () => {
        const result = validateModifierEntityPath('entity.location');
        expect(result).toEqual({
          isValid: true,
          error: null,
          normalizedPath: 'entity.location',
        });
      });

      it('should accept paths with component access like "entity.actor.components.skills:medicine_skill.value"', () => {
        const result = validateModifierEntityPath(
          'entity.actor.components.skills:medicine_skill.value'
        );
        expect(result).toEqual({
          isValid: true,
          error: null,
          normalizedPath: 'entity.actor.components.skills:medicine_skill.value',
        });
      });

      it('should trim whitespace: "  entity.actor  " -> valid', () => {
        const result = validateModifierEntityPath('  entity.actor  ');
        expect(result.isValid).toBe(true);
        expect(result.normalizedPath).toBe('entity.actor');
      });
    });

    // Invalid paths - missing prefix
    describe('invalid paths - missing entity. prefix', () => {
      it('should reject "actor" (missing entity. prefix)', () => {
        const result = validateModifierEntityPath('actor');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must start with "entity."');
        expect(result.normalizedPath).toBeNull();
      });

      it('should reject "primary" (missing entity. prefix)', () => {
        const result = validateModifierEntityPath('primary');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must start with "entity."');
      });

      it('should reject "target" (wrong context pattern)', () => {
        const result = validateModifierEntityPath('target');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must start with "entity."');
      });
    });

    // Invalid paths - invalid role
    describe('invalid paths - invalid role', () => {
      it('should reject "entity.target" (invalid role)', () => {
        const result = validateModifierEntityPath('entity.target');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid entity role "target"');
        expect(result.error).toContain('Valid roles are:');
      });

      it('should reject "entity.actorEntity" (invalid role)', () => {
        const result = validateModifierEntityPath('entity.actorEntity');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid entity role "actorEntity"');
      });

      it('should reject "entity.invalid" (invalid role)', () => {
        const result = validateModifierEntityPath('entity.invalid');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid entity role "invalid"');
      });
    });

    // Invalid paths - malformed
    describe('invalid paths - malformed', () => {
      it('should reject empty string', () => {
        const result = validateModifierEntityPath('');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Entity path cannot be empty');
      });

      it('should reject null', () => {
        const result = validateModifierEntityPath(null);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Entity path must be a non-null string');
      });

      it('should reject undefined', () => {
        const result = validateModifierEntityPath(undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Entity path must be a non-null string');
      });

      it('should reject non-string values', () => {
        const result = validateModifierEntityPath(123);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Entity path must be a non-null string');
      });

      it('should reject "entity." (empty role)', () => {
        const result = validateModifierEntityPath('entity.');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Entity path has empty role segment');
      });

      it('should reject "entity..actor" (double dot)', () => {
        // This path has "entity" then empty string then "actor"
        // The role at index 1 is empty
        const result = validateModifierEntityPath('entity..actor');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Entity path has empty role segment');
      });

      it('should reject paths with empty intermediate segments', () => {
        const result = validateModifierEntityPath('entity.actor..components');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('empty segment');
      });
    });

    // Error messages
    describe('error messages', () => {
      it('should return helpful error message for missing prefix', () => {
        const result = validateModifierEntityPath('actor');
        expect(result.error).toBe(
          'Entity path must start with "entity." but got "actor"'
        );
      });

      it('should return helpful error message listing valid roles', () => {
        const result = validateModifierEntityPath('entity.invalid');
        expect(result.error).toContain('actor');
        expect(result.error).toContain('primary');
        expect(result.error).toContain('secondary');
        expect(result.error).toContain('tertiary');
        expect(result.error).toContain('location');
      });
    });
  });

  describe('extractEntityPathsFromLogic', () => {
    it('should extract paths from isSlotExposed operator', () => {
      const logic = {
        isSlotExposed: ['entity.actor', { var: 'slot' }],
      };

      const results = extractEntityPathsFromLogic(logic);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        path: 'entity.actor',
        operatorName: 'isSlotExposed',
        location: 'root.isSlotExposed',
      });
    });

    it('should extract paths from isSocketCovered operator', () => {
      const logic = {
        isSocketCovered: ['entity.primary', { var: 'socket' }],
      };

      const results = extractEntityPathsFromLogic(logic);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        path: 'entity.primary',
        operatorName: 'isSocketCovered',
        location: 'root.isSocketCovered',
      });
    });

    it('should extract multiple paths from nested logic', () => {
      const logic = {
        and: [
          { isSlotExposed: ['entity.actor', { var: 'slot1' }] },
          {
            or: [
              { isSocketCovered: ['entity.primary', { var: 'socket1' }] },
              { isSlotExposed: ['entity.secondary', { var: 'slot2' }] },
            ],
          },
        ],
      };

      const results = extractEntityPathsFromLogic(logic);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.path)).toEqual([
        'entity.actor',
        'entity.primary',
        'entity.secondary',
      ]);
    });

    it('should handle empty/null logic gracefully', () => {
      expect(extractEntityPathsFromLogic(null)).toEqual([]);
      expect(extractEntityPathsFromLogic(undefined)).toEqual([]);
      expect(extractEntityPathsFromLogic({})).toEqual([]);
    });

    it('should skip non-string first arguments', () => {
      const logic = {
        isSlotExposed: [123, { var: 'slot' }], // number instead of string
      };

      const results = extractEntityPathsFromLogic(logic);
      expect(results).toHaveLength(0);
    });

    it('should skip operators with empty arrays', () => {
      const logic = {
        isSlotExposed: [],
      };

      const results = extractEntityPathsFromLogic(logic);
      expect(results).toHaveLength(0);
    });

    it('should use custom operator names when provided', () => {
      const logic = {
        customOperator: ['entity.actor', 'arg'],
        isSlotExposed: ['entity.primary', 'arg'],
      };

      const results = extractEntityPathsFromLogic(
        logic,
        new Set(['customOperator'])
      );

      expect(results).toHaveLength(1);
      expect(results[0].operatorName).toBe('customOperator');
    });

    it('should handle deeply nested arrays', () => {
      const logic = {
        if: [
          { '>': [1, 0] },
          { isSlotExposed: ['entity.actor', 'slot'] },
          { isSocketCovered: ['entity.primary', 'socket'] },
        ],
      };

      const results = extractEntityPathsFromLogic(logic);
      expect(results).toHaveLength(2);
    });
  });

  describe('validateModifierCondition', () => {
    it('should validate all entity paths in a condition', () => {
      const condition = {
        logic: {
          and: [
            { isSlotExposed: ['entity.actor', { var: 'slot' }] },
            { isSocketCovered: ['entity.primary', { var: 'socket' }] },
          ],
        },
      };

      const result = validateModifierCondition(condition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return all errors for multiple invalid paths', () => {
      const condition = {
        logic: {
          and: [
            { isSlotExposed: ['actor', { var: 'slot' }] }, // missing entity.
            { isSocketCovered: ['entity.invalid', { var: 'socket' }] }, // invalid role
          ],
        },
      };

      const result = validateModifierCondition(condition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].path).toBe('actor');
      expect(result.errors[1].path).toBe('entity.invalid');
    });

    it('should pass for conditions with valid paths', () => {
      const condition = {
        logic: {
          isSlotExposed: ['entity.tertiary', { var: 'slot' }],
        },
      };

      const result = validateModifierCondition(condition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle conditions without logic property', () => {
      expect(validateModifierCondition({})).toEqual({
        isValid: true,
        errors: [],
      });
      expect(validateModifierCondition({ other: 'data' })).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('should handle null/undefined conditions', () => {
      expect(validateModifierCondition(null)).toEqual({
        isValid: true,
        errors: [],
      });
      expect(validateModifierCondition(undefined)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('should include operatorName in error objects', () => {
      const condition = {
        logic: {
          isSocketCovered: ['actor', { var: 'socket' }],
        },
      };

      const result = validateModifierCondition(condition);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].operatorName).toBe('isSocketCovered');
    });

    it('should accept custom operator names', () => {
      const condition = {
        logic: {
          customOp: ['actor', 'arg'], // invalid path with custom operator
        },
      };

      const result = validateModifierCondition(
        condition,
        new Set(['customOp'])
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].operatorName).toBe('customOp');
    });
  });
});
