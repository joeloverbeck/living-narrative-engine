import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';

/**
 *
 */
function createLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe('slotAccessResolver integration – coverage and tie-breaking', () => {
  let entityManager;
  let entitiesGateway;
  let clothingStepResolver;
  let slotAccessResolver;
  let errorHandler;
  let actorId;
  let clothingAccess;
  let noAccessoriesAccess;

  beforeEach(() => {
    actorId = 'entity:coverage-actor';

    entityManager = new SimpleEntityManager([
      {
        id: actorId,
        components: {
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                outer: 'item:ceremonial-skirt',
                base: 'item:reinforced-pants',
                underwear: 'item:thermal-shorts',
              },
              torso_upper: {
                outer: 'item:weather-cloak',
                base: 'item:linen-shirt',
              },
              legs: {
                base: 'item:support-leggings',
              },
              head_gear: {
                accessories: 'item:decorative-hat',
              },
            },
          },
        },
      },
      {
        id: 'item:weather-cloak',
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'outer',
          },
        },
      },
      {
        id: 'item:support-leggings',
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'base',
          },
        },
      },
      {
        id: 'item:decorative-hat',
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'accessories',
          },
        },
      },
      {
        id: 'entity:component-source',
        components: {
          torso_lower: ['component:cache-wrap', 'component:cache-overlay'],
        },
      },
      {
        id: 'entity:archive-record',
        components: {
          torso_lower: 'component:archived-entry',
        },
      },
      { id: 'item:ceremonial-skirt', components: {} },
      { id: 'item:reinforced-pants', components: {} },
      { id: 'item:thermal-shorts', components: {} },
      { id: 'item:linen-shirt', components: {} },
    ]);

    entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };

    errorHandler = new ScopeDslErrorHandler({
      logger: createLogger(),
      config: { isDevelopment: true, maxBufferSize: 50 },
    });

    clothingStepResolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });

    const clothingResults = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: { resolve: () => new Set([actorId]) },
        trace: { addLog: jest.fn() },
      }
    );

    clothingAccess = Array.from(clothingResults)[0];

    const noAccessoriesResults = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing_no_accessories',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: { resolve: () => new Set([actorId]) },
        trace: { addLog: jest.fn() },
      }
    );

    noAccessoriesAccess = Array.from(noAccessoriesResults)[0];
  });

  it('merges direct equipment, cross-slot coverage, and component fallbacks with structured tracing', () => {
    const structuredTrace = new StructuredTrace();

    const node = {
      type: 'Step',
      field: 'torso_lower',
      parent: { type: 'Step', field: 'topmost_clothing' },
    };

    const parentResults = new Set([
      clothingAccess,
      [noAccessoriesAccess, 'entity:component-source'],
      'entity:component-source',
      'entity:archive-record',
      'entity:unknown-placeholder',
    ]);

    const resultSet = slotAccessResolver.resolve(node, {
      dispatcher: { resolve: () => parentResults },
      trace: structuredTrace,
      structuredTrace,
    });

    const resolvedItems = Array.from(resultSet);

    expect(resolvedItems).toEqual(
      expect.arrayContaining([
        'item:ceremonial-skirt',
        'component:cache-wrap',
        'component:cache-overlay',
        'component:archived-entry',
      ])
    );

    const candidateCollectionSpan = structuredTrace
      .getSpans()
      .find((span) => span.operation === 'candidate_collection');
    const finalSelectionSpan = structuredTrace
      .getSpans()
      .find((span) => span.operation === 'final_selection');

    expect(candidateCollectionSpan?.attributes?.candidateCount).toBe(6);

    const candidateEvents = candidateCollectionSpan?.attributes?.events ?? [];
    const candidateIds = candidateEvents.map(
      (event) => event.attributes?.itemId
    );
    expect(candidateIds).toEqual(
      expect.arrayContaining([
        'item:ceremonial-skirt',
        'item:reinforced-pants',
        'item:thermal-shorts',
        'item:weather-cloak',
        'item:support-leggings',
        'item:decorative-hat',
      ])
    );

    expect(finalSelectionSpan?.attributes?.selectedItem).toBe(
      'item:ceremonial-skirt'
    );
    expect(finalSelectionSpan?.attributes?.tieBreakingUsed).toBe(true);
  });

  it('omits accessory coverage when using topmost_no_accessories mode while preserving other resolution paths', () => {
    const structuredTrace = new StructuredTrace();

    const node = {
      type: 'Step',
      field: 'torso_lower',
      parent: { type: 'Step', field: 'topmost_clothing' },
    };

    const parentResults = new Set([[noAccessoriesAccess]]);

    const resultSet = slotAccessResolver.resolve(node, {
      dispatcher: { resolve: () => parentResults },
      trace: structuredTrace,
      structuredTrace,
    });

    const resolvedItems = Array.from(resultSet);

    expect(resolvedItems).toEqual(['item:ceremonial-skirt']);

    const candidateCollectionSpan = structuredTrace
      .getSpans()
      .find((span) => span.operation === 'candidate_collection');
    expect(candidateCollectionSpan?.attributes?.candidateCount).toBe(5);

    const candidateEvents = candidateCollectionSpan?.attributes?.events ?? [];
    const candidateIds = candidateEvents.map(
      (event) => event.attributes?.itemId
    );
    expect(candidateIds).toEqual(
      expect.arrayContaining([
        'item:ceremonial-skirt',
        'item:reinforced-pants',
        'item:thermal-shorts',
        'item:weather-cloak',
        'item:support-leggings',
      ])
    );
    expect(candidateIds).not.toContain('item:decorative-hat');
  });
});
