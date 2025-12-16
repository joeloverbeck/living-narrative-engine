/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { HasSittingSpaceToRightOperator } from '../../../src/logic/operators/hasSittingSpaceToRightOperator.js';
import { CanScootCloserOperator } from '../../../src/logic/operators/canScootCloserOperator.js';
import { IsClosestLeftOccupantOperator } from '../../../src/logic/operators/isClosestLeftOccupantOperator.js';
import { IsClosestRightOccupantOperator } from '../../../src/logic/operators/isClosestRightOccupantOperator.js';
import { IsSocketCoveredOperator } from '../../../src/logic/operators/isSocketCoveredOperator.js';
import { SocketExposureOperator } from '../../../src/logic/operators/socketExposureOperator.js';
import { HasOtherActorsAtLocationOperator } from '../../../src/logic/operators/hasOtherActorsAtLocationOperator.js';
import { IsRemovalBlockedOperator } from '../../../src/logic/operators/isRemovalBlockedOperator.js';
import { HasComponentOperator } from '../../../src/logic/operators/hasComponentOperator.js';
import { HasWoundedPartOperator } from '../../../src/logic/operators/hasWoundedPartOperator.js';
import { HasPartWithStatusEffectOperator } from '../../../src/logic/operators/hasPartWithStatusEffectOperator.js';
import { IsBodyPartAccessibleOperator } from '../../../src/logic/operators/isBodyPartAccessibleOperator.js';
import { IsNearbyFurnitureOperator } from '../../../src/logic/operators/isNearbyFurnitureOperator.js';
import { CanActorGrabItemOperator } from '../../../src/logic/operators/canActorGrabItemOperator.js';
import { IsItemBeingGrabbedOperator } from '../../../src/logic/operators/isItemBeingGrabbedOperator.js';
import { GetSkillValueOperator } from '../../../src/logic/operators/getSkillValueOperator.js';
import { HasDamageCapabilityOperator } from '../../../src/logic/operators/hasDamageCapabilityOperator.js';
import { IsBodyPartWoundedOperator } from '../../../src/logic/operators/isBodyPartWoundedOperator.js';
import { HasPartSubTypeContainingOperator } from '../../../src/logic/operators/hasPartSubTypeContainingOperator.js';
import { HasFreeGrabbingAppendagesOperator } from '../../../src/logic/operators/hasFreeGrabbingAppendagesOperator.js';

