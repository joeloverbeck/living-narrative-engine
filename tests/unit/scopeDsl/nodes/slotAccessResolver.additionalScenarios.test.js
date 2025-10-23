import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';

const mockGetLayersByMode = jest.fn();
const mockCalculatePriorityWithValidation = jest.fn();
const mockSortCandidatesWithTieBreaking = jest.fn();

jest.mock('../../../../src/scopeDsl/prioritySystem/priorityCalculator.js', () => ({
  calculatePriorityWithValidation: (...args) =>
    mockCalculatePriorityWithValidation(...args),
  sortCandidatesWithTieBreaking: (...args) =>
    mockSortCandidatesWithTieBreaking(...args),
  getLayersByMode: (...args) => mockGetLayersByMode(...args),
}));

describe('slotAccessResolver additional scenarios', () => {
  let entitiesGateway;
  let resolver;
  let dispatcher;
  let errorHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetLayersByMode.mockImplementation((mode) => {
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

    mockCalculatePriorityWithValidation.mockImplementation((coveragePriority) => {
      const weights = { outer: 30, base: 20, underwear: 10, direct: 5 };
      return weights[coveragePriority] ?? 0;
    });

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

  function createNode(field = 'torso_upper') {
    return {
      type: 'Step',
      field,
      parent: { type: 'Step', field: 'topmost_clothing' },
    };
  }

  it('maps unknown layers to direct coverage priority', () => {
    const clothingAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-direct',
      equipped: {
        torso_upper: { mystery: 'enigmatic-layer' },
      },
      mode: 'topmost',
    };

    mockGetLayersByMode.mockReturnValue(['mystery']);
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode('torso_upper'), { dispatcher });

    expect(Array.from(result)).toEqual(['enigmatic-layer']);
    expect(mockCalculatePriorityWithValidation).toHaveBeenCalledWith(
      'direct',
      'mystery',
      null
    );
    expect(mockSortCandidatesWithTieBreaking).toHaveBeenCalled();
  });

  it('retains slot selections when trace context is present for enhanced coverage', () => {
    const clothingAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-trace',
      equipped: {
        torso_upper: { outer: 'jacket-layer' },
      },
      mode: 'topmost',
    };

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode('torso_upper'), {
      dispatcher,
      trace: { log: jest.fn() },
    });

    expect(Array.from(result)).toEqual(['jacket-layer']);
    expect(mockCalculatePriorityWithValidation).toHaveBeenCalledWith(
      'outer',
      'outer',
      null
    );
  });

  it('records tie-breaking metadata when multiple candidates share priority', () => {
    const clothingAccess = {
      __clothingSlotAccess: true,
      entityId: 'actor-tie',
      equipped: {
        torso_upper: { outer: 'coat-layer' },
        torso_lower: { outer: 'cloak-layer' },
      },
      mode: 'topmost',
    };

    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (component === 'clothing:coverage_mapping' && entityId === 'cloak-layer') {
        return { covers: ['torso_upper'], coveragePriority: 'outer' };
      }
      return null;
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    mockCalculatePriorityWithValidation.mockImplementation(() => 10);
    mockSortCandidatesWithTieBreaking.mockImplementation((candidates) => [...candidates]);

    const finalSelectionSpan = {
      addEvent: jest.fn(),
      addAttributes: jest.fn(),
    };

    const structuredTrace = {
      startSpan: jest.fn().mockImplementation((name) => {
        if (name === 'final_selection') {
          return finalSelectionSpan;
        }
        return { addEvent: jest.fn(), addAttributes: jest.fn() };
      }),
      endSpan: jest.fn(),
      getActiveSpan: jest.fn(() => null),
    };

    const result = resolver.resolve(createNode('torso_upper'), {
      dispatcher,
      structuredTrace,
      trace: { addLog: jest.fn() },
    });

    expect(Array.from(result)).toEqual(['coat-layer']);
    expect(finalSelectionSpan.addEvent).toHaveBeenCalledWith(
      'selection_made',
      expect.objectContaining({ tieBreakingUsed: true })
    );
    expect(finalSelectionSpan.addAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ tieBreakingUsed: true })
    );
  });
});
