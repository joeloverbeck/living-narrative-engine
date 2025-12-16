import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IsBodyPartAccessibleOperator } from '../../../../src/logic/operators/isBodyPartAccessibleOperator.js';

describe('IsBodyPartAccessibleOperator', () => {
  let operator;
  let mockDependencies;
  let context;
  let partVisibilityRules;
  let partJoint;

  beforeEach(() => {
    partVisibilityRules = null;
    partJoint = null;

    mockDependencies = {
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
    };

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
});
