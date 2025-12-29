import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IsBodyPartAccessibleOperator } from '../../../../src/logic/operators/isBodyPartAccessibleOperator.js';

describe('IsBodyPartAccessibleOperator', () => {
  let operator;
  let mockDependencies;
  let context;
  let partVisibilityRules;
  let partJoint;

  const createMockDependencies = (overrides = {}) => ({
    entityManager: {
      getComponentData: jest.fn((entityId, componentId) => {
        if (entityId === 'actor-1' && componentId === 'anatomy:body') {
          return { root: 'root-1' };
        }

        if (
          entityId === 'part-1' &&
          componentId === 'anatomy:visibility_rules'
        ) {
          return partVisibilityRules;
        }

        if (entityId === 'part-1' && componentId === 'anatomy:joint') {
          return partJoint;
        }

        return null;
      }),
    },
    bodyGraphService: {
      buildAdjacencyCache: jest.fn(),
      findPartsByType: jest.fn(),
    },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    isSlotExposedOperator: {
      evaluateInternal: jest.fn(() => true),
    },
    socketExposureOperator: {
      evaluateInternal: jest.fn(() => true),
      clearCache: jest.fn(),
    },
    ...overrides,
  });

  beforeEach(() => {
    partVisibilityRules = null;
    partJoint = null;

    mockDependencies = createMockDependencies();

    operator = new IsBodyPartAccessibleOperator(mockDependencies);
    context = { actor: { id: 'actor-1' } };
  });

  it('treats missing slot and socket metadata as accessible', () => {
    const result = operator.evaluate(['actor', { id: 'part-1' }], context);

    expect(result).toBe(true);
    expect(
      mockDependencies.isSlotExposedOperator.evaluateInternal
    ).not.toHaveBeenCalled();
    expect(
      mockDependencies.socketExposureOperator.evaluateInternal
    ).not.toHaveBeenCalled();
  });

  it('short-circuits when slot is covered', () => {
    partVisibilityRules = { clothingSlotId: 'torso' };
    mockDependencies.isSlotExposedOperator.evaluateInternal.mockReturnValue(
      false
    );

    const result = operator.evaluate(['actor', { id: 'part-1' }], context);

    expect(result).toBe(false);
    expect(
      mockDependencies.socketExposureOperator.evaluateInternal
    ).not.toHaveBeenCalled();
  });

  it('passes nonBlocking and excluded layers to slot exposure', () => {
    partVisibilityRules = {
      clothingSlotId: 'torso',
      nonBlockingLayers: ['underwear'],
    };

    const result = operator.evaluate(
      [
        'actor',
        { id: 'part-1' },
        {
          slot: {
            includeUnderwear: true,
            includeAccessories: true,
            excludeLayers: ['armor'],
          },
        },
      ],
      context
    );

    expect(result).toBe(true);
    // evaluateInternal is called with localContext (clone with _currentPath set)
    expect(
      mockDependencies.isSlotExposedOperator.evaluateInternal
    ).toHaveBeenCalledWith(
      'actor-1',
      ['torso', { layers: ['base', 'outer', 'accessories'] }],
      expect.objectContaining({ _currentPath: 'actor' })
    );
  });

  it('uses socketExposure with provided socket IDs and options', () => {
    partVisibilityRules = { clothingSlotId: 'torso' };
    partJoint = { socketId: 'default-socket' };
    mockDependencies.socketExposureOperator.evaluateInternal.mockReturnValue(
      false
    );

    const result = operator.evaluate(
      [
        'actor',
        { id: 'part-1' },
        {
          socket: {
            ids: ['left', 'right'],
            mode: 'all',
            invert: true,
            treatMissingAsExposed: false,
          },
        },
      ],
      context
    );

    // evaluateInternal is called with localContext (clone with _currentPath set)
    expect(
      mockDependencies.socketExposureOperator.evaluateInternal
    ).toHaveBeenCalledWith(
      'actor-1',
      [['left', 'right'], 'all', true, false],
      expect.objectContaining({ _currentPath: 'actor' })
    );
    expect(result).toBe(false);
  });

  it('clears cache via socket exposure operator', () => {
    operator.clearCache('actor-1');

    expect(
      mockDependencies.socketExposureOperator.clearCache
    ).toHaveBeenCalledWith('actor-1');
  });

  describe('dependency validation', () => {
    it('returns false when isSlotExposedOperator is missing', () => {
      const deps = createMockDependencies({
        isSlotExposedOperator: null,
      });
      const op = new IsBodyPartAccessibleOperator(deps);

      const result = op.evaluate(['actor', { id: 'part-1' }], context);

      expect(result).toBe(false);
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing slot/socket operator dependencies')
      );
    });

    it('returns false when socketExposureOperator is missing', () => {
      const deps = createMockDependencies({
        socketExposureOperator: null,
      });
      const op = new IsBodyPartAccessibleOperator(deps);

      const result = op.evaluate(['actor', { id: 'part-1' }], context);

      expect(result).toBe(false);
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing slot/socket operator dependencies')
      );
    });

    it('returns false when both operators are missing', () => {
      const deps = createMockDependencies({
        isSlotExposedOperator: null,
        socketExposureOperator: null,
      });
      const op = new IsBodyPartAccessibleOperator(deps);

      const result = op.evaluate(['actor', { id: 'part-1' }], context);

      expect(result).toBe(false);
      expect(deps.logger.error).toHaveBeenCalled();
    });
  });

  describe('part reference resolution', () => {
    it('returns false when part reference resolves to null', () => {
      // Empty object without id property
      const result = operator.evaluate(['actor', {}], context);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });

    it('returns false when part reference is null', () => {
      const result = operator.evaluate(['actor', null], context);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });

    it('resolves string part reference directly', () => {
      // Update mock to handle string ID
      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'string-part-id'], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('string-part-id', 'anatomy:visibility_rules');
    });

    it('resolves number part reference directly', () => {
      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 42], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith(42, 'anatomy:visibility_rules');
    });

    it('resolves object with getComponentData method using id', () => {
      const partRef = {
        id: 'custom-part-id',
        getComponentData: jest.fn(),
      };

      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('custom-part-id', 'anatomy:visibility_rules');
    });

    it('resolves object with getComponentData method using _id fallback', () => {
      const partRef = {
        _id: 'underscore-id',
        getComponentData: jest.fn(),
      };

      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('underscore-id', 'anatomy:visibility_rules');
    });

    it('returns false when getComponentData object has no id or _id', () => {
      const partRef = {
        getComponentData: jest.fn(),
        // No id or _id property
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });

    it('resolves object with numeric id via hasValidEntityId', () => {
      // Objects with numeric id are handled by hasValidEntityId first
      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', { id: 123 }], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith(123, 'anatomy:visibility_rules');
    });
  });

  describe('component retrieval fallbacks', () => {
    it('falls back to partEntityRef.getComponentData when entityManager throws', () => {
      const partRef = {
        id: 'part-fallback',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:visibility_rules') {
            return { clothingSlotId: 'torso' };
          }
          return null;
        }),
      };

      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          throw new Error('Entity not found');
        }
      );

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(partRef.getComponentData).toHaveBeenCalledWith(
        'anatomy:visibility_rules'
      );
      expect(mockDependencies.logger.debug).toHaveBeenCalled();
    });

    it('falls back to partEntityRef.components when getComponentData throws', () => {
      const partRef = {
        id: 'part-components',
        getComponentData: jest.fn(() => {
          throw new Error('Method failed');
        }),
        components: {
          'anatomy:visibility_rules': { clothingSlotId: 'chest' },
        },
      };

      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          throw new Error('Entity not found');
        }
      );

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalled();
    });

    it('retrieves component from partEntityRef.components dictionary', () => {
      const partRef = {
        id: 'part-dict',
        components: {
          'anatomy:visibility_rules': { clothingSlotId: 'arm' },
        },
      };

      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          // Return undefined to trigger fallback
          return undefined;
        }
      );

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.isSlotExposedOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        ['arm', expect.any(Object)],
        expect.any(Object)
      );
    });

    it('returns null when all component retrieval paths fail', () => {
      // partRef without getComponentData or components properties
      const partRef = {
        id: 'minimal-part',
      };

      mockDependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          // Return undefined (not throw) - this triggers the fallback chain
          return undefined;
        }
      );

      // Since visibility_rules and joint will both be null (all fallbacks fail),
      // the operator should treat the part as accessible (no slot to check, no sockets)
      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      // No slot exposure check because slotName is null
      expect(
        mockDependencies.isSlotExposedOperator.evaluateInternal
      ).not.toHaveBeenCalled();
    });
  });

  describe('socket target normalization', () => {
    it('wraps single socket ID from joint.socketId in array', () => {
      partVisibilityRules = { clothingSlotId: 'torso' };
      partJoint = { socketId: 'shoulder-socket' };

      const result = operator.evaluate(['actor', { id: 'part-1' }], context);

      expect(result).toBe(true);
      expect(
        mockDependencies.socketExposureOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        ['shoulder-socket', 'any', false, true],
        expect.any(Object)
      );
    });

    it('uses socket.sockets as alternative to socket.ids', () => {
      partVisibilityRules = { clothingSlotId: 'torso' };

      const result = operator.evaluate(
        [
          'actor',
          { id: 'part-1' },
          {
            socket: {
              sockets: ['socket-a', 'socket-b'],
            },
          },
        ],
        context
      );

      expect(result).toBe(true);
      expect(
        mockDependencies.socketExposureOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        [['socket-a', 'socket-b'], 'any', false, true],
        expect.any(Object)
      );
    });

    it('filters out falsy values from socket target arrays', () => {
      partVisibilityRules = { clothingSlotId: 'torso' };

      const result = operator.evaluate(
        [
          'actor',
          { id: 'part-1' },
          {
            socket: {
              ids: ['valid-socket', null, '', undefined, 'another-socket'],
            },
          },
        ],
        context
      );

      expect(result).toBe(true);
      expect(
        mockDependencies.socketExposureOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        [['valid-socket', 'another-socket'], 'any', false, true],
        expect.any(Object)
      );
    });
  });

  describe('clearCache edge cases', () => {
    it('handles socketExposureOperator without clearCache method', () => {
      const deps = createMockDependencies({
        socketExposureOperator: {
          evaluateInternal: jest.fn(() => true),
          // No clearCache method
        },
      });
      const op = new IsBodyPartAccessibleOperator(deps);

      // Should not throw
      expect(() => op.clearCache('actor-1')).not.toThrow();
    });
  });

  describe('layer normalization edge cases', () => {
    it('ignores invalid layer names in excludeLayers', () => {
      partVisibilityRules = {
        clothingSlotId: 'torso',
        nonBlockingLayers: ['invalid_layer', 'base'],
      };

      const result = operator.evaluate(
        [
          'actor',
          { id: 'part-1' },
          {
            slot: {
              excludeLayers: ['another_invalid', 'outer'],
            },
          },
        ],
        context
      );

      expect(result).toBe(true);
      // Should only exclude valid layers: base and outer
      // Layers passed: base, outer, armor (from DEFAULT_LAYERS) minus excluded (base, outer) = armor
      expect(
        mockDependencies.isSlotExposedOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        ['torso', { layers: ['armor'] }],
        expect.any(Object)
      );
    });

    it('uses custom layers array when provided', () => {
      partVisibilityRules = { clothingSlotId: 'torso' };

      const result = operator.evaluate(
        [
          'actor',
          { id: 'part-1' },
          {
            slot: {
              layers: ['underwear', 'base'],
            },
          },
        ],
        context
      );

      expect(result).toBe(true);
      expect(
        mockDependencies.isSlotExposedOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        ['torso', { layers: ['underwear', 'base'] }],
        expect.any(Object)
      );
    });

    it('filters out duplicate layers', () => {
      partVisibilityRules = { clothingSlotId: 'torso' };

      const result = operator.evaluate(
        [
          'actor',
          { id: 'part-1' },
          {
            slot: {
              layers: ['base', 'base', 'outer', 'base'],
            },
          },
        ],
        context
      );

      expect(result).toBe(true);
      // Duplicates should be filtered out
      expect(
        mockDependencies.isSlotExposedOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        ['torso', { layers: ['base', 'outer'] }],
        expect.any(Object)
      );
    });

    it('filters out invalid layers from custom layers array', () => {
      partVisibilityRules = { clothingSlotId: 'torso' };

      const result = operator.evaluate(
        [
          'actor',
          { id: 'part-1' },
          {
            slot: {
              layers: ['base', 'invalid_layer', 'outer', 'not_a_layer'],
            },
          },
        ],
        context
      );

      expect(result).toBe(true);
      // Invalid layers should be filtered out
      expect(
        mockDependencies.isSlotExposedOperator.evaluateInternal
      ).toHaveBeenCalledWith(
        'actor-1',
        ['torso', { layers: ['base', 'outer'] }],
        expect.any(Object)
      );
    });
  });
});
