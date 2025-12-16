/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';

describe('actor-mouth-available condition', () => {
  let jsonLogicService;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let mockLightingStateService;
  let customOperators;

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

    mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
      lightingStateService: mockLightingStateService,
    });

    customOperators.registerOperators(jsonLogicService);
  });

  describe('Mouth Available Cases', () => {
    test('should return true when mouth is explicitly unlocked', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'actor123') {
            return { root: 'body123' };
          }
          if (componentId === 'anatomy:part' && entityId === 'mouth-part-123') {
            return { subType: 'mouth' };
          }
          if (
            componentId === 'core:mouth_engagement' &&
            entityId === 'mouth-part-123'
          ) {
            return { locked: false };
          }
          return null;
        }
      );

      // Mock finding mouth parts
      mockBodyGraphService.findPartsByType.mockReturnValue(['mouth-part-123']);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      // Test the actual condition logic
      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(true);
    });

    test('should return true when mouth has no engagement component', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'actor123') {
            return { root: 'body123' };
          }
          if (componentId === 'anatomy:part' && entityId === 'mouth-part-123') {
            return { subType: 'mouth' };
          }
          if (
            componentId === 'core:mouth_engagement' &&
            entityId === 'mouth-part-123'
          ) {
            return null; // No engagement component
          }
          return null;
        }
      );

      // Mock finding mouth parts
      mockBodyGraphService.findPartsByType.mockReturnValue(['mouth-part-123']);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(true);
    });
  });

  describe('Mouth Unavailable Cases', () => {
    test('should return false when mouth is locked', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'actor123') {
            return { root: 'body123' };
          }
          if (componentId === 'anatomy:part' && entityId === 'mouth-part-123') {
            return { subType: 'mouth' };
          }
          if (
            componentId === 'core:mouth_engagement' &&
            entityId === 'mouth-part-123'
          ) {
            return { locked: true }; // Mouth is locked
          }
          return null;
        }
      );

      // Mock finding mouth parts
      mockBodyGraphService.findPartsByType.mockReturnValue(['mouth-part-123']);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(false);
    });

    test('should return true when entity has no mouth part', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'actor123') {
            return { root: 'body123' };
          }
          return null;
        }
      );

      // Mock no mouth parts found
      mockBodyGraphService.findPartsByType.mockReturnValue([]);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogic = {
        or: [
          {
            not: {
              hasPartOfType: ['actor', 'mouth'],
            },
          },
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(true);
    });

    test('should return false when entity has no anatomy', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock no anatomy:body component
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(false);
    });

    test('should return false when actor is missing', () => {
      const context = {};

      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple mouth parts correctly (one available)', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'actor123') {
            return { root: 'body123' };
          }
          if (componentId === 'anatomy:part') {
            if (entityId === 'mouth-part-1' || entityId === 'mouth-part-2') {
              return { subType: 'mouth' };
            }
          }
          if (componentId === 'core:mouth_engagement') {
            if (entityId === 'mouth-part-1') {
              return { locked: true }; // First mouth is locked
            }
            if (entityId === 'mouth-part-2') {
              return { locked: false }; // Second mouth is unlocked
            }
          }
          return null;
        }
      );

      // Mock finding multiple mouth parts
      mockBodyGraphService.findPartsByType.mockReturnValue([
        'mouth-part-1',
        'mouth-part-2',
      ]);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      expect(result).toBe(true); // At least one mouth is available
    });

    test('should work with nested entity paths', () => {
      const context = {
        event: {
          target: {
            id: 'npc456',
          },
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'npc456') {
            return { root: 'body456' };
          }
          if (componentId === 'anatomy:part' && entityId === 'mouth-part-456') {
            return { subType: 'mouth' };
          }
          if (
            componentId === 'core:mouth_engagement' &&
            entityId === 'mouth-part-456'
          ) {
            return { locked: false };
          }
          return null;
        }
      );

      // Mock finding mouth parts
      mockBodyGraphService.findPartsByType.mockReturnValue(['mouth-part-456']);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogicWithNestedPath = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'event.target',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['event.target', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'event.target',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(
        conditionLogicWithNestedPath,
        context
      );
      expect(result).toBe(true);
    });

    test('should handle malformed engagement component gracefully', () => {
      const context = {
        actor: {
          id: 'actor123',
        },
      };

      // Mock the anatomy:body component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body' && entityId === 'actor123') {
            return { root: 'body123' };
          }
          if (componentId === 'anatomy:part' && entityId === 'mouth-part-123') {
            return { subType: 'mouth' };
          }
          if (
            componentId === 'core:mouth_engagement' &&
            entityId === 'mouth-part-123'
          ) {
            return { locked: 'yes' }; // Invalid type for locked
          }
          return null;
        }
      );

      // Mock finding mouth parts
      mockBodyGraphService.findPartsByType.mockReturnValue(['mouth-part-123']);
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue();

      const conditionLogic = {
        or: [
          {
            hasPartOfTypeWithComponentValue: [
              'actor',
              'mouth',
              'core:mouth_engagement',
              'locked',
              false,
            ],
          },
          {
            and: [
              {
                hasPartOfType: ['actor', 'mouth'],
              },
              {
                not: {
                  hasPartOfTypeWithComponentValue: [
                    'actor',
                    'mouth',
                    'core:mouth_engagement',
                    'locked',
                    true,
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = jsonLogicService.evaluate(conditionLogic, context);
      // When locked is 'yes' (string), it's not === false, but also not === true
      // The second branch (hasPartOfType returns true, but NOT hasPartOfTypeWithComponentValue for locked:true also returns true)
      // So the condition returns true (mouth exists and is not explicitly locked with boolean true)
      expect(result).toBe(true);
    });
  });
});
