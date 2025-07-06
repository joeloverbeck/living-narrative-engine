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
      error: jest.fn()
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn()
    };

    mockEntityManager = {
      getComponentData: jest.fn()
    };

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager
    });

    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger
    });
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(customOperators).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('JsonLogicCustomOperators: JsonLogicCustomOperators initialized');
    });

    test('should throw error when missing dependencies', () => {
      expect(() => new JsonLogicCustomOperators({})).toThrow();
    });
  });

  describe('registerOperators', () => {
    test('should register hasPartWithComponentValue operator', () => {
      customOperators.registerOperators(jsonLogicService);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('JsonLogicCustomOperators: Registering custom JSON Logic operators');
      expect(mockLogger.info).toHaveBeenCalledWith('JsonLogicCustomOperators: Custom JSON Logic operators registered successfully');
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
          components: {}
        }
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg123'
      });

      const rule = {
        hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'muscular']
      };

      const result = jsonLogicService.evaluate(rule, context);
      
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('player123', 'anatomy:body');
      expect(mockBodyGraphService.hasPartWithComponentValue).toHaveBeenCalledWith(
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
          components: {}
        }
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: false
      });

      const rule = {
        hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'muscular']
      };

      const result = jsonLogicService.evaluate(rule, context);
      
      expect(result).toBe(false);
    });

    test('should return false when entity has no body component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {}
        }
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const rule = {
        hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'muscular']
      };

      const result = jsonLogicService.evaluate(rule, context);
      
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('JsonLogicCustomOperators: Entity player123 has no anatomy:body component');
    });

    test('should return false when entity path is invalid', () => {
      const context = {
        actor: null
      };

      const rule = {
        hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'muscular']
      };

      const result = jsonLogicService.evaluate(rule, context);
      
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('JsonLogicCustomOperators: No entity found at path actor');
    });

    test('should handle nested entity paths', () => {
      const context = {
        event: {
          target: {
            id: 'npc456',
            components: {}
          }
        }
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body456'
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg456'
      });

      const rule = {
        hasPartWithComponentValue: ['event.target', 'descriptors:build', 'build', 'shapely']
      };

      const result = jsonLogicService.evaluate(rule, context);
      
      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('npc456', 'anatomy:body');
    });

    test('should handle errors gracefully', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {}
        }
      };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const rule = {
        hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'muscular']
      };

      const result = jsonLogicService.evaluate(rule, context);
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'JsonLogicCustomOperators: Error in hasPartWithComponentValue operator',
        expect.any(Error)
      );
    });
  });
});