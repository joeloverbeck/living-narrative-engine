/**
 * @file Integration tests for error handling in the clothing step resolver.
 * @description Exercises failure modes that require the resolver to cooperate with the
 * real ScopeDSL error handling infrastructure rather than isolated unit behaviour.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';

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

describe('ClothingStepResolver error handling integration', () => {
  let entityManager;
  /** @type {{ getComponentData: jest.Mock }} */
  let entitiesGateway;
  let logger;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([]);
    logger = createLogger();
    entitiesGateway = {
      getComponentData: jest.fn((entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId)
      ),
    };
  });

  /**
   *
   */
  function createErrorHandler() {
    const handler = new ScopeDslErrorHandler({
      logger,
      config: { isDevelopment: true, maxBufferSize: 20 },
    });
    handler.clearErrorBuffer();
    return handler;
  }

  /**
   *
   * @param field
   */
  function createNode(field = 'topmost_clothing') {
    return {
      type: 'Step',
      field,
      parent: { type: 'Variable', name: 'target' },
    };
  }

  /**
   *
   * @param results
   * @param options
   */
  function createContext(results, options = {}) {
    const { shouldThrowDuringResolve = false } = options;

    return {
      dispatcher: {
        resolve: () => {
          if (shouldThrowDuringResolve) {
            throw new Error('Parent resolution failed');
          }
          return new Set(Array.isArray(results) ? results : [results]);
        },
      },
      trace: {
        addLog: jest.fn(),
      },
    };
  }

  it('exposes canResolve for supported clothing nodes', () => {
    const resolver = createClothingStepResolver({ entitiesGateway });
    expect(resolver.canResolve(createNode('topmost_clothing'))).toBe(true);
    expect(resolver.canResolve(createNode('outer_clothing'))).toBe(true);
    expect(resolver.canResolve({ type: 'Step', field: 'nonexistent' })).toBe(false);
    expect(resolver.canResolve(null)).toBe(false);
  });

  it('returns an empty result without error handler when entity ids are invalid', () => {
    const resolver = createClothingStepResolver({ entitiesGateway });
    const node = createNode('topmost_clothing');
    const context = createContext(['', null, undefined, 42]);

    const result = resolver.resolve(node, context);

    expect(result.size).toBe(0);
    expect(entitiesGateway.getComponentData).not.toHaveBeenCalled();
  });

  it('provides a clothing access object when equipment is missing', async () => {
    const resolver = createClothingStepResolver({ entitiesGateway });
    const actorId = 'actor:missing-equipment';

    await entityManager.addComponent(actorId, 'clothing:equipment', {});

    const node = createNode('topmost_clothing_no_accessories');
    const context = createContext([actorId]);

    const result = resolver.resolve(node, context);
    const [clothingAccess] = Array.from(result);

    expect(clothingAccess).toMatchObject({
      __clothingSlotAccess: true,
      equipped: {},
      mode: 'topmost_no_accessories',
      type: 'clothing_slot_access',
      supportsPriorityCalculation: true,
      entityId: actorId,
    });
  });

  it('resolves clothing for multiple valid entities while ignoring non-string results', async () => {
    const resolver = createClothingStepResolver({ entitiesGateway });
    const firstActor = 'actor:one';
    const secondActor = 'actor:two';

    await entityManager.addComponent(firstActor, 'clothing:equipment', {
      equipped: { torso_upper: { base: 'clothing:cloak' } },
    });
    await entityManager.addComponent(secondActor, 'clothing:equipment', {
      equipped: { torso_upper: { base: 'clothing:coat' } },
    });

    const node = createNode('outer_clothing');
    const context = createContext([firstActor, { bogus: true }, secondActor]);

    const result = resolver.resolve(node, context);
    const resolvedEntities = Array.from(result).map((entry) => entry.entityId);

    expect(resolvedEntities).toContain(firstActor);
    expect(resolvedEntities).toContain(secondActor);
    expect(resolvedEntities).not.toContain('[object Object]');
    expect(entitiesGateway.getComponentData).toHaveBeenCalledTimes(2);
  });

  it('buffers invalid entity errors when an error handler is provided', () => {
    const errorHandler = createErrorHandler();
    const resolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    const node = createNode('topmost_clothing');
    const context = createContext(['']);

    expect(() => resolver.resolve(node, context)).toThrow(ScopeDslError);

    const [entry] = errorHandler.getErrorBuffer();
    expect(entry.code).toBe(ErrorCodes.INVALID_ENTITY_ID);
    expect(entry.resolverName).toBe('ClothingStepResolver');
    expect(entry.sanitizedContext).toMatchObject({ entityId: '', field: 'topmost_clothing' });
  });

  it('records invalid clothing reference errors when the field is unknown', async () => {
    const errorHandler = createErrorHandler();
    const resolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    const actorId = 'actor:unknown-field';
    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { torso_upper: { base: 'clothing:shirt' } },
    });

    const node = createNode('nonexistent_clothing_field');
    const context = createContext([actorId]);

    expect(() => resolver.resolve(node, context)).toThrow(ScopeDslError);

    const [entry] = errorHandler.getErrorBuffer();
    expect(entry.code).toBe(ErrorCodes.INVALID_ENTITY_ID);
    expect(entry.message).toContain('Invalid clothing reference');
    expect(entry.sanitizedContext).toMatchObject({ field: 'nonexistent_clothing_field', entityId: actorId });
  });

  it('captures component resolution failures from the entities gateway', () => {
    const errorHandler = createErrorHandler();
    const throwingGateway = {
      getComponentData: jest.fn(() => {
        throw new Error('Missing component');
      }),
    };
    const resolver = createClothingStepResolver({
      entitiesGateway: throwingGateway,
      errorHandler,
    });

    const node = createNode('topmost_clothing');
    const context = createContext(['actor:missing-component']);

    expect(() => resolver.resolve(node, context)).toThrow(ScopeDslError);

    expect(throwingGateway.getComponentData).toHaveBeenCalledWith(
      'actor:missing-component',
      'clothing:equipment'
    );
    const [entry] = errorHandler.getErrorBuffer();
    expect(entry.code).toBe(ErrorCodes.COMPONENT_RESOLUTION_FAILED);
    expect(entry.sanitizedContext).toMatchObject({ entityId: 'actor:missing-component', field: 'topmost_clothing' });
  });

  it('reports missing dispatcher scenarios through the error handler', () => {
    const errorHandler = createErrorHandler();
    const resolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    const node = createNode('topmost_clothing');

    expect(() => resolver.resolve(node, {})).toThrow(ScopeDslError);

    const [entry] = errorHandler.getErrorBuffer();
    expect(entry.code).toBe(ErrorCodes.MISSING_DISPATCHER);
    expect(entry.sanitizedContext).toMatchObject({ hasDispatcher: false });
  });

  it('reports invalid node structures to the error handler', () => {
    const errorHandler = createErrorHandler();
    const resolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    const badNode = { type: 'Step' }; // missing field
    const context = createContext(['actor:bad-node']);

    expect(() => resolver.resolve(badNode, context)).toThrow(ScopeDslError);

    const [entry] = errorHandler.getErrorBuffer();
    expect(entry.code).toBe(ErrorCodes.INVALID_NODE_STRUCTURE);
    expect(entry.sanitizedContext).toMatchObject({ node: { type: 'Step' } });
  });

  it('surfaces parent resolution failures with detailed context', () => {
    const errorHandler = createErrorHandler();
    const resolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    const node = createNode('outer_clothing');
    const context = createContext(['actor:irrelevant'], {
      shouldThrowDuringResolve: true,
    });

    expect(() => resolver.resolve(node, context)).toThrow(ScopeDslError);

    const [entry] = errorHandler.getErrorBuffer();
    expect(entry.code).toBe(ErrorCodes.STEP_RESOLUTION_FAILED);
    expect(entry.sanitizedContext).toMatchObject({ field: 'outer_clothing' });
  });
});
