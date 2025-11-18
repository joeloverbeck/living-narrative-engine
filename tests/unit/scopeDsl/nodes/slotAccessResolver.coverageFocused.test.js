import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

jest.mock('../../../../src/scopeDsl/prioritySystem/priorityCalculator.js', () => {
  const getLayersByMode = jest.fn((mode) => {
    const mapping = {
      topmost: ['outer', 'base', 'underwear'],
      topmost_no_accessories: ['outer', 'base'],
      all: ['outer', 'base', 'underwear'],
      outer: ['outer'],
      base: ['base', 'underwear'],
      underwear: ['underwear'],
    };
    return mapping[mode] || ['outer', 'base', 'underwear'];
  });

  const calculatePriorityWithValidation = jest.fn((coveragePriority, layer) => {
    const weights = {
      outer: 30,
      base: 20,
      underwear: 10,
      direct: 5,
    };
    return weights[coveragePriority] ?? weights[layer] ?? 0;
  });

  const sortCandidatesWithTieBreaking = jest.fn((candidates) => {
    return [...candidates].sort((a, b) => b.priority - a.priority);
  });

  return {
    calculatePriorityWithValidation,
    sortCandidatesWithTieBreaking,
    getLayersByMode,
    getLayersByModeForTesting: getLayersByMode,
  };
});

const priorityCalculator = jest.requireMock(
  '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js'
);

