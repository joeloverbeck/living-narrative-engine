/**
 * @file Unit tests for ParameterResolutionService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ParameterResolutionService from '../../../../src/goap/services/parameterResolutionService.js';
import ParameterResolutionError from '../../../../src/goap/errors/parameterResolutionError.js';

describe('ParameterResolutionService - Constructor', () => {
  it('should create service with valid dependencies', () => {
    const mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => {},
    };
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    expect(service).toBeInstanceOf(ParameterResolutionService);
  });

  it('should throw error if entityManager is missing', () => {
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    expect(() => {
      new ParameterResolutionService({
        entityManager: null,
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should throw error if logger is missing', () => {
    const mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => {},
    };

    expect(() => {
      new ParameterResolutionService({
        entityManager: mockEntityManager,
        logger: null,
      });
    }).toThrow();
  });

  it('should validate entityManager has required methods', () => {
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    expect(() => {
      new ParameterResolutionService({
        entityManager: {}, // Missing required methods
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should validate logger has required methods', () => {
    const mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => {},
    };

    expect(() => {
      new ParameterResolutionService({
        entityManager: mockEntityManager,
        logger: {}, // Missing required methods
      });
    }).toThrow();
  });
});

describe('ParameterResolutionService - Simple Parameter Resolution', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => true,
    };
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      task: {
        id: 'task_1',
        params: {
          item: 'apple_7',
          location: 'room_12',
        },
      },
      refinement: {
        localState: {
          step1Result: { success: true },
          pickedItem: 'apple_7',
        },
      },
      actor: {
        id: 'player_1',
        components: {
          'core:health': { value: 50, max: 100 },
          'core:position': { room: 'room_12' },
        },
      },
      world: {
        locations: {},
        time: {},
      },
    };
  });

  it('should resolve task.params.item to entity ID', () => {
    const result = service.resolve('task.params.item', context, {
      validateEntity: false,
    });
    expect(result).toBe('apple_7');
  });

  it('should resolve actor.id to actor ID', () => {
    const result = service.resolve('actor.id', context, {
      validateEntity: false,
    });
    expect(result).toBe('player_1');
  });

  it('should resolve refinement.localState.step1Result to stored result', () => {
    const result = service.resolve(
      'refinement.localState.step1Result',
      context,
      {
        validateEntity: false,
      }
    );
    expect(result).toEqual({ success: true });
  });

  it('should resolve task.params.location to room ID', () => {
    const result = service.resolve('task.params.location', context, {
      validateEntity: false,
    });
    expect(result).toBe('room_12');
  });

  it('should resolve refinement.localState.pickedItem to item ID', () => {
    const result = service.resolve(
      'refinement.localState.pickedItem',
      context,
      {
        validateEntity: false,
      }
    );
    expect(result).toBe('apple_7');
  });
});

describe('ParameterResolutionService - Property Path Navigation', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => true,
    };
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      actor: {
        id: 'player_1',
        components: {
          'core:health': { value: 50, max: 100 },
          'core:position': { room: 'room_12', x: 10, y: 20 },
          'items:inventory': {
            slots: [
              { id: 'apple_7', slot: 0 },
              { id: 'sword_3', slot: 1 },
            ],
          },
        },
      },
    };
  });

  it('should resolve nested path with namespaced component ID', () => {
    const result = service.resolve(
      'actor.components.core:health.value',
      context,
      {
        validateEntity: false,
      }
    );
    expect(result).toBe(50);
  });

  it('should resolve multiple levels deep', () => {
    const result = service.resolve(
      'actor.components.core:position.room',
      context,
      {
        validateEntity: false,
      }
    );
    expect(result).toBe('room_12');
  });

  it('should handle namespaced component with multiple properties', () => {
    const result = service.resolve(
      'actor.components.core:position.x',
      context,
      {
        validateEntity: false,
      }
    );
    expect(result).toBe(10);
  });

  it('should handle complex nested structures', () => {
    const result = service.resolve(
      'actor.components.items:inventory.slots',
      context,
      {
        validateEntity: false,
      }
    );
    expect(result).toEqual([
      { id: 'apple_7', slot: 0 },
      { id: 'sword_3', slot: 1 },
    ]);
  });

  it('should preserve colons in component IDs', () => {
    // Verify that core:health is treated as single key, not core.health
    const healthComponent = context.actor.components['core:health'];
    expect(healthComponent).toBeDefined();
    expect(healthComponent.value).toBe(50);

    const result = service.resolve('actor.components.core:health', context, {
      validateEntity: false,
    });
    expect(result).toEqual({ value: 50, max: 100 });
  });
});

describe('ParameterResolutionService - Error Handling', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => true,
    };
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      task: {
        params: {
          item: 'apple_7',
        },
      },
      actor: {
        id: 'player_1',
        components: {
          'core:health': { value: 50 },
        },
      },
    };
  });

  it('should throw ParameterResolutionError for missing path', () => {
    expect(() => {
      service.resolve('task.params.nonexistent', context);
    }).toThrow(ParameterResolutionError);
  });

  it('should include partial path in error', () => {
    expect(() => {
      service.resolve('task.params.item.location', context, {
        validateEntity: false,
      });
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('task.params.item.location', context, {
        validateEntity: false,
      });
    } catch (err) {
      expect(err.partialPath).toBe('task.params.item');
      expect(err.failedStep).toBe('location');
    }
  });

  it('should include available keys in error', () => {
    expect(() => {
      service.resolve('task.params.wrongKey', context);
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('task.params.wrongKey', context);
    } catch (err) {
      expect(err.availableKeys).toContain('item');
    }
  });

  it('should include context type in error', () => {
    expect(() => {
      service.resolve('task.params.wrongKey', context, {
        contextType: 'refinement',
      });
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('task.params.wrongKey', context, {
        contextType: 'refinement',
      });
    } catch (err) {
      expect(err.contextType).toBe('refinement');
    }
  });

  it('should include step index in error', () => {
    expect(() => {
      service.resolve('task.params.wrongKey', context, {
        contextType: 'refinement',
        stepIndex: 2,
      });
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('task.params.wrongKey', context, {
        contextType: 'refinement',
        stepIndex: 2,
      });
    } catch (err) {
      expect(err.stepIndex).toBe(2);
    }
  });

  it('should throw error for empty reference string', () => {
    expect(() => {
      service.resolve('', context);
    }).toThrow(ParameterResolutionError);
  });

  it('should throw error for whitespace-only reference', () => {
    expect(() => {
      service.resolve('   ', context);
    }).toThrow(ParameterResolutionError);
  });

  it('should throw error for non-string reference', () => {
    expect(() => {
      service.resolve(null, context);
    }).toThrow(ParameterResolutionError);
  });
});

describe('ParameterResolutionService - Null/Undefined Handling', () => {
  let service;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => true,
    };
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  it('should return null if value is null', () => {
    const context = {
      task: {
        params: {
          item: null,
        },
      },
    };

    const result = service.resolve('task.params.item', context, {
      validateEntity: false,
    });
    expect(result).toBeNull();
  });

  it('should return undefined if value is undefined', () => {
    const context = {
      task: {
        params: {
          item: undefined,
        },
      },
    };

    const result = service.resolve('task.params.item', context, {
      validateEntity: false,
    });
    expect(result).toBeUndefined();
  });

  it('should throw error if intermediate path is null', () => {
    const context = {
      task: {
        params: null,
      },
    };

    expect(() => {
      service.resolve('task.params.item', context);
    }).toThrow(ParameterResolutionError);
  });

  it('should throw error if intermediate path is undefined', () => {
    const context = {
      task: {},
    };

    expect(() => {
      service.resolve('task.params.item', context);
    }).toThrow(ParameterResolutionError);
  });

  it('should throw error if trying to navigate through non-object', () => {
    const context = {
      task: {
        params: 'string_value',
      },
    };

    expect(() => {
      service.resolve('task.params.item', context);
    }).toThrow(ParameterResolutionError);
  });
});

describe('ParameterResolutionService - Entity Validation', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: jest.fn((id) => id === 'apple_7' || id === 'player_1'),
    };
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      task: {
        params: {
          item: 'apple_7',
          nonexistent: 'fake_123',
        },
      },
    };
  });

  it('should validate resolved entity exists when enabled', () => {
    const result = service.resolve('task.params.item', context, {
      validateEntity: true,
    });
    expect(result).toBe('apple_7');
    expect(mockEntityManager.hasEntity).toHaveBeenCalledWith('apple_7');
  });

  it('should skip validation when disabled', () => {
    const result = service.resolve('task.params.item', context, {
      validateEntity: false,
    });
    expect(result).toBe('apple_7');
    expect(mockEntityManager.hasEntity).not.toHaveBeenCalled();
  });

  it('should throw error for non-existent entity when validation enabled', () => {
    expect(() => {
      service.resolve('task.params.nonexistent', context, {
        validateEntity: true,
      });
    }).toThrow(ParameterResolutionError);
  });

  it('should not validate strings without underscores or colons', () => {
    const contextWithString = {
      task: {
        params: {
          name: 'simplename',
        },
      },
    };

    // Should not throw even though entity doesn't exist, because "simplename" doesn't look like entity ID
    const result = service.resolve('task.params.name', contextWithString, {
      validateEntity: true,
    });
    expect(result).toBe('simplename');
  });

  it('should validate entity IDs with underscores', () => {
    mockEntityManager.hasEntity.mockReturnValue(false);

    expect(() => {
      service.resolve('task.params.item', context, { validateEntity: true });
    }).toThrow(ParameterResolutionError);
  });

  it('should validate entity IDs with colons', () => {
    const contextWithColonId = {
      task: {
        params: {
          item: 'mod:item_5',
        },
      },
    };

    mockEntityManager.hasEntity.mockImplementation((id) => id !== 'mod:item_5');

    expect(() => {
      service.resolve('task.params.item', contextWithColonId, {
        validateEntity: true,
      });
    }).toThrow(ParameterResolutionError);
  });
});

describe('ParameterResolutionService - Cache Management', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => true,
    };
    mockLogger = {
      debug: jest.fn(),
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      task: {
        params: {
          item: 'apple_7',
        },
      },
    };
  });

  it('should cache resolved values', () => {
    const result1 = service.resolve('task.params.item', context, {
      validateEntity: false,
    });
    const result2 = service.resolve('task.params.item', context, {
      validateEntity: false,
    });

    expect(result1).toBe('apple_7');
    expect(result2).toBe('apple_7');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Cache hit')
    );
  });

  it('should clear cache when requested', () => {
    service.resolve('task.params.item', context, { validateEntity: false });
    service.clearCache();

    mockLogger.debug.mockClear();
    service.resolve('task.params.item', context, { validateEntity: false });

    // Should not have cache hit message
    const cacheHitCalls = mockLogger.debug.mock.calls.filter((call) =>
      call[0].includes('Cache hit')
    );
    expect(cacheHitCalls.length).toBe(0);
  });

  it('should use separate cache keys for different contexts', () => {
    const result1 = service.resolve('task.params.item', context, {
      validateEntity: false,
      contextType: 'planning',
    });
    const result2 = service.resolve('task.params.item', context, {
      validateEntity: false,
      contextType: 'refinement',
    });

    expect(result1).toBe('apple_7');
    expect(result2).toBe('apple_7');

    // Both should be resolved (not cached from each other)
    const resolvingCalls = mockLogger.debug.mock.calls.filter((call) =>
      call[0].includes('Resolving parameter')
    );
    expect(resolvingCalls.length).toBe(2);
  });
});

describe('ParameterResolutionService - Multiple Resolution', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: () => {},
      hasEntity: () => true,
    };
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: jest.fn(),
      error: () => {},
    };
    service = new ParameterResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      task: {
        params: {
          item: 'apple_7',
          location: 'room_12',
        },
      },
      actor: {
        id: 'player_1',
      },
    };
  });

  it('should resolve multiple references at once', () => {
    const references = ['task.params.item', 'task.params.location', 'actor.id'];
    const results = service.resolveMultiple(references, context, {
      validateEntity: false,
    });

    expect(results.size).toBe(3);
    expect(results.get('task.params.item')).toBe('apple_7');
    expect(results.get('task.params.location')).toBe('room_12');
    expect(results.get('actor.id')).toBe('player_1');
  });

  it('should continue resolving even if one fails', () => {
    const references = [
      'task.params.item',
      'task.params.nonexistent',
      'actor.id',
    ];
    const results = service.resolveMultiple(references, context, {
      validateEntity: false,
    });

    expect(results.size).toBe(2);
    expect(results.get('task.params.item')).toBe('apple_7');
    expect(results.get('actor.id')).toBe('player_1');
    expect(results.has('task.params.nonexistent')).toBe(false);
  });

  it('should log warnings for failed resolutions', () => {
    const references = ['task.params.item', 'task.params.nonexistent'];
    service.resolveMultiple(references, context, { validateEntity: false });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to resolve reference'),
      expect.any(Object)
    );
  });
});
