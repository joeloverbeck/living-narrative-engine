import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates minimal mocks for dependencies
 *
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
    modifierContextBuilder: {
      buildContext: jest.fn().mockReturnValue({
        entity: {
          actor: { id: 'actor-123', components: {} },
          primary: null,
          secondary: null,
          tertiary: null,
          location: null,
        },
        actor: { id: 'actor-123', components: {} },
        target: null,
        secondaryTarget: null,
        tertiaryTarget: null,
        location: null,
      }),
    },
    gameDataRepository: {
      getConditionDefinition: jest.fn(),
    },
  };
}

describe('ModifierCollectorService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockModifierContextBuilder;
  let mockGameDataRepository;

  beforeEach(() => {
    ({
      logger: mockLogger,
      entityManager: mockEntityManager,
      modifierContextBuilder: mockModifierContextBuilder,
      gameDataRepository: mockGameDataRepository,
    } = createMocks());

    service = new ModifierCollectorService({
      entityManager: mockEntityManager,
      modifierContextBuilder: mockModifierContextBuilder,
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies including modifierContextBuilder', () => {
      expect(service).toBeInstanceOf(ModifierCollectorService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ModifierCollectorService: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          modifierContextBuilder: mockModifierContextBuilder,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new ModifierCollectorService({
          modifierContextBuilder: mockModifierContextBuilder,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when modifierContextBuilder is missing', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          modifierContextBuilder: mockModifierContextBuilder,
          logger: null,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is null', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: null,
          modifierContextBuilder: mockModifierContextBuilder,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when modifierContextBuilder is null', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          modifierContextBuilder: null,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          modifierContextBuilder: mockModifierContextBuilder,
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager missing required methods', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: { getComponentData: jest.fn() }, // Missing hasComponent
          modifierContextBuilder: mockModifierContextBuilder,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when modifierContextBuilder missing required methods', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          modifierContextBuilder: {}, // Missing buildContext
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });
  });

  describe('collectModifiers', () => {
    describe('empty modifiers', () => {
      it('should return empty collection when no modifiers configured', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1,
        });
      });

      it('should return empty collection when actionConfig is undefined', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: undefined,
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1,
        });
      });

      it('should return empty collection when actionConfig has no modifiers property', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: { someOtherProp: 'value' },
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1,
        });
      });

      it('should return empty collection when actionConfig.modifiers is empty array', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: { modifiers: [] },
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1,
        });
      });
    });

    describe('logging', () => {
      it('should log when collecting modifiers with actor and primary target', () => {
        service.collectModifiers({
          actorId: 'actor-123',
          primaryTargetId: 'target-456',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('actor=actor-123')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('primary=target-456')
        );
      });

      it('should log when collecting modifiers with only actor', () => {
        service.collectModifiers({
          actorId: 'actor-123',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('actor=actor-123')
        );
      });

      it('should log found modifiers count and totals', () => {
        service.collectModifiers({
          actorId: 'actor-123',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Found 0 modifiers')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('flat=0')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('percentage=1')
        );
      });
    });

    describe('JSON Logic condition evaluation', () => {
      it('should return active modifiers when conditions are true', () => {
        // Setup context with component that makes condition true
        mockModifierContextBuilder.buildContext.mockReturnValue({
          entity: {
            actor: {
              id: 'actor-123',
              components: {
                'buffs:adrenaline': { active: true },
              },
            },
            primary: null,
            secondary: null,
            tertiary: null,
            location: null,
          },
        });

        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, true] }, // Always true
                value: 10,
                type: 'flat',
                tag: 'test modifier',
                description: 'Test',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].value).toBe(10);
        expect(result.modifiers[0].tag).toBe('test modifier');
        expect(result.totalFlat).toBe(10);
      });

      it('should skip modifiers when conditions are false', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, false] }, // Always false
                value: 10,
                type: 'flat',
                tag: 'should not appear',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(0);
        expect(result.totalFlat).toBe(0);
      });

      it('should evaluate inline JSON Logic conditions', () => {
        mockModifierContextBuilder.buildContext.mockReturnValue({
          entity: {
            actor: { id: 'actor-123', components: {} },
            primary: {
              id: 'target-456',
              components: {
                'physical-control-states:being_restrained': { active: true },
              },
            },
            secondary: null,
            tertiary: null,
            location: null,
          },
        });

        const result = service.collectModifiers({
          actorId: 'actor-123',
          primaryTargetId: 'target-456',
          actionConfig: {
            modifiers: [
              {
                condition: {
                  '!=': [{ var: 'entity.primary' }, null],
                },
                value: 15,
                type: 'flat',
                tag: 'target exists',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].value).toBe(15);
      });

      it('should handle condition.logic wrapper format', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: {
                  logic: { '==': [1, 1] }, // Wrapped in .logic property
                },
                value: 5,
                type: 'flat',
                tag: 'wrapped condition',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].tag).toBe('wrapped condition');
      });

      it('should treat missing condition as always active', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                // No condition property
                value: 20,
                type: 'flat',
                tag: 'always active',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].tag).toBe('always active');
      });

      it('should resolve condition_ref and apply modifier', () => {
        const primaryTarget = {
          id: 'target-456',
          components: { 'blockers:corroded': {} },
        };
        mockModifierContextBuilder.buildContext.mockReturnValue({
          entity: {
            actor: { id: 'actor-123', components: {} },
            primary: primaryTarget,
            secondary: null,
            tertiary: null,
            location: null,
          },
          actor: { id: 'actor-123', components: {} },
          target: primaryTarget,
          secondaryTarget: null,
          tertiaryTarget: null,
          location: null,
        });
        mockGameDataRepository.getConditionDefinition.mockImplementation(
          (id) => {
            if (id === 'blockers:target-is-corroded') {
              return {
                logic: { '!!': [{ var: 'target.components.blockers:corroded' }] },
              };
            }
            return null;
          }
        );

        const result = service.collectModifiers({
          actorId: 'actor-123',
          primaryTargetId: 'target-456',
          actionConfig: {
            modifiers: [
              {
                condition: {
                  condition_ref: 'blockers:target-is-corroded',
                },
                value: 10,
                type: 'flat',
                tag: 'corroded',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].tag).toBe('corroded');
        expect(mockGameDataRepository.getConditionDefinition).toHaveBeenCalledWith(
          'blockers:target-is-corroded'
        );
      });

      it('should resolve deprecated $ref condition references', () => {
        const primaryTarget = {
          id: 'target-456',
          components: { 'blockers:corroded': {} },
        };
        mockModifierContextBuilder.buildContext.mockReturnValue({
          entity: {
            actor: { id: 'actor-123', components: {} },
            primary: primaryTarget,
            secondary: null,
            tertiary: null,
            location: null,
          },
          actor: { id: 'actor-123', components: {} },
          target: primaryTarget,
          secondaryTarget: null,
          tertiaryTarget: null,
          location: null,
        });
        mockGameDataRepository.getConditionDefinition.mockReturnValue({
          logic: { '!!': [{ var: 'target.components.blockers:corroded' }] },
        });

        const result = service.collectModifiers({
          actorId: 'actor-123',
          primaryTargetId: 'target-456',
          actionConfig: {
            modifiers: [
              {
                condition: {
                  $ref: 'blockers:target-is-corroded',
                },
                value: 10,
                type: 'flat',
                tag: 'corroded',
              },
            ],
          },
        });

        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].tag).toBe('corroded');
      });
    });

    describe('modifier format handling', () => {
      it('should handle new value+type format', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, true] },
                value: 15,
                type: 'percentage',
                tag: 'percentage mod',
              },
            ],
          },
        });

        expect(result.modifiers[0].type).toBe('percentage');
        expect(result.modifiers[0].value).toBe(15);
      });

      it('should handle legacy modifier format (integer)', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, true] },
                modifier: 25, // Legacy format
                tag: 'legacy modifier',
              },
            ],
          },
        });

        expect(result.modifiers[0].type).toBe('flat');
        expect(result.modifiers[0].value).toBe(25);
      });

      it('should default to flat type when type not specified', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, true] },
                value: 10,
                tag: 'no type specified',
              },
            ],
          },
        });

        expect(result.modifiers[0].type).toBe('flat');
      });

      it('should default to 0 value when neither value nor modifier specified', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, true] },
                tag: 'no value',
              },
            ],
          },
        });

        expect(result.modifiers[0].value).toBe(0);
      });

      it('should build modifier with correct type defaults', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { '==': [true, true] },
                value: 10,
                tag: 'complete modifier',
                description: 'A test modifier',
                stackId: 'group-a',
                targetRole: 'actor',
              },
            ],
          },
        });

        const modifier = result.modifiers[0];
        expect(modifier.type).toBe('flat');
        expect(modifier.value).toBe(10);
        expect(modifier.tag).toBe('complete modifier');
        expect(modifier.description).toBe('A test modifier');
        expect(modifier.stackId).toBe('group-a');
        expect(modifier.targetRole).toBe('actor');
      });
    });

    describe('error handling', () => {
      it('should log warning on condition evaluation error and continue', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: {
            modifiers: [
              {
                condition: { invalid_operator: [] }, // Invalid JSON Logic
                value: 10,
                tag: 'will fail',
                description: 'This will error',
              },
              {
                condition: { '==': [true, true] }, // Valid
                value: 5,
                tag: 'will succeed',
              },
            ],
          },
        });

        // First modifier should be skipped due to error
        // Second modifier should succeed
        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].tag).toBe('will succeed');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error evaluating modifier condition'),
          expect.objectContaining({ description: 'This will error' })
        );
      });
    });

    describe('context builder integration', () => {
      it('should pass all target IDs to context builder', () => {
        service.collectModifiers({
          actorId: 'actor-123',
          primaryTargetId: 'primary-456',
          secondaryTargetId: 'secondary-789',
          tertiaryTargetId: 'tertiary-012',
          actionConfig: { modifiers: [{ value: 5, tag: 't' }] },
        });

        expect(mockModifierContextBuilder.buildContext).toHaveBeenCalledWith({
          actorId: 'actor-123',
          primaryTargetId: 'primary-456',
          secondaryTargetId: 'secondary-789',
          tertiaryTargetId: 'tertiary-012',
        });
      });
    });
  });

  describe('stacking rules', () => {
    it('should keep only highest absolute value modifier for same stackId', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        actionConfig: {
          modifiers: [
            {
              condition: { '==': [true, true] },
              value: 5,
              type: 'flat',
              tag: 'minor buff',
              stackId: 'strength',
            },
            {
              condition: { '==': [true, true] },
              value: 15,
              type: 'flat',
              tag: 'major buff',
              stackId: 'strength',
            },
          ],
        },
      });

      // Only the highest value should remain
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].value).toBe(15);
      expect(result.modifiers[0].tag).toBe('major buff');
    });

    it('should keep all modifiers without stackId', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        actionConfig: {
          modifiers: [
            {
              condition: { '==': [true, true] },
              value: 5,
              type: 'flat',
              tag: 'mod1',
            },
            {
              condition: { '==': [true, true] },
              value: 10,
              type: 'flat',
              tag: 'mod2',
            },
          ],
        },
      });

      expect(result.modifiers).toHaveLength(2);
      expect(result.totalFlat).toBe(15);
    });
  });

  describe('calculateTotals', () => {
    it('should return identity totals for empty modifiers', () => {
      const result = service.collectModifiers({ actorId: 'actor-123' });

      expect(result.totalFlat).toBe(0);
      expect(result.totalPercentage).toBe(1);
    });

    it('should sum flat modifiers correctly', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        actionConfig: {
          modifiers: [
            { value: 10, type: 'flat', tag: 'a' },
            { value: -5, type: 'flat', tag: 'b' },
            { value: 3, type: 'flat', tag: 'c' },
          ],
        },
      });

      expect(result.totalFlat).toBe(8);
    });

    it('should sum percentage modifiers additively from identity', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        actionConfig: {
          modifiers: [
            { value: 10, type: 'percentage', tag: 'a' },
            { value: 20, type: 'percentage', tag: 'b' },
          ],
        },
      });

      // Starts at 1 (identity), adds percentages
      expect(result.totalPercentage).toBe(31); // 1 + 10 + 20
    });

    it('should return proper structure with all required properties', () => {
      const result = service.collectModifiers({ actorId: 'actor-123' });

      expect(result).toHaveProperty('modifiers');
      expect(result).toHaveProperty('totalFlat');
      expect(result).toHaveProperty('totalPercentage');
      expect(Array.isArray(result.modifiers)).toBe(true);
      expect(typeof result.totalFlat).toBe('number');
      expect(typeof result.totalPercentage).toBe('number');
    });
  });

  describe('with optional parameters', () => {
    it('should accept all target parameters', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        primaryTargetId: 'primary-456',
        secondaryTargetId: 'secondary-789',
        tertiaryTargetId: 'tertiary-012',
        actionConfig: { modifiers: [] },
      });

      expect(result).toEqual({
        modifiers: [],
        totalFlat: 0,
        totalPercentage: 1,
      });
    });
  });

  describe('invariants', () => {
    it('should always return valid ModifierCollection structure', () => {
      const result = service.collectModifiers({ actorId: 'actor-123' });

      expect(result).toBeDefined();
      expect(result.modifiers).toBeInstanceOf(Array);
      expect(typeof result.totalFlat).toBe('number');
      expect(typeof result.totalPercentage).toBe('number');
    });

    it('should return consistent results for same input', () => {
      const input = { actorId: 'actor-123', primaryTargetId: 'target-456' };

      const result1 = service.collectModifiers(input);
      const result2 = service.collectModifiers(input);

      expect(result1).toEqual(result2);
    });

    it('should not modify entity state', () => {
      service.collectModifiers({
        actorId: 'actor-123',
        actionConfig: {
          modifiers: [{ value: 10, tag: 'test' }],
        },
      });

      // EntityManager should only be read, never written
      // The modifierContextBuilder does the reading
      expect(mockModifierContextBuilder.buildContext).toHaveBeenCalled();
    });
  });
});