describe('JsonLogicCustomOperators', () => {
  let customOperators;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let jsonLogicService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
      hasWoundedPart: jest.fn(),
      hasPartWithStatusEffect: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
    });

    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(customOperators).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JsonLogicCustomOperators: JsonLogicCustomOperators initialized'
      );
    });

    test('should throw error when missing dependencies', () => {
      expect(() => new JsonLogicCustomOperators({})).toThrow();
    });
  });

  describe('registerOperators', () => {
    test('should register hasPartWithComponentValue operator', () => {
      customOperators.registerOperators(jsonLogicService);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JsonLogicCustomOperators: Registering custom JSON Logic operators'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'JsonLogicCustomOperators: Custom JSON Logic operators registered successfully',
        expect.objectContaining({
          count: expect.any(Number),
          operators: expect.any(Array),
        })
      );
    });
  });

  describe('operator registration delegates to evaluate implementations', () => {
    let operations;
    let evaluationService;

    beforeEach(() => {
      operations = {};
      evaluationService = {
        addOperation: jest.fn((name, handler) => {
          operations[name] = handler;
        }),
        getAllowedOperations: jest.fn(() => {
          return new Set(Object.keys(operations));
        }),
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test.each([
      {
        operatorName: 'isSocketCovered',
        operatorClass: IsSocketCoveredOperator,
        invocationArgs: ['actor.path', 'socket-1'],
        expectedParams: ['actor.path', 'socket-1'],
      },
      {
        operatorName: 'socketExposure',
        operatorClass: SocketExposureOperator,
        invocationArgs: ['actor.path', ['socket-1'], 'all', true, false],
        expectedParams: ['actor.path', ['socket-1'], 'all', true, false],
      },
      {
        operatorName: 'hasSittingSpaceToRight',
        operatorClass: HasSittingSpaceToRightOperator,
        invocationArgs: ['entity.path', 'target.path', 3],
        expectedParams: ['entity.path', 'target.path', 3],
      },
      {
        operatorName: 'canScootCloser',
        operatorClass: CanScootCloserOperator,
        invocationArgs: ['entity.path', 'target.path'],
        expectedParams: ['entity.path', 'target.path'],
      },
      {
        operatorName: 'isClosestLeftOccupant',
        operatorClass: IsClosestLeftOccupantOperator,
        invocationArgs: ['candidate.path', 'target.path', 'actor.path'],
        expectedParams: ['candidate.path', 'target.path', 'actor.path'],
      },
      {
        operatorName: 'isClosestRightOccupant',
        operatorClass: IsClosestRightOccupantOperator,
        invocationArgs: ['candidate.path', 'target.path', 'actor.path'],
        expectedParams: ['candidate.path', 'target.path', 'actor.path'],
      },
      {
        operatorName: 'hasOtherActorsAtLocation',
        operatorClass: HasOtherActorsAtLocationOperator,
        invocationArgs: ['entity.path'],
        expectedParams: ['entity.path'],
      },
      {
        operatorName: 'isRemovalBlocked',
        operatorClass: IsRemovalBlockedOperator,
        invocationArgs: ['actor.path', 'item.path'],
        expectedParams: ['actor.path', 'item.path'],
      },
      {
        operatorName: 'has_component',
        operatorClass: HasComponentOperator,
        invocationArgs: ['entity.path', 'component:name'],
        expectedParams: ['entity.path', 'component:name'],
      },
      {
        operatorName: 'hasWoundedPart',
        operatorClass: HasWoundedPartOperator,
        invocationArgs: ['actor.path', {}],
        expectedParams: ['actor.path', {}],
      },
      {
        operatorName: 'hasPartWithStatusEffect',
        operatorClass: HasPartWithStatusEffectOperator,
        invocationArgs: [
          'actor.path',
          'anatomy:bleeding',
          'severity',
          { op: '===', value: 'moderate' },
        ],
        expectedParams: [
          'actor.path',
          'anatomy:bleeding',
          'severity',
          { op: '===', value: 'moderate' },
        ],
      },
      {
        operatorName: 'isBodyPartAccessible',
        operatorClass: IsBodyPartAccessibleOperator,
        invocationArgs: ['actor.path', 'part-entity-ref', { checkSlots: true }],
        expectedParams: ['actor.path', 'part-entity-ref', { checkSlots: true }],
      },
      {
        operatorName: 'isNearbyFurniture',
        operatorClass: IsNearbyFurnitureOperator,
        invocationArgs: ['entity-id'],
        expectedParams: ['entity-id'],
      },
      {
        operatorName: 'canActorGrabItem',
        operatorClass: CanActorGrabItemOperator,
        invocationArgs: ['actor.path', 'item.path'],
        expectedParams: ['actor.path', 'item.path'],
      },
      {
        operatorName: 'isItemBeingGrabbed',
        operatorClass: IsItemBeingGrabbedOperator,
        invocationArgs: ['actor.path', 'item.path'],
        expectedParams: ['actor.path', 'item.path'],
      },
      {
        operatorName: 'getSkillValue',
        operatorClass: GetSkillValueOperator,
        invocationArgs: ['actor.path', 'skills:combat', 'melee', 0],
        expectedParams: ['actor.path', 'skills:combat', 'melee', 0],
      },
      {
        operatorName: 'has_damage_capability',
        operatorClass: HasDamageCapabilityOperator,
        invocationArgs: ['entity.path', 'slashing'],
        expectedParams: ['entity.path', 'slashing'],
      },
      {
        operatorName: 'isBodyPartWounded',
        operatorClass: IsBodyPartWoundedOperator,
        invocationArgs: ['actor.path', 'part-ref', { minSeverity: 'moderate' }],
        expectedParams: ['actor.path', 'part-ref', { minSeverity: 'moderate' }],
      },
      {
        operatorName: 'hasPartSubTypeContaining',
        operatorClass: HasPartSubTypeContainingOperator,
        invocationArgs: ['actor.path', 'humanoid', { caseSensitive: false }],
        expectedParams: ['actor.path', 'humanoid', { caseSensitive: false }],
      },
      {
        operatorName: 'hasFreeGrabbingAppendages',
        operatorClass: HasFreeGrabbingAppendagesOperator,
        invocationArgs: ['actor.path', 2],
        expectedParams: ['actor.path', 2],
      },
    ])(
      'delegates %s evaluation to operator instance',
      ({ operatorName, operatorClass, invocationArgs, expectedParams }) => {
        const evaluateReturn = `result-${operatorName}`;
        const evaluateSpy = jest
          .spyOn(operatorClass.prototype, 'evaluate')
          .mockReturnValue(evaluateReturn);

        customOperators.registerOperators(evaluationService);

        expect(evaluationService.addOperation).toHaveBeenCalledWith(
          operatorName,
          expect.any(Function)
        );

        const context = { label: 'ctx' };
        const operation = operations[operatorName];
        expect(operation).toBeInstanceOf(Function);

        const result = operation.call(context, ...invocationArgs);

        expect(result).toBe(evaluateReturn);
        expect(evaluateSpy).toHaveBeenCalledWith(expectedParams, context);
      }
    );
  });

  describe('getRegisteredOperators', () => {
    test('should return a set of registered operator names after registerOperators is called', () => {
      customOperators.registerOperators(jsonLogicService);

      const registeredOps = customOperators.getRegisteredOperators();

      expect(registeredOps).toBeInstanceOf(Set);
      expect(registeredOps.size).toBeGreaterThan(0);
      // Verify some expected operators are registered
      expect(registeredOps.has('hasPartWithComponentValue')).toBe(true);
      expect(registeredOps.has('has_component')).toBe(true);
      expect(registeredOps.has('get_component_value')).toBe(true);
    });

    test('should return empty set before registerOperators is called', () => {
      // Create fresh instance without calling registerOperators
      const freshOperators = new JsonLogicCustomOperators({
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
        entityManager: mockEntityManager,
      });

      const registeredOps = freshOperators.getRegisteredOperators();

      expect(registeredOps).toBeInstanceOf(Set);
      expect(registeredOps.size).toBe(0);
    });
  });

  describe('clearCaches', () => {
    test('logs when no socket coverage operator is registered', () => {
      mockLogger.debug.mockClear();

      customOperators.clearCaches();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JsonLogicCustomOperators: Clearing custom operator caches'
      );
    });

    test('clears socket coverage cache when operator exists', () => {
      customOperators.registerOperators(jsonLogicService);

      const clearCacheSpy = jest.spyOn(
        customOperators.isSocketCoveredOp,
        'clearCache'
      );

      mockLogger.debug.mockClear();

      customOperators.clearCaches();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JsonLogicCustomOperators: Clearing custom operator caches'
      );
      expect(clearCacheSpy).toHaveBeenCalledTimes(1);

      clearCacheSpy.mockRestore();
    });
  });

  describe('hasPartWithComponentValue operator', () => {
    beforeEach(() => {
      customOperators.registerOperators(jsonLogicService);
    });

    test('should return true when entity has matching part', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg123',
      });

      const rule = {
        hasPartWithComponentValue: [
          'actor',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player123',
        'anatomy:body'
      );
      expect(
        mockBodyGraphService.hasPartWithComponentValue
      ).toHaveBeenCalledWith(
        { root: 'body123' },
        'descriptors:build',
        'build',
        'muscular'
      );
    });

    test('should return false when entity has no matching part', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: false,
      });

      const rule = {
        hasPartWithComponentValue: [
          'actor',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should return false when entity has no body component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const rule = {
        hasPartWithComponentValue: [
          'actor',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should return false when entity path is invalid', () => {
      const context = {
        actor: null,
      };

      const rule = {
        hasPartWithComponentValue: [
          'actor',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should handle nested entity paths', () => {
      const context = {
        event: {
          target: {
            id: 'npc456',
            components: {},
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body456',
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg456',
      });

      const rule = {
        hasPartWithComponentValue: [
          'event.target',
          'descriptors:build',
          'build',
          'shapely',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc456',
        'anatomy:body'
      );
    });

    test('should handle errors gracefully', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const rule = {
        hasPartWithComponentValue: [
          'actor',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });
  });

  describe('hasPartOfType operator', () => {
    beforeEach(() => {
      customOperators.registerOperators(jsonLogicService);
    });

    test('should return true when entity has parts of the specified type', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        body: { root: 'body123' },
      });

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg1', 'leg2']);

      const rule = {
        hasPartOfType: ['actor', 'leg'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player123',
        'anatomy:body'
      );
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'leg'
      );
    });

    test('should return false when entity has no parts of the specified type', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        body: { root: 'body123' },
      });

      mockBodyGraphService.findPartsByType.mockReturnValue([]);

      const rule = {
        hasPartOfType: ['actor', 'wing'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'wing'
      );
    });

    test('should handle direct root structure in body component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      // Direct root structure (without nested body object)
      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      mockBodyGraphService.findPartsByType.mockReturnValue(['arm1']);

      const rule = {
        hasPartOfType: ['actor', 'arm'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'arm'
      );
    });

    test('should return false when entity has no body component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const rule = {
        hasPartOfType: ['actor', 'leg'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockBodyGraphService.findPartsByType).not.toHaveBeenCalled();
    });

    test('should return false when body component has no root', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        // No root property
      });

      const rule = {
        hasPartOfType: ['actor', 'leg'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockBodyGraphService.findPartsByType).not.toHaveBeenCalled();
    });

    test('should return false when entity path is invalid', () => {
      const context = {
        actor: null,
      };

      const rule = {
        hasPartOfType: ['actor', 'leg'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should handle nested entity paths', () => {
      const context = {
        event: {
          target: {
            id: 'npc456',
            components: {},
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body456',
      });

      mockBodyGraphService.findPartsByType.mockReturnValue(['head1']);

      const rule = {
        hasPartOfType: ['event.target', 'head'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc456',
        'anatomy:body'
      );
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body456'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body456',
        'head'
      );
    });

    test('should handle errors gracefully', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const rule = {
        hasPartOfType: ['actor', 'leg'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should work with multiple part types in complex rules', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      // First call for 'leg' check
      mockBodyGraphService.findPartsByType
        .mockReturnValueOnce(['leg1', 'leg2']) // has legs
        .mockReturnValueOnce([]); // no wings

      const rule = {
        and: [
          { hasPartOfType: ['actor', 'leg'] },
          { '!': { hasPartOfType: ['actor', 'wing'] } },
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'leg'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'wing'
      );
    });
  });

  describe('hasPartOfTypeWithComponentValue operator', () => {
    beforeEach(() => {
      customOperators.registerOperators(jsonLogicService);
    });

    test('should return true when entity has part of specified type with matching component value', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'muscular' }) // descriptors:build for leg1
        .mockReturnValueOnce({ build: 'normal' }); // descriptors:build for leg2

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg1', 'leg2']);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player123',
        'anatomy:body'
      );
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'leg'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg1',
        'descriptors:build'
      );
    });

    test('should return false when no parts of type have matching component value', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'normal' }) // descriptors:build for leg1
        .mockReturnValueOnce({ build: 'thin' }); // descriptors:build for leg2

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg1', 'leg2']);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'leg'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg1',
        'descriptors:build'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg2',
        'descriptors:build'
      );
    });

    test('should return false when entity has no parts of specified type', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({ root: 'body123' });
      mockBodyGraphService.findPartsByType.mockReturnValue([]);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'wing',
          'descriptors:build',
          'build',
          'feathered',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'wing'
      );
    });

    test('should handle nested property paths', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({
          // component data for leg1
          appearance: {
            texture: 'smooth',
          },
        });

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg1']);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:appearance',
          'appearance.texture',
          'smooth',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg1',
        'descriptors:appearance'
      );
    });

    test('should handle missing component on parts', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce(null) // no descriptors:build for leg1
        .mockReturnValueOnce({ build: 'shapely' }); // descriptors:build for leg2

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg1', 'leg2']);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'shapely',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'body123'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg1',
        'descriptors:build'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg2',
        'descriptors:build'
      );
    });

    test('should return false when entity has no body component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should return false when body component has no root', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        // No root property
      });

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should handle nested entity paths', () => {
      const context = {
        event: {
          target: {
            id: 'npc456',
            components: {},
          },
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ body: { root: 'body456' } }) // anatomy:body with nested structure
        .mockReturnValueOnce({ build: 'muscular' }); // descriptors:build for arm1

      mockBodyGraphService.findPartsByType.mockReturnValue(['arm1']);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'event.target',
          'arm',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc456',
        'anatomy:body'
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body456',
        'arm'
      );
    });

    test('should return false when entity path is invalid', () => {
      const context = {
        actor: null,
      };

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should handle errors gracefully', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should work correctly when checking shapely legs', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'shapely' }) // descriptors:build for leg1
        .mockReturnValueOnce({ build: 'shapely' }); // descriptors:build for leg2

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg1', 'leg2']);

      const rule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'shapely',
        ],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
    });

    test('should differentiate between part types correctly', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      // First evaluation - checking legs
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'normal' }) // descriptors:build for leg1
        .mockReturnValueOnce({ build: 'normal' }); // descriptors:build for leg2

      mockBodyGraphService.findPartsByType.mockReturnValueOnce([
        'leg1',
        'leg2',
      ]);

      // Even though the actor has muscular arms, this should return false
      // because we're specifically checking legs
      const legRule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'leg',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const legResult = jsonLogicService.evaluate(legRule, context);
      expect(legResult).toBe(false);

      // Now check arms
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'muscular' }); // descriptors:build for arm1

      mockBodyGraphService.findPartsByType.mockReturnValueOnce(['arm1']);

      const armRule = {
        hasPartOfTypeWithComponentValue: [
          'actor',
          'arm',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };

      const armResult = jsonLogicService.evaluate(armRule, context);
      expect(armResult).toBe(true);
    });
  });

  describe('isSlotExposed operator (layered coverage)', () => {
    beforeEach(() => {
      customOperators.registerOperators(jsonLogicService);
    });

    test('should return false when slot has clothing in any specified layer', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
            outer: 'jacket456',
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(equipmentData);

      const rule = {
        isSlotExposed: ['actor', 'torso_upper', ['base', 'outer', 'armor']],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player123',
        'clothing:equipment'
      );
    });

    test('should return true when no clothing exists in the provided layers', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(equipmentData);

      const rule = {
        isSlotExposed: ['actor', 'torso_upper', ['outer']],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
    });

    test('should log warning and fall back to defaults on invalid layer name', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(equipmentData);

      const rule = {
        isSlotExposed: ['actor', 'torso_upper', ['invalid_layer']],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
      // Check that the specific warning was called (among potentially other warnings)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "isSlotExposed: Invalid layer name 'invalid_layer'. Valid layers: underwear, base, outer, accessories, armor"
        )
      );
    });

    test('should treat accessories array as covering when included explicitly', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      const equipmentData = {
        equipped: {
          hands: {
            accessories: ['gloves123', 'rings456'],
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(equipmentData);

      const rule = {
        isSlotExposed: ['actor', 'hands', ['accessories']],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(false);
    });

    test('should return true for empty accessories layer when explicitly checked', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      const equipmentData = {
        equipped: {
          hands: {
            accessories: [],
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(equipmentData);

      const rule = {
        isSlotExposed: ['actor', 'hands', ['accessories']],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(true);
    });
  });

  describe('get_component_value operator', () => {
    beforeEach(() => {
      customOperators.registerOperators(jsonLogicService);
    });

    test('should return component data when entity has id property', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      const componentData = { health: 100, mana: 50 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      // Use { var: 'actor' } to resolve the entity object from context
      const rule = {
        get_component_value: [{ var: 'actor' }, 'stats:health'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toEqual(componentData);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player123',
        'stats:health'
      );
    });

    test('should return component data when entity is a string ID', () => {
      const context = {
        entityId: 'npc456',
      };

      const componentData = { name: 'Test NPC' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: [{ var: 'entityId' }, 'core:identity'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toEqual(componentData);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc456',
        'core:identity'
      );
    });

    test('should return component data when entity is a number ID', () => {
      const context = {
        entityId: 12345,
      };

      const componentData = { value: 42 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: [{ var: 'entityId' }, 'core:data'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toEqual(componentData);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        12345,
        'core:data'
      );
    });

    test('should return null when entity has null ID', () => {
      const context = {
        actor: {
          id: null,
        },
      };

      // Use { var: 'actor' } to resolve the entity object from context
      const rule = {
        get_component_value: [{ var: 'actor' }, 'stats:health'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return null when entity has undefined ID', () => {
      const context = {
        actor: {
          id: undefined,
        },
      };

      // Use { var: 'actor' } to resolve the entity object from context
      const rule = {
        get_component_value: [{ var: 'actor' }, 'stats:health'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return null when component data is null', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const rule = {
        get_component_value: ['actor', 'nonexistent:component'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
    });

    test('should return null when component data is not an object (primitive)', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      mockEntityManager.getComponentData.mockReturnValue('string-value');

      const rule = {
        get_component_value: ['actor', 'some:component'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
    });

    test('should return full component data when no property path provided', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = { health: 100, mana: 50, stamina: 75 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'stats:attributes'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toEqual(componentData);
    });

    test('should return full component data when property path is null', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = { value: 42 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'core:data', null],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toEqual(componentData);
    });

    test('should return full component data when property path is not a string', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = { value: 42 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'core:data', 123],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toEqual(componentData);
    });

    test('should resolve simple property path', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = { health: 100, mana: 50 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'stats:attributes', 'health'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(100);
    });

    test('should resolve nested property path', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = {
        stats: {
          combat: {
            attack: 25,
            defense: 15,
          },
        },
      };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'game:stats', 'stats.combat.attack'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBe(25);
    });

    test('should return null for non-existent property path', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = { health: 100 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'stats:attributes', 'nonexistent'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
    });

    test('should return null for non-existent nested property path', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      const componentData = {
        stats: {
          health: 100,
        },
      };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      const rule = {
        get_component_value: ['actor', 'game:stats', 'stats.combat.attack'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
    });

    test('should return null when entity path resolves to null', () => {
      const context = {
        actor: null,
      };

      const rule = {
        get_component_value: ['actor', 'stats:health'],
      };

      const result = jsonLogicService.evaluate(rule, context);

      expect(result).toBeNull();
    });
  });
});
