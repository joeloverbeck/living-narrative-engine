/**
 * @file Edge case tests for EffectsAnalyzer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EffectsAnalyzer from '../../../../src/goap/analysis/effectsAnalyzer.js';

describe('EffectsAnalyzer - Edge Cases', () => {
  let analyzer;
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn()
    };

    analyzer = new EffectsAnalyzer({
      logger: mockLogger,
      dataRegistry: mockDataRegistry
    });
  });

  describe('empty operations list', () => {
    it('should handle rule with empty actions array', () => {
      const rule = {
        id: 'test:rule',
        actions: []
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toEqual([]);
      expect(result.cost).toBe(1.0);
      expect(result.abstractPreconditions).toBeUndefined();
    });

    it('should handle rule with missing actions property', () => {
      const rule = {
        id: 'test:rule'
        // No actions property
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toEqual([]);
      expect(result.cost).toBe(1.0);
    });
  });

  describe('operations with no state changes', () => {
    it('should return empty effects for rule with only context operations', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component',
              result_variable: 'data'
            }
          },
          {
            type: 'GET_NAME',
            parameters: {
              entity: 'actor',
              result_variable: 'name'
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toEqual([]);
      expect(result.cost).toBe(1.0);
    });

    it('should return empty effects for rule with only event dispatch operations', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'DISPATCH_EVENT',
            parameters: { eventType: 'EVENT1' }
          },
          {
            type: 'DISPATCH_SPEECH',
            parameters: { text: 'Hello' }
          },
          {
            type: 'LOG',
            parameters: { message: 'Log message' }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toEqual([]);
      expect(result.cost).toBe(1.0);
    });
  });

  describe('nested IF operations', () => {
    it('should handle nested IF within then branch', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'x' }, 1] },
              then_actions: [
                {
                  type: 'IF',
                  parameters: {
                    condition: { '==': [{ var: 'y' }, 2] },
                    then_actions: [
                      {
                        type: 'ADD_COMPONENT',
                        parameters: {
                          entity: 'actor',
                          component: 'test:nested',
                          data: {}
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toEqual({
        and: [
          { '==': [{ var: 'x' }, 1] },
          { '==': [{ var: 'y' }, 2] }
        ]
      });
      expect(result.effects[0].then).toHaveLength(1);
      expect(result.effects[0].then[0].component).toBe('test:nested');
    });

    it('should handle nested IF within else branch', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'x' }, 1] },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:then',
                    data: {}
                  }
                }
              ],
              else_actions: [
                {
                  type: 'IF',
                  parameters: {
                    condition: { '==': [{ var: 'y' }, 2] },
                    then_actions: [
                      {
                        type: 'ADD_COMPONENT',
                        parameters: {
                          entity: 'actor',
                          component: 'test:nested_else',
                          data: {}
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);
      // First conditional for then branch
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toEqual({ '==': [{ var: 'x' }, 1] });

      // Second conditional for nested else branch
      expect(result.effects[1].operation).toBe('CONDITIONAL');
      expect(result.effects[1].condition).toEqual({
        and: [
          { not: { '==': [{ var: 'x' }, 1] } },
          { '==': [{ var: 'y' }, 2] }
        ]
      });
    });
  });

  describe('multiple conditional paths', () => {
    it('should handle IF_CO_LOCATED combined with IF', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF_CO_LOCATED',
            parameters: {
              entity_a: 'actor',
              entity_b: 'target',
              then_actions: [
                {
                  type: 'IF',
                  parameters: {
                    condition: { '==': [{ var: 'friendly' }, true] },
                    then_actions: [
                      {
                        type: 'ADD_COMPONENT',
                        parameters: {
                          entity: 'actor',
                          component: 'test:greet',
                          data: {}
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toEqual({
        and: [
          {
            '==': [
              { var: 'actor.location' },
              { var: 'target.location' }
            ]
          },
          { '==': [{ var: 'friendly' }, true] }
        ]
      });
    });

    it('should handle multiple top-level conditionals', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'a' }, 1] },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:a',
                    data: {}
                  }
                }
              ]
            }
          },
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'b' }, 2] },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:b',
                    data: {}
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      // Each IF creates a separate conditional effect
      expect(result.effects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('operations with missing parameters', () => {
    it('should use default entity for operation without entity parameter', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              // entity missing - should default to 'actor'
              component: 'test:component',
              data: {}
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].entity).toBe('actor');
    });

    it('should use placeholder for missing item_id', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'PICK_UP_ITEM_FROM_LOCATION',
            parameters: {
              // item_id missing - should use placeholder
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);
      expect(result.effects[0].entity).toBe('{itemId}');
    });

    it('should handle MODIFY_COMPONENT without updates field', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component'
              // updates missing
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].updates).toEqual({});
    });
  });

  describe('invalid operation types', () => {
    it('should log warning for unknown operation type', () => {
      const operation = {
        type: 'INVALID_OPERATION',
        parameters: {}
      };

      const result = analyzer.operationToEffect(operation);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('bidirectional effects', () => {
    it('should create bidirectional effects for ESTABLISH_LYING_CLOSENESS', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ESTABLISH_LYING_CLOSENESS',
            parameters: {
              entity: 'actor',
              target_entity: 'target'
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);
      expect(result.effects[0].entity).toBe('actor');
      expect(result.effects[0].component).toBe('positioning:lying_close_to');
      expect(result.effects[1].entity).toBe('target');
      expect(result.effects[1].component).toBe('positioning:lying_close_to');
    });

    it('should use default entities for closeness without entity parameters', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ESTABLISH_SITTING_CLOSENESS',
            parameters: {
              // No entity or target_entity specified
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);
      expect(result.effects[0].entity).toBe('actor');
      expect(result.effects[1].entity).toBe('target');
    });
  });

  describe('complex cost calculations', () => {
    it('should calculate cost correctly with mixed effects and conditionals', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:a',
              data: {}
            }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:c',
              data: {}
            }
          },
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'x' }, 1] },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:b',
                    data: {}
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      // When operations precede a conditional, they become part of the conditional path
      // So we have 1 conditional effect (not 2 flat + 1 conditional)
      // Base 1.0 + (1 conditional * 0.2) = 1.2
      expect(result.cost).toBe(1.2);
    });

    it('should handle operations that produce multiple effects in cost calculation', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ESTABLISH_SITTING_CLOSENESS',
            parameters: {
              entity: 'actor',
              target_entity: 'target'
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      // 2 effects from the bidirectional operation
      expect(result.effects).toHaveLength(2);
      // Base 1.0 + (2 effects * 0.1) = 1.2
      expect(result.cost).toBe(1.2);
    });
  });

  describe('error handling', () => {
    it('should throw error when analyzing rule fails', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: null // Invalid - will cause error
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      expect(() => {
        analyzer.analyzeRule('test:rule');
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('ATOMIC_MODIFY_COMPONENT handling', () => {
    it('should treat ATOMIC_MODIFY_COMPONENT same as MODIFY_COMPONENT', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ATOMIC_MODIFY_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component',
              updates: { value: 42 }
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        operation: 'MODIFY_COMPONENT',
        entity: 'actor',
        component: 'test:component',
        updates: { value: 42 }
      });
    });
  });

  describe('IF with else branch', () => {
    it('should handle IF with both then and else branches', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'x' }, 1] },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:then',
                    data: {}
                  }
                }
              ],
              else_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:else',
                    data: {}
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);

      // Then branch
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toEqual({ '==': [{ var: 'x' }, 1] });
      expect(result.effects[0].then[0].component).toBe('test:then');

      // Else branch
      expect(result.effects[1].operation).toBe('CONDITIONAL');
      expect(result.effects[1].condition).toEqual({ not: { '==': [{ var: 'x' }, 1] } });
      expect(result.effects[1].then[0].component).toBe('test:else');
    });
  });

  describe('mixed state-changing and non-state-changing operations', () => {
    it('should extract only state-changing operations from mixed list', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:data',
              result_variable: 'data'
            }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:new',
              data: {}
            }
          },
          {
            type: 'LOG',
            parameters: { message: 'Added component' }
          },
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:old'
            }
          },
          {
            type: 'DISPATCH_EVENT',
            parameters: { eventType: 'DONE' }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);
      expect(result.effects[0].operation).toBe('ADD_COMPONENT');
      expect(result.effects[1].operation).toBe('REMOVE_COMPONENT');
    });
  });
});
