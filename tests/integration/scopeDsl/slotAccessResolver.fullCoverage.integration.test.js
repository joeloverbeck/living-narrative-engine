import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 *
 */
function createNonThrowingErrorHandler() {
  const errors = [];
  return {
    errors,
    handleError: jest.fn((message, context, resolverName, code) => {
      errors.push({ message, context, resolverName, code });
      return null;
    }),
    getErrorBuffer: jest.fn(() => errors),
  };
}

describe('SlotAccessResolver integration – comprehensive coverage scenarios', () => {
  const heroId = 'entity:slot-access-hero';
  let errorHandler;

  beforeEach(() => {
    errorHandler = createNonThrowingErrorHandler();
  });

  it('resolves slot access across direct equipment, coverage mapping, and component lookups', () => {
    const entityManager = new SimpleEntityManager([
      {
        id: heroId,
        components: {
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                base: 'item:reinforced-base-layer',
                underwear: 'item:thermal-undershorts',
              },
              torso_upper: {
                outer: 'item:coverage-cloak',
                base: 'item:layered-shirt',
              },
              legs: {
                outer: 'item:reflective-leg-warmers',
                base: 'item:compression-leggings',
              },
            },
          },
        },
      },
      {
        id: 'item:coverage-cloak',
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower', 'torso_upper'],
            coveragePriority: 'outer',
          },
        },
      },
      {
        id: 'item:compression-leggings',
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'base',
          },
        },
      },
      {
        id: 'item:reflective-leg-warmers',
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'outer',
          },
        },
      },
      {
        id: 'entity:component-source',
        components: {
          torso_lower: ['component:cached', 'component:backup'],
        },
      },
      {
        id: 'entity:legacy-source',
        components: {
          torso_lower: 'legacy-value',
        },
      },
    ]);

    const entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };

    const clothingStepResolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });
    const slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });

    const variableNode = { type: 'Variable', name: 'target' };
    const topmostNode = {
      type: 'Step',
      field: 'topmost_clothing',
      parent: variableNode,
    };
    const allNode = {
      type: 'Step',
      field: 'all_clothing',
      parent: variableNode,
    };
    const baseNode = {
      type: 'Step',
      field: 'base_clothing',
      parent: variableNode,
    };

    const baseDispatcher = {
      resolve: (node) => {
        if (node?.type === 'Variable' && node.name === 'target') {
          return new Set([heroId]);
        }
        return new Set();
      },
    };

    const clothingAccess = Array.from(
      clothingStepResolver.resolve(topmostNode, {
        dispatcher: baseDispatcher,
        trace: { addLog: jest.fn() },
      })
    )[0];

    const allAccess = Array.from(
      clothingStepResolver.resolve(allNode, {
        dispatcher: baseDispatcher,
        trace: { addLog: jest.fn() },
      })
    )[0];

    const baseAccess = Array.from(
      clothingStepResolver.resolve(baseNode, {
        dispatcher: baseDispatcher,
        trace: { addLog: jest.fn() },
      })
    )[0];

    const dispatcher = {
      resolve: (node, ctx) => {
        if (node?.type === 'Variable' && node.name === 'target') {
          return new Set([heroId]);
        }
        if (node?.type === 'Step' && node.field === 'topmost_clothing') {
          return new Set([
            clothingAccess,
            [allAccess],
            baseAccess,
            'entity:component-source',
            'entity:legacy-source',
          ]);
        }
        if (node?.type === 'Step' && node.field === 'all_clothing') {
          return new Set([allAccess]);
        }
        return new Set();
      },
    };

    const structuredTrace = new StructuredTrace();
    const context = {
      dispatcher,
      trace: { addLog: jest.fn() },
      structuredTrace,
    };

    const result = slotAccessResolver.resolve(
      { type: 'Step', field: 'torso_lower', parent: topmostNode },
      context
    );

    expect(Array.from(result)).toEqual([
      'item:coverage-cloak',
      'item:reinforced-base-layer',
      'component:cached',
      'component:backup',
      'legacy-value',
    ]);

    const spanOperations = structuredTrace
      .getSpans()
      .map((span) => span.operation);
    expect(spanOperations).toEqual(
      expect.arrayContaining([
        'candidate_collection',
        'priority_calculation',
        'final_selection',
      ])
    );

    const finalSelectionSpan = structuredTrace
      .getSpans()
      .find((span) => span.operation === 'final_selection');
    expect(finalSelectionSpan?.attributes?.selectedItem).toBe(
      'item:coverage-cloak'
    );
    expect(finalSelectionSpan?.attributes?.tieBreakingUsed).toBe(true);
  });

  it('records error conditions and gracefully recovers when slots cannot be resolved', () => {
    const entityManager = new SimpleEntityManager([
      {
        id: heroId,
        components: {
          'clothing:equipment': { equipped: {} },
        },
      },
    ]);

    const entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };

    const slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });

    const invalidAccess = 42;
    const missingEquippedAccess = {
      __clothingSlotAccess: true,
      mode: 'topmost',
      entityId: heroId,
      equipped: null,
    };
    const invalidModeAccess = {
      __clothingSlotAccess: true,
      mode: 'not-a-real-mode',
      entityId: heroId,
      equipped: {},
    };
    const emptyEquippedAccess = {
      __clothingSlotAccess: true,
      mode: 'topmost',
      entityId: heroId,
      equipped: {},
    };

    const dispatcher = {
      resolve: (node) => {
        if (node?.type === 'Step' && node.field === 'topmost_clothing') {
          return new Set([
            invalidAccess,
            missingEquippedAccess,
            invalidModeAccess,
            emptyEquippedAccess,
          ]);
        }
        return new Set();
      },
    };

    const structuredTrace = new StructuredTrace();
    const context = { dispatcher, structuredTrace };

    const validSlotResult = slotAccessResolver.resolve(
      {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step', field: 'topmost_clothing' },
      },
      context
    );
    expect(validSlotResult).toEqual(new Set());

    const invalidSlotResult = slotAccessResolver.resolve(
      {
        type: 'Step',
        field: 'not_a_slot',
        parent: { type: 'Step', field: 'topmost_clothing' },
      },
      context
    );
    expect(invalidSlotResult).toEqual(new Set());

    const errorMessages = errorHandler.handleError.mock.calls.map((call) => ({
      message: call[0],
      code: call[3],
    }));

    expect(errorMessages).toEqual(
      expect.arrayContaining([
        {
          message: 'No equipped items data found',
          code: ErrorCodes.MISSING_CONTEXT_GENERIC,
        },
        {
          message: 'Invalid clothing mode: not-a-real-mode',
          code: ErrorCodes.INVALID_DATA_GENERIC,
        },
        {
          message: 'Invalid slot identifier: not_a_slot',
          code: ErrorCodes.INVALID_ENTITY_ID,
        },
      ])
    );

    expect(structuredTrace.getSpans()).toEqual([]);
  });

  it('evaluates canResolve logic for clothing slot parent chains', () => {
    const entityManager = new SimpleEntityManager([
      {
        id: heroId,
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { outer: 'item:coverage-cloak' },
            },
          },
        },
      },
    ]);

    const entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };

    const slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });

    const parentStep = { type: 'Step', field: 'topmost_clothing' };
    expect(
      slotAccessResolver.canResolve({
        type: 'Step',
        field: 'torso_upper',
        parent: parentStep,
      })
    ).toBe(true);

    expect(
      slotAccessResolver.canResolve({
        type: 'Step',
        field: 'non_existent_slot',
        parent: parentStep,
      })
    ).toBe(false);

    expect(
      slotAccessResolver.canResolve({
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step', field: 'inventory_items' },
      })
    ).toBe(false);

    expect(slotAccessResolver.canResolve({ type: 'Value' })).toBe(false);
  });
});