describe('slotAccessResolver targeted coverage scenarios', () => {
  let entitiesGateway;
  let errorHandler;
  let resolver;
  let dispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    entitiesGateway = {
      getComponentData: jest.fn(() => null),
    };
    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };
    resolver = createSlotAccessResolver({ entitiesGateway, errorHandler });
    dispatcher = {
      resolve: jest.fn(),
    };
  });

  /**
   *
   * @param activeSpan
   */
  function createStructuredTrace(activeSpan = null) {
    return {
      startSpan: jest.fn().mockImplementation(() => ({
        addEvent: jest.fn(),
        addAttributes: jest.fn(),
      })),
      endSpan: jest.fn(),
      getActiveSpan: jest.fn().mockReturnValue(activeSpan),
    };
  }

  /**
   *
   * @param field
   */
  function createClothingNode(field = 'torso_upper') {
    return {
      type: 'Step',
      field,
      parent: { type: 'Step', field: 'topmost_clothing' },
    };
  }

  /**
   *
   * @param overrides
   */
  function createClothingAccess(overrides = {}) {
    return {
      __clothingSlotAccess: true,
      entityId: 'actor-1',
      equipped: {
        torso_upper: {
          outer: 'jacket-layer',
          base: 'shirt-layer',
        },
        torso_lower: {
          outer: 'pants-layer',
        },
        legs: {},
      },
      mode: 'topmost',
      ...overrides,
    };
  }

  it('prioritises coverage candidates when direct slot is empty', () => {
    const clothingAccess = createClothingAccess({
      equipped: {
        torso_upper: {},
        torso_lower: {
          outer: 'coat-coverage',
        },
      },
    });

    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (component === 'clothing:coverage_mapping' && entityId === 'coat-coverage') {
        return { covers: ['torso_upper'], coveragePriority: 'outer' };
      }
      return null;
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));
    const activeSpan = { addEvent: jest.fn(), addAttributes: jest.fn() };
    const structuredTrace = createStructuredTrace(activeSpan);

    const result = resolver.resolve(
      createClothingNode('torso_upper'),
      { dispatcher, structuredTrace, trace: { addLog: jest.fn() } }
    );

    expect(Array.from(result)).toEqual(['coat-coverage']);
    expect(priorityCalculator.calculatePriorityWithValidation).toHaveBeenCalledWith(
      'outer',
      'outer',
      null
    );
    expect(priorityCalculator.sortCandidatesWithTieBreaking).toHaveBeenCalled();
    expect(structuredTrace.startSpan).toHaveBeenCalledWith(
      'candidate_collection',
      expect.objectContaining({ slotName: 'torso_upper' })
    );
    expect(structuredTrace.endSpan).toHaveBeenCalled();
  });

  it('reports absence of candidates through structured tracing', () => {
    const clothingAccess = createClothingAccess({
      equipped: {
        torso_upper: {},
      },
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));
    const activeSpan = { addEvent: jest.fn(), addAttributes: jest.fn() };
    const structuredTrace = createStructuredTrace(activeSpan);

    const result = resolver.resolve(
      createClothingNode('torso_upper'),
      { dispatcher, structuredTrace }
    );

    expect(result.size).toBe(0);
    expect(activeSpan.addEvent).toHaveBeenCalledWith(
      'no_slot_data',
      expect.objectContaining({ slotName: 'torso_upper', reason: 'no_candidates_found' })
    );
  });

  it('validates slot identifiers and delegates errors', () => {
    const clothingAccess = createClothingAccess();
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(
      createClothingNode('not_a_slot'),
      { dispatcher }
    );

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid slot identifier: not_a_slot',
      expect.objectContaining({ slotName: 'not_a_slot' }),
      'SlotAccessResolver',
      ErrorCodes.INVALID_ENTITY_ID
    );
  });

  it('falls back to entity component access for string results', () => {
    dispatcher.resolve.mockReturnValue(new Set(['actor-1']));
    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (entityId === 'actor-1' && component === 'torso_upper') {
        return ['vest-layer', 'undershirt-layer'];
      }
      return null;
    });

    const result = resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(Array.from(result)).toEqual(['vest-layer', 'undershirt-layer']);
    expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
      'actor-1',
      'torso_upper'
    );
  });

  it('skips coverage candidates when layer not allowed by mode', () => {
    const clothingAccess = createClothingAccess({
      mode: 'outer',
      equipped: {
        torso_upper: {},
        torso_lower: { underwear: 'leggings-coverage' },
      },
    });

    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (component === 'clothing:coverage_mapping') {
        return { covers: ['torso_upper'], coveragePriority: 'base' };
      }
      return null;
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(result.size).toBe(0);
    expect(priorityCalculator.sortCandidatesWithTieBreaking).not.toHaveBeenCalled();
  });

  it('validates available equipment data before resolving', () => {
    const clothingAccess = createClothingAccess({ equipped: null });
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'No equipped items data found',
      expect.objectContaining({ slotName: 'torso_upper' }),
      'SlotAccessResolver',
      ErrorCodes.MISSING_CONTEXT_GENERIC
    );
  });

  it('rejects unsupported clothing access modes', () => {
    const clothingAccess = createClothingAccess({ mode: 'stealth_mode' });
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid clothing mode: stealth_mode',
      expect.objectContaining({ validModes: expect.arrayContaining(['topmost']) }),
      'SlotAccessResolver',
      ErrorCodes.INVALID_DATA_GENERIC
    );
  });

  it('covers applyEnhancedCoverage early return when trace missing', () => {
    const clothingAccess = createClothingAccess();
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createClothingNode('torso_upper'), {
      dispatcher,
      trace: null,
    });

    expect(Array.from(result)).toEqual(['jacket-layer']);
  });

  it('adds component objects returned for string parents', () => {
    dispatcher.resolve.mockReturnValue(new Set(['actor-2']));
    const componentPayload = { id: 'object-layer' };
    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (entityId === 'actor-2' && component === 'torso_upper') {
        return componentPayload;
      }
      return null;
    });

    const result = resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(result).toEqual(new Set([componentPayload]));
  });

  it('processes nested arrays of clothing access entries', () => {
    const clothingAccess = createClothingAccess({
      equipped: {
        torso_upper: { outer: 'cape-layer' },
      },
    });

    dispatcher.resolve.mockReturnValue(new Set([[clothingAccess]]));

    const result = resolver.resolve(
      createClothingNode('torso_upper'),
      { dispatcher, trace: { addLog: jest.fn() } }
    );

    expect(Array.from(result)).toEqual(['cape-layer']);
  });

  it('respects canResolve semantics for clothing slot trees', () => {
    expect(
      resolver.canResolve({
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step', field: 'topmost_clothing' },
      })
    ).toBe(true);

    expect(
      resolver.canResolve({
        type: 'Step',
        field: 'not_real_slot',
        parent: { type: 'Step', field: 'topmost_clothing' },
      })
    ).toBe(false);

    expect(
      resolver.canResolve({
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step', field: 'something_else' },
      })
    ).toBe(false);
  });

  it('skips null items encountered in coverage scanning', () => {
    const clothingAccess = createClothingAccess({
      equipped: {
        torso_upper: {},
        torso_lower: { outer: null },
      },
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(entitiesGateway.getComponentData).not.toHaveBeenCalledWith(
      null,
      'clothing:coverage_mapping'
    );
  });

  it('returns false for missing node metadata in canResolve', () => {
    expect(resolver.canResolve(null)).toBe(false);
    expect(resolver.canResolve({ type: 'NotStep' })).toBe(false);
  });

  it('guards against missing slot names before resolution', () => {
    const clothingAccess = createClothingAccess();
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(
      { type: 'Step', field: null, parent: { type: 'Step', field: 'topmost_clothing' } },
      { dispatcher }
    );

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid slot name provided',
      expect.objectContaining({ slotName: null }),
      'SlotAccessResolver',
      ErrorCodes.INVALID_ENTITY_ID
    );
  });

  it('adds direct string component data to the result set', () => {
    dispatcher.resolve.mockReturnValue(new Set(['actor-3']));
    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (entityId === 'actor-3' && component === 'torso_upper') {
        return 'tunic-layer';
      }
      return null;
    });

    const result = resolver.resolve(createClothingNode('torso_upper'), { dispatcher });

    expect(result).toEqual(new Set(['tunic-layer']));
  });
});
