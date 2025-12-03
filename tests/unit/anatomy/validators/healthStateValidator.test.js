import {
  validateHealthState,
  validateSchemaConsistency,
  InvalidHealthStateError,
} from '../../../../src/anatomy/validators/healthStateValidator.js';
import { getAllStateIds } from '../../../../src/anatomy/registries/healthStateRegistry.js';

describe('HealthStateValidator', () => {
  describe('validateHealthState', () => {
    it('should return true for valid states', () => {
      expect(validateHealthState('healthy')).toBe(true);
      expect(validateHealthState('destroyed')).toBe(true);
    });

    it('should throw InvalidHealthStateError for invalid states', () => {
      expect(() => validateHealthState('tis_but_a_scratch')).toThrow(
        InvalidHealthStateError
      );
    });

    it('should include context in error', () => {
      try {
        validateHealthState('invalid', { entityId: '123' });
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidHealthStateError);
        expect(error.context).toEqual({ entityId: '123' });
        expect(error.message).toContain('Valid states are');
      }
    });
  });

  describe('validateSchemaConsistency', () => {
    const currentRegistryStates = getAllStateIds();

    it('should return valid for matching enum', () => {
      const result = validateSchemaConsistency(currentRegistryStates);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid if schema is missing a state', () => {
      const incompleteEnum = currentRegistryStates.filter(
        (s) => s !== 'healthy'
      );
      const result = validateSchemaConsistency(incompleteEnum);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain(
        "Registry state 'healthy' is missing from schema enum"
      );
    });

    it('should return invalid if schema has extra state', () => {
      const extraEnum = [...currentRegistryStates, 'zombie_virus'];
      const result = validateSchemaConsistency(extraEnum);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain(
        "Schema state 'zombie_virus' is missing from health registry"
      );
    });
  });
});
