import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

const mockGetLayersByMode = jest.fn();
const mockCalculatePriorityWithValidation = jest.fn();
const mockSortCandidatesWithTieBreaking = jest.fn();

jest.mock(
  '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js',
  () => ({
    getLayersByMode: (...args) => mockGetLayersByMode(...args),
    calculatePriorityWithValidation: (...args) =>
      mockCalculatePriorityWithValidation(...args),
    sortCandidatesWithTieBreaking: (...args) =>
      mockSortCandidatesWithTieBreaking(...args),
  })
);

describe('slotAccessResolver validation branches', () => {
  let entitiesGateway;
  let errorHandler;
  let resolver;
  let dispatcher;

  const createNode = (field = 'torso_upper') => ({
    type: 'Step',
    field,
    parent: { type: 'Step', field: 'topmost_clothing' },
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetLayersByMode.mockImplementation((mode) => {
      const mapping = {
        topmost: ['outer', 'base', 'underwear'],
        outer: ['outer'],
        base: ['base', 'underwear'],
      };
      return mapping[mode] || ['outer', 'base', 'underwear'];
    });

    mockCalculatePriorityWithValidation.mockImplementation(
      (coveragePriority, layer) => {
        const weights = { outer: 30, base: 20, underwear: 10, direct: 5 };
        return weights[coveragePriority] ?? weights[layer] ?? 0;
      }
    );

    mockSortCandidatesWithTieBreaking.mockImplementation((candidates) =>
      [...candidates].sort((a, b) => b.priority - a.priority)
    );

    entitiesGateway = {
      getComponentData: jest.fn(() => null),
    };

    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    resolver = createSlotAccessResolver({ entitiesGateway, errorHandler });
    dispatcher = { resolve: jest.fn() };
  });

  it('reports missing equipped data before attempting resolution', () => {
    const clothingAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-empty',
      mode: 'topmost',
    };

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode(), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'No equipped items data found',
      expect.objectContaining({
        entityId: 'actor-empty',
        slotName: 'torso_upper',
      }),
      'SlotAccessResolver',
      ErrorCodes.MISSING_CONTEXT_GENERIC
    );
  });

  it('rejects unsupported clothing modes with detailed metadata', () => {
    const clothingAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-mode',
      equipped: { torso_upper: {} },
      mode: 'stealth',
    };

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode(), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid clothing mode: stealth',
      expect.objectContaining({
        entityId: 'actor-mode',
        slotName: 'torso_upper',
        mode: 'stealth',
      }),
      'SlotAccessResolver',
      ErrorCodes.INVALID_DATA_GENERIC
    );
  });

  it('filters coverage candidates that do not match allowed layers', () => {
    const clothingAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-filter',
      equipped: {
        torso_upper: { outer: 'jacket' },
        torso_lower: { underwear: 'longjohns' },
      },
      mode: 'outer',
    };

    entitiesGateway.getComponentData.mockImplementation((id, component) => {
      if (component === 'clothing:coverage_mapping' && id === 'longjohns') {
        return { covers: ['torso_upper'], coveragePriority: 'underwear' };
      }
      return null;
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode(), { dispatcher });

    expect(Array.from(result)).toEqual(['jacket']);
    expect(mockCalculatePriorityWithValidation).toHaveBeenCalledWith(
      'outer',
      'outer',
      null
    );
    expect(mockCalculatePriorityWithValidation).not.toHaveBeenCalledWith(
      'underwear',
      'underwear',
      null
    );
  });

  it('aggregates array, string, and object results while skipping structured tracing', () => {
    const layeredAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-layered',
      equipped: { torso_upper: { outer: 'coat-layer' } },
      mode: 'topmost',
    };

    const nestedAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-nested',
      equipped: { torso_upper: { base: 'inner-layer' } },
      mode: 'topmost',
    };

    dispatcher.resolve.mockReturnValue(
      new Set([
        ['actor-array', nestedAccess],
        'actor-array',
        'actor-string',
        'actor-object',
        layeredAccess,
      ])
    );

    entitiesGateway.getComponentData.mockImplementation((id, component) => {
      if (component === 'clothing:coverage_mapping') {
        return null;
      }
      if (id === 'actor-array') {
        return ['first-from-array', 'second-from-array'];
      }
      if (id === 'actor-string') {
        return 'string-component';
      }
      if (id === 'actor-object') {
        return { nested: true };
      }
      if (id === 'inner-layer') {
        return { covers: ['torso_upper'], coveragePriority: 'base' };
      }
      if (id === 'coat-layer') {
        return { coveragePriority: 'outer', covers: ['torso_upper'] };
      }
      return null;
    });

    mockSortCandidatesWithTieBreaking.mockImplementation(
      (candidates) => candidates
    );

    const result = resolver.resolve(createNode(), { dispatcher });

    expect(Array.from(result)).toEqual([
      'inner-layer',
      'first-from-array',
      'second-from-array',
      'string-component',
      { nested: true },
      'coat-layer',
    ]);
    expect(errorHandler.handleError).not.toHaveBeenCalled();
  });
});
