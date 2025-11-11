import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';
import * as priorityCalculator from '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('slotAccessResolver uncovered branches', () => {
  let entitiesGateway;
  let errorHandler;
  let resolver;
  let dispatcher;

  const createNode = (field) => ({
    type: 'Step',
    field,
    parent: { type: 'Step', field: 'topmost_clothing' },
  });

  const createClothingAccess = (overrides = {}) => ({
    __clothingSlotAccess: true,
    entityId: 'actor-1',
    equipped: {
      torso_upper: { outer: 'upper-outer', base: 'upper-base' },
      torso_lower: { outer: 'lower-outer', base: 'lower-base' },
    },
    mode: 'topmost',
    ...overrides,
  });

  const createStructuredTrace = (activeSpan = null) => ({
    startSpan: jest.fn().mockImplementation(() => ({
      addEvent: jest.fn(),
      addAttributes: jest.fn(),
    })),
    endSpan: jest.fn(),
    getActiveSpan: jest.fn().mockReturnValue(activeSpan),
  });

  beforeEach(() => {
    entitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(null),
    };

    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    dispatcher = {
      resolve: jest.fn(),
    };

    resolver = createSlotAccessResolver({ entitiesGateway, errorHandler });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects coverage candidates with default priority and logs spans', () => {
    const prioritySpy = jest.spyOn(
      priorityCalculator,
      'calculatePriorityWithValidation'
    );
    const sortSpy = jest.spyOn(
      priorityCalculator,
      'sortCandidatesWithTieBreaking'
    );

    const clothingAccess = createClothingAccess({
      equipped: {
        torso_upper: {},
        torso_lower: { outer: 'cloak-coverage' },
      },
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));
    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (component === 'clothing:coverage_mapping' && entityId === 'cloak-coverage') {
        return { covers: ['torso_upper'] };
      }
      return null;
    });

    const structuredTrace = createStructuredTrace();

    const result = resolver.resolve(createNode('torso_upper'), {
      dispatcher,
      structuredTrace,
      trace: { addLog: jest.fn() },
    });

    expect(Array.from(result)).toEqual(['cloak-coverage']);
    expect(prioritySpy).toHaveBeenCalledWith('base', 'outer', null);
    expect(sortSpy).toHaveBeenCalled();
    expect(structuredTrace.startSpan).toHaveBeenCalledWith(
      'candidate_collection',
      expect.objectContaining({ slotName: 'torso_upper' })
    );
    expect(structuredTrace.startSpan).toHaveBeenCalledWith(
      'priority_calculation',
      expect.objectContaining({ candidateCount: 1 })
    );
    expect(structuredTrace.startSpan).toHaveBeenCalledWith(
      'final_selection',
      expect.objectContaining({ candidateCount: 1 })
    );
  });

  it('delegates error handling when slot name is invalid', () => {
    const clothingAccess = createClothingAccess();
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode(null), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid slot name provided',
      { slotName: null },
      'SlotAccessResolver',
      ErrorCodes.INVALID_ENTITY_ID
    );
  });

  it('delegates error handling when slot identifier is unknown', () => {
    const clothingAccess = createClothingAccess();
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode('unknown_slot'), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid slot identifier: unknown_slot',
      expect.objectContaining({ slotName: 'unknown_slot' }),
      'SlotAccessResolver',
      ErrorCodes.INVALID_ENTITY_ID
    );
  });

  it('handles missing equipped data gracefully', () => {
    const clothingAccess = createClothingAccess({ equipped: null });
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode('torso_upper'), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'No equipped items data found',
      expect.objectContaining({ slotName: 'torso_upper' }),
      'SlotAccessResolver',
      ErrorCodes.MISSING_CONTEXT_GENERIC
    );
  });

  it('handles invalid clothing modes', () => {
    const clothingAccess = createClothingAccess({ mode: 'unsupported' });
    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(createNode('torso_upper'), { dispatcher });

    expect(result.size).toBe(0);
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      'Invalid clothing mode: unsupported',
      expect.objectContaining({ mode: 'unsupported' }),
      'SlotAccessResolver',
      ErrorCodes.INVALID_DATA_GENERIC
    );
  });

  it('logs absence of candidates on structured traces', () => {
    const clothingAccess = createClothingAccess({
      equipped: { torso_upper: {} },
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));
    const activeSpan = { addEvent: jest.fn(), addAttributes: jest.fn() };
    const structuredTrace = createStructuredTrace(activeSpan);

    const result = resolver.resolve(createNode('torso_upper'), {
      dispatcher,
      structuredTrace,
    });

    expect(result.size).toBe(0);
    expect(activeSpan.addEvent).toHaveBeenCalledWith(
      'no_slot_data',
      expect.objectContaining({
        slotName: 'torso_upper',
        reason: 'no_candidates_found',
      })
    );
  });

  it('records final selection details on structured traces', () => {
    const clothingAccess = createClothingAccess({
      equipped: {
        torso_upper: { outer: 'jacket', base: 'shirt' },
      },
    });

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));
    const structuredTrace = createStructuredTrace();

    const result = resolver.resolve(createNode('torso_upper'), {
      dispatcher,
      structuredTrace,
      trace: { addLog: jest.fn() },
    });

    expect(result.has('jacket')).toBe(true);
    expect(structuredTrace.startSpan).toHaveBeenCalledWith(
      'final_selection',
      expect.objectContaining({ candidateCount: expect.any(Number) })
    );
    const finalSelectionCallIndex = structuredTrace.startSpan.mock.calls.findIndex(
      ([operation]) => operation === 'final_selection'
    );
    expect(finalSelectionCallIndex).toBeGreaterThan(-1);
    const finalSelectionSpan =
      structuredTrace.startSpan.mock.results[finalSelectionCallIndex].value;
    expect(finalSelectionSpan.addEvent).toHaveBeenCalledWith(
      'selection_made',
      expect.objectContaining({ selectedItem: 'jacket' })
    );
    expect(finalSelectionSpan.addAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ selectedItem: 'jacket' })
    );
  });

  it('adds string component data to the result set', () => {
    dispatcher.resolve.mockReturnValue(new Set(['actor-1']));
    entitiesGateway.getComponentData.mockImplementation((entityId, component) => {
      if (entityId === 'actor-1' && component === 'torso_upper') {
        return 'component-layer';
      }
      return null;
    });

    const result = resolver.resolve(createNode('torso_upper'), { dispatcher });

    expect(Array.from(result)).toEqual(['component-layer']);
  });

  it('resolves clothing slot access within arrays and standalone entries', () => {
    const arrayAccess = createClothingAccess({
      equipped: { torso_upper: { outer: 'array-jacket' } },
    });
    const standaloneAccess = createClothingAccess({
      equipped: { torso_upper: { outer: 'standalone-jacket' } },
    });

    dispatcher.resolve.mockReturnValue(
      new Set([[arrayAccess], standaloneAccess])
    );

    const result = resolver.resolve(createNode('torso_upper'), {
      dispatcher,
      trace: { addLog: jest.fn() },
    });

    expect(result.has('array-jacket')).toBe(true);
    expect(result.has('standalone-jacket')).toBe(true);
  });
});
