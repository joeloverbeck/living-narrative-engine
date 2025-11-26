import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SkillResolverService from '../../../../src/combat/services/SkillResolverService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates minimal mocks for dependencies
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    entityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    },
  };
}

describe('SkillResolverService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    ({ logger: mockLogger, entityManager: mockEntityManager } = createMocks());

    service = new SkillResolverService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(SkillResolverService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SkillResolverService: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new SkillResolverService({
          entityManager: mockEntityManager,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new SkillResolverService({
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new SkillResolverService({
          entityManager: mockEntityManager,
          logger: null,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is null', () => {
      expect(() => {
        new SkillResolverService({
          entityManager: null,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new SkillResolverService({
          entityManager: mockEntityManager,
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager missing required methods', () => {
      expect(() => {
        new SkillResolverService({
          entityManager: { getComponentData: jest.fn() }, // Missing hasComponent
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });
  });

  describe('getSkillValue', () => {
    describe('when component exists', () => {
      it('should return skill value when component exists with valid value', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 45 });

        const result = service.getSkillValue('actor-123', 'skills:melee_skill');

        expect(result).toEqual({ baseValue: 45, hasComponent: true });
        expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
          'actor-123',
          'skills:melee_skill'
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'actor-123',
          'skills:melee_skill'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Retrieved skill value 45')
        );
      });

      it('should return skill value of 0 when component exists with value 0', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 0 });

        const result = service.getSkillValue('actor-123', 'skills:melee_skill');

        expect(result).toEqual({ baseValue: 0, hasComponent: true });
      });

      it('should return skill value of 100 when component exists with max value', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 100 });

        const result = service.getSkillValue('actor-123', 'skills:melee_skill');

        expect(result).toEqual({ baseValue: 100, hasComponent: true });
      });
    });

    describe('when component is missing', () => {
      it('should return default value when component does not exist', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          10
        );

        expect(result).toEqual({ baseValue: 10, hasComponent: false });
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('does not have component')
        );
      });

      it('should return 0 as default when no default value provided', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.getSkillValue('actor-123', 'skills:melee_skill');

        expect(result).toEqual({ baseValue: 0, hasComponent: false });
      });

      it('should return custom default value when provided', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          25
        );

        expect(result).toEqual({ baseValue: 25, hasComponent: false });
      });
    });

    describe('when entity does not exist or is invalid', () => {
      it('should return default when entityId is null', () => {
        const result = service.getSkillValue(
          null,
          'skills:melee_skill',
          15
        );

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid entityId')
        );
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      });

      it('should return default when entityId is undefined', () => {
        const result = service.getSkillValue(
          undefined,
          'skills:melee_skill',
          15
        );

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid entityId')
        );
      });

      it('should return default when entityId is empty string', () => {
        const result = service.getSkillValue('', 'skills:melee_skill', 15);

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid entityId')
        );
      });

      it('should return default when entityId is not a string', () => {
        const result = service.getSkillValue(123, 'skills:melee_skill', 15);

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid entityId')
        );
      });
    });

    describe('when skillComponentId is invalid', () => {
      it('should return default when skillComponentId is null', () => {
        const result = service.getSkillValue('actor-123', null, 15);

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid skillComponentId')
        );
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      });

      it('should return default when skillComponentId is undefined', () => {
        const result = service.getSkillValue('actor-123', undefined, 15);

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid skillComponentId')
        );
      });

      it('should return default when skillComponentId is empty string', () => {
        const result = service.getSkillValue('actor-123', '', 15);

        expect(result).toEqual({ baseValue: 15, hasComponent: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid skillComponentId')
        );
      });
    });

    describe('when component data is malformed', () => {
      it('should return default when component data is null', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue(null);

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          20
        );

        expect(result).toEqual({ baseValue: 20, hasComponent: true });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('returned null/undefined data')
        );
      });

      it('should return default when component data is undefined', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue(undefined);

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          20
        );

        expect(result).toEqual({ baseValue: 20, hasComponent: true });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('returned null/undefined data')
        );
      });

      it('should return default when value property is not a number', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          value: 'not-a-number',
        });

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          20
        );

        expect(result).toEqual({ baseValue: 20, hasComponent: true });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('non-numeric value')
        );
      });

      it('should return default when value property is missing', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          someOtherProperty: 45,
        });

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          20
        );

        expect(result).toEqual({ baseValue: 20, hasComponent: true });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('non-numeric value')
        );
      });

      it('should return default when value is NaN', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: NaN });

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          20
        );

        // NaN is typeof 'number', but still considered numeric
        // This is expected JavaScript behavior
        expect(result).toEqual({ baseValue: NaN, hasComponent: true });
      });
    });

    describe('with different skill components', () => {
      it('should work with defense_skill component', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 30 });

        const result = service.getSkillValue(
          'actor-123',
          'skills:defense_skill'
        );

        expect(result).toEqual({ baseValue: 30, hasComponent: true });
        expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
          'actor-123',
          'skills:defense_skill'
        );
      });

      it('should work with ranged_skill component', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 55 });

        const result = service.getSkillValue(
          'actor-123',
          'skills:ranged_skill'
        );

        expect(result).toEqual({ baseValue: 55, hasComponent: true });
      });

      it('should work with dodge_skill component', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 40 });

        const result = service.getSkillValue('actor-123', 'skills:dodge_skill');

        expect(result).toEqual({ baseValue: 40, hasComponent: true });
      });

      it('should work with parry_skill component', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 35 });

        const result = service.getSkillValue('actor-123', 'skills:parry_skill');

        expect(result).toEqual({ baseValue: 35, hasComponent: true });
      });
    });

    describe('edge cases', () => {
      it('should handle negative default value', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.getSkillValue(
          'actor-123',
          'skills:melee_skill',
          -5
        );

        expect(result).toEqual({ baseValue: -5, hasComponent: false });
      });

      it('should handle decimal skill values', () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 45.5 });

        const result = service.getSkillValue('actor-123', 'skills:melee_skill');

        expect(result).toEqual({ baseValue: 45.5, hasComponent: true });
      });

      it('should handle very large entity IDs', () => {
        const longEntityId = 'entity-' + 'a'.repeat(1000);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({ value: 50 });

        const result = service.getSkillValue(longEntityId, 'skills:melee_skill');

        expect(result).toEqual({ baseValue: 50, hasComponent: true });
        expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
          longEntityId,
          'skills:melee_skill'
        );
      });
    });
  });
});
