/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

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
        'JsonLogicCustomOperators: Custom JSON Logic operators registered successfully'
      );
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
});
