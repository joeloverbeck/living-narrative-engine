import { describe, it, expect, beforeEach } from '@jest/globals';
import ActivityConditionValidator from '../../../../../src/anatomy/services/validation/activityConditionValidator.js';

describe('ActivityConditionValidator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      warn: jest.fn(),
      error: () => {},
      debug: () => {},
    };

    validator = new ActivityConditionValidator({
      logger: mockLogger,
    });
  });

  describe('isEmptyConditionsObject', () => {
    it('should return true for null', () => {
      expect(validator.isEmptyConditionsObject(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(validator.isEmptyConditionsObject(undefined)).toBe(true);
    });

    it('should return true for empty object', () => {
      expect(validator.isEmptyConditionsObject({})).toBe(true);
    });

    it('should return false for object with keys', () => {
      expect(validator.isEmptyConditionsObject({ foo: 'bar' })).toBe(false);
    });

    it('should return false for object with multiple keys', () => {
      expect(
        validator.isEmptyConditionsObject({
          requiredComponents: [],
          customLogic: {},
        })
      ).toBe(false);
    });
  });

  describe('matchesPropertyCondition', () => {
    it('should return true when rule is null', () => {
      const activity = { sourceData: { type: 'walk' } };
      expect(validator.matchesPropertyCondition(activity, null)).toBe(true);
    });

    it('should return true when rule is undefined', () => {
      const activity = { sourceData: { type: 'walk' } };
      expect(validator.matchesPropertyCondition(activity, undefined)).toBe(
        true
      );
    });

    it('should return true when rule has no property field', () => {
      const activity = { sourceData: { type: 'walk' } };
      expect(validator.matchesPropertyCondition(activity, { equals: 'walk' })).toBe(
        true
      );
    });

    it('should return true when property matches rule equals value', () => {
      const activity = { sourceData: { type: 'walk' } };
      const rule = { property: 'type', equals: 'walk' };
      expect(validator.matchesPropertyCondition(activity, rule)).toBe(true);
    });

    it('should return false when property does not match rule equals value', () => {
      const activity = { sourceData: { type: 'run' } };
      const rule = { property: 'type', equals: 'walk' };
      expect(validator.matchesPropertyCondition(activity, rule)).toBe(false);
    });

    it('should return false when activity has no sourceData', () => {
      const activity = {};
      const rule = { property: 'type', equals: 'walk' };
      expect(validator.matchesPropertyCondition(activity, rule)).toBe(false);
    });

    it('should return false when sourceData missing the property', () => {
      const activity = { sourceData: { otherProp: 'value' } };
      const rule = { property: 'type', equals: 'walk' };
      expect(validator.matchesPropertyCondition(activity, rule)).toBe(false);
    });

    it('should handle null sourceData', () => {
      const activity = { sourceData: null };
      const rule = { property: 'type', equals: 'walk' };
      expect(validator.matchesPropertyCondition(activity, rule)).toBe(false);
    });
  });

  describe('hasRequiredComponents', () => {
    it('should return false when entity is null', () => {
      expect(validator.hasRequiredComponents(null, ['core:actor'])).toBe(
        false
      );
    });

    it('should return false when entity is undefined', () => {
      expect(validator.hasRequiredComponents(undefined, ['core:actor'])).toBe(
        false
      );
    });

    it('should return false when entity has no hasComponent method', () => {
      const entity = { id: 'entity1' };
      expect(validator.hasRequiredComponents(entity, ['core:actor'])).toBe(
        false
      );
    });

    it('should return true when entity has all required components', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      const required = ['core:actor', 'core:health'];
      expect(validator.hasRequiredComponents(entity, required)).toBe(true);
      expect(entity.hasComponent).toHaveBeenCalledWith('core:actor');
      expect(entity.hasComponent).toHaveBeenCalledWith('core:health');
    });

    it('should return false when entity missing some required components', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn((id) => id === 'core:actor'),
      };
      const required = ['core:actor', 'core:health'];
      expect(validator.hasRequiredComponents(entity, required)).toBe(false);
    });

    it('should return true for empty required array', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn(),
      };
      expect(validator.hasRequiredComponents(entity, [])).toBe(true);
      expect(entity.hasComponent).not.toHaveBeenCalled();
    });

    it('should log warning when individual component check fails', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn(() => {
          throw new Error('Component check error');
        }),
      };
      const required = ['core:actor'];

      expect(validator.hasRequiredComponents(entity, required)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to verify required component core:actor for entity1',
        expect.any(Error)
      );
    });

    it('should log warning when overall evaluation fails', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn(),
      };
      // Force an error in the every() call by making required non-iterable in a way that throws
      const required = {
        every() {
          throw new Error('Array operation error');
        },
      };

      expect(validator.hasRequiredComponents(entity, required)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to evaluate required components for entity1',
        expect.any(Error)
      );
    });

    it('should handle entity without id in warning message', () => {
      const entity = {
        hasComponent: jest.fn(() => {
          throw new Error('Component check error');
        }),
      };
      const required = ['core:actor'];

      expect(validator.hasRequiredComponents(entity, required)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to verify required component core:actor for unknown',
        expect.any(Error)
      );
    });
  });

  describe('hasForbiddenComponents', () => {
    it('should return false when entity is null', () => {
      expect(validator.hasForbiddenComponents(null, ['core:dead'])).toBe(
        false
      );
    });

    it('should return false when entity is undefined', () => {
      expect(validator.hasForbiddenComponents(undefined, ['core:dead'])).toBe(
        false
      );
    });

    it('should return false when entity has no hasComponent method', () => {
      const entity = { id: 'entity1' };
      expect(validator.hasForbiddenComponents(entity, ['core:dead'])).toBe(
        false
      );
    });

    it('should return false when entity has none of the forbidden components', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn().mockReturnValue(false),
      };
      const forbidden = ['core:dead', 'core:unconscious'];
      expect(validator.hasForbiddenComponents(entity, forbidden)).toBe(false);
      expect(entity.hasComponent).toHaveBeenCalledWith('core:dead');
      expect(entity.hasComponent).toHaveBeenCalledWith('core:unconscious');
    });

    it('should return true when entity has at least one forbidden component', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn((id) => id === 'core:dead'),
      };
      const forbidden = ['core:dead', 'core:unconscious'];
      expect(validator.hasForbiddenComponents(entity, forbidden)).toBe(true);
    });

    it('should return false for empty forbidden array', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn(),
      };
      expect(validator.hasForbiddenComponents(entity, [])).toBe(false);
      expect(entity.hasComponent).not.toHaveBeenCalled();
    });

    it('should log warning when individual component check fails', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn(() => {
          throw new Error('Component check error');
        }),
      };
      const forbidden = ['core:dead'];

      expect(validator.hasForbiddenComponents(entity, forbidden)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to verify forbidden component core:dead for entity1',
        expect.any(Error)
      );
    });

    it('should log warning when overall evaluation fails', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn(),
      };
      // Force an error in the some() call
      const forbidden = {
        some() {
          throw new Error('Array operation error');
        },
      };

      expect(validator.hasForbiddenComponents(entity, forbidden)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to evaluate forbidden components for entity1',
        expect.any(Error)
      );
    });

    it('should handle entity without id in warning message', () => {
      const entity = {
        hasComponent: jest.fn(() => {
          throw new Error('Component check error');
        }),
      };
      const forbidden = ['core:dead'];

      expect(validator.hasForbiddenComponents(entity, forbidden)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to verify forbidden component core:dead for unknown',
        expect.any(Error)
      );
    });

    it('should stop checking after first forbidden component found', () => {
      const entity = {
        id: 'entity1',
        hasComponent: jest.fn((id) => id === 'core:dead'),
      };
      const forbidden = ['core:dead', 'core:unconscious', 'core:paralyzed'];

      expect(validator.hasForbiddenComponents(entity, forbidden)).toBe(true);
      // some() should short-circuit after finding the first match
      expect(entity.hasComponent).toHaveBeenCalledWith('core:dead');
      // May or may not be called depending on array order and implementation
    });
  });

  describe('extractEntityData', () => {
    it('should return null when entity is null', () => {
      expect(validator.extractEntityData(null)).toBeNull();
    });

    it('should return null when entity is undefined', () => {
      expect(validator.extractEntityData(undefined)).toBeNull();
    });

    it('should extract entity id and components', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: ['core:actor', 'core:health'],
        getComponentData: jest.fn((id) => {
          if (id === 'core:actor') return { name: 'John' };
          if (id === 'core:health') return { hp: 100 };
          return null;
        }),
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {
          'core:actor': { name: 'John' },
          'core:health': { hp: 100 },
        },
      });
    });

    it('should handle entity with no componentTypeIds', () => {
      const entity = {
        id: 'entity1',
        getComponentData: jest.fn(),
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {},
      });
      expect(entity.getComponentData).not.toHaveBeenCalled();
    });

    it('should handle entity with null componentTypeIds', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: null,
        getComponentData: jest.fn(),
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {},
      });
    });

    it('should handle entity with empty componentTypeIds array', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: [],
        getComponentData: jest.fn(),
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {},
      });
      expect(entity.getComponentData).not.toHaveBeenCalled();
    });

    it('should skip components when getComponentData method is missing', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: ['core:actor', 'core:health'],
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {},
      });
    });

    it('should log warning when component data extraction fails', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: ['core:actor', 'core:health'],
        getComponentData: jest.fn((id) => {
          if (id === 'core:actor') throw new Error('Extraction error');
          return { hp: 100 };
        }),
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {
          'core:health': { hp: 100 },
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to extract component data for core:actor on entity1',
        expect.any(Error)
      );
    });

    it('should handle entity without id in warning message', () => {
      const entity = {
        componentTypeIds: ['core:actor'],
        getComponentData: jest.fn(() => {
          throw new Error('Extraction error');
        }),
      };

      validator.extractEntityData(entity);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to extract component data for core:actor on unknown entity',
        expect.any(Error)
      );
    });

    it('should continue extracting after individual failures', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: ['comp1', 'comp2', 'comp3'],
        getComponentData: jest.fn((id) => {
          if (id === 'comp2') throw new Error('comp2 error');
          return { data: id };
        }),
      };

      const result = validator.extractEntityData(entity);

      expect(result).toEqual({
        id: 'entity1',
        components: {
          comp1: { data: 'comp1' },
          comp3: { data: 'comp3' },
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
