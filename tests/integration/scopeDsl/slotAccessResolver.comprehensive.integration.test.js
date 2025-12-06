/**
 * @file Integration tests for slot access resolver coverage-aware behavior
 * @description Validates how the slot access resolver coordinates with the clothing
 * step resolver, structured trace system, and scope DSL error handler when resolving
 * clothing slots that require both direct equipment data and cross-slot coverage mappings.
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';

/**
 * Creates a logger that satisfies the ScopeDslErrorHandler dependency contract while
 * allowing assertions on logged messages inside integration tests.
 *
 * @returns {import('../../../src/interfaces/ILogger.js').ILogger}
 */
function createIntegrationLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe('ScopeDSL slot access resolver integration', () => {
  let entityManager;
  let entitiesGateway;
  let clothingStepResolver;
  let slotAccessResolver;
  let errorHandler;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([]);

    entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };

    errorHandler = new ScopeDslErrorHandler({
      logger: createIntegrationLogger(),
      config: { isDevelopment: true, maxBufferSize: 20 },
    });

    clothingStepResolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });
  });

  describe('coverage aware slot resolution', () => {
    it('combines direct equipment, coverage mapping, and component lookups with structured tracing', () => {
      const characterId = 'entity:integration-character';
      const capeId = 'item:cascade-cloak';
      const leggingsId = 'item:compression-leggings';
      const skirtId = 'item:layered-skirt';
      const pantsId = 'item:reinforced-pants';
      const shortsId = 'item:thermal-shorts';
      const storageEntityId = 'entity:spare-storage';
      const archiveEntityId = 'entity:archive-record';

      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          torso_lower: {
            outer: skirtId,
            base: pantsId,
            underwear: shortsId,
          },
          torso_upper: {
            outer: capeId,
            base: 'item:insulated-shirt',
          },
          legs: {
            base: leggingsId,
            accessories: 'item:reflective-leg-warmers',
          },
        },
      });

      entityManager.addComponent(capeId, 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'outer',
      });

      entityManager.addComponent(leggingsId, 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'invalid-priority',
      });

      entityManager.addComponent(storageEntityId, 'torso_lower', [
        'item:emergency-pants',
        'item:emergency-skirt',
      ]);
      entityManager.addComponent(
        archiveEntityId,
        'torso_lower',
        'item:archived-uniform'
      );

      const clothingResults = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: { resolve: () => new Set([characterId]) },
          trace: { addLog: jest.fn() },
        }
      );

      const clothingAccess = Array.from(clothingResults)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);

      const noAccessoriesResults = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: { resolve: () => new Set([characterId]) },
          trace: { addLog: jest.fn() },
        }
      );

      const noAccessoriesAccess = Array.from(noAccessoriesResults)[0];
      expect(noAccessoriesAccess.mode).toBe('topmost_no_accessories');

      const structuredTrace = new StructuredTrace();

      const slotResults = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: { type: 'Step', field: 'topmost_clothing' },
        },
        {
          dispatcher: {
            resolve: () =>
              new Set([
                clothingAccess,
                [noAccessoriesAccess, 'entity:ignored-entry'],
                storageEntityId,
                archiveEntityId,
              ]),
          },
          trace: structuredTrace,
          structuredTrace,
        }
      );

      const resolvedItems = Array.from(slotResults);
      expect(resolvedItems).toContain(skirtId);
      expect(resolvedItems).toContain('item:emergency-pants');
      expect(resolvedItems).toContain('item:emergency-skirt');
      expect(resolvedItems).toContain('item:archived-uniform');

      const operations = structuredTrace
        .getSpans()
        .map((span) => span.operation);
      expect(operations).toEqual(
        expect.arrayContaining([
          'candidate_collection',
          'priority_calculation',
          'final_selection',
        ])
      );

      const finalSelectionSpan = structuredTrace
        .getSpans()
        .find((span) => span.operation === 'final_selection');
      expect(finalSelectionSpan?.attributes?.selectedItem).toBe(skirtId);
      expect(finalSelectionSpan?.attributes?.tieBreakingUsed).toBe(true);
    });
  });

  describe('error handling integration', () => {
    it('surfaces invalid slot selections through the ScopeDSL error handler', () => {
      const characterId = 'entity:error-path-character';

      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          torso_upper: { base: 'item:linen-shirt' },
        },
      });

      const clothingResults = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: { resolve: () => new Set([characterId]) },
          trace: { addLog: jest.fn() },
        }
      );

      const clothingAccess = Array.from(clothingResults)[0];

      expect(() =>
        slotAccessResolver.resolve(
          {
            type: 'Step',
            field: 'unknown_slot',
            parent: { type: 'Step', field: 'topmost_clothing' },
          },
          {
            dispatcher: { resolve: () => new Set([clothingAccess]) },
            trace: { addLog: jest.fn() },
          }
        )
      ).toThrow(ScopeDslError);

      const bufferedErrors = errorHandler.getErrorBuffer();
      expect(bufferedErrors.length).toBeGreaterThan(0);
      expect(bufferedErrors[bufferedErrors.length - 1].code).toBe(
        ErrorCodes.INVALID_ENTITY_ID
      );
      expect(
        bufferedErrors[bufferedErrors.length - 1].sanitizedContext.slotName
      ).toBe('unknown_slot');
    });

    it('reports corrupted clothing access objects through the centralized handler', () => {
      const characterId = 'entity:corrupted-character';

      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          torso_lower: { base: 'item:simple-pants' },
        },
      });

      const clothingResults = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: { resolve: () => new Set([characterId]) },
          trace: { addLog: jest.fn() },
        }
      );

      const clothingAccess = Array.from(clothingResults)[0];
      delete clothingAccess.equipped;

      const structuredTrace = new StructuredTrace();
      const outerSpan = structuredTrace.startSpan('corruption_detection');

      expect(() =>
        slotAccessResolver.resolve(
          {
            type: 'Step',
            field: 'torso_lower',
            parent: { type: 'Step', field: 'topmost_clothing' },
          },
          {
            dispatcher: { resolve: () => new Set([clothingAccess]) },
            trace: structuredTrace,
            structuredTrace,
          }
        )
      ).toThrow(ScopeDslError);

      structuredTrace.endSpan(outerSpan);

      const bufferedErrors = errorHandler.getErrorBuffer();
      expect(bufferedErrors.length).toBeGreaterThan(0);
      expect(bufferedErrors[bufferedErrors.length - 1].code).toBe(
        ErrorCodes.MISSING_CONTEXT_GENERIC
      );
    });

    it('emits structured trace events when no candidates can be resolved', () => {
      const characterId = 'entity:empty-equipment';

      const clothingResults = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: { resolve: () => new Set([characterId]) },
          trace: { addLog: jest.fn() },
        }
      );

      const clothingAccess = Array.from(clothingResults)[0];
      expect(clothingAccess.equipped).toEqual({});

      const structuredTrace = new StructuredTrace();
      const outerSpan = structuredTrace.startSpan('empty_slot_resolution');

      const slotResults = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: { type: 'Step', field: 'topmost_clothing' },
        },
        {
          dispatcher: { resolve: () => new Set([clothingAccess]) },
          trace: structuredTrace,
          structuredTrace,
        }
      );

      structuredTrace.endSpan(outerSpan);

      expect(Array.from(slotResults)).toEqual([]);

      const emptySpan = structuredTrace
        .getSpans()
        .find((span) => span.operation === 'empty_slot_resolution');
      expect(emptySpan?.attributes?.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'no_slot_data' }),
        ])
      );
    });
  });
});
