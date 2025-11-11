/**
 * @file Unit tests for EstablishLyingClosenessHandler.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EstablishLyingClosenessHandler from '../../../../src/logic/operationHandlers/establishLyingClosenessHandler.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import { updateMovementLock } from '../../../../src/utils/movementUtils.js';
import { tryWriteContextVariable } from '../../../../src/utils/contextVariableUtils.js';
import { ComponentStateValidator } from '../../../../src/utils/componentStateValidator.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';
import * as dependencyUtils from '../../../../src/utils/dependencyUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));

jest.mock('../../../../src/utils/contextVariableUtils.js', () => ({
  tryWriteContextVariable: jest.fn(),
}));

jest.mock('../../../../src/utils/componentStateValidator.js', () => ({
  ComponentStateValidator: jest.fn(),
}));

jest.mock('../../../../src/logic/services/closenessCircleService.js', () => ({
  repair: jest.fn(),
  merge: jest.fn(),
}));

describe('EstablishLyingClosenessHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let executionContext;
  let assertNonBlankStringSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    closenessCircleService.repair.mockImplementation((partners) => {
      return [...new Set(partners)].sort();
    });

    executionContext = {
      evaluationContext: {
        context: {},
      },
    };

    ComponentStateValidator.mockImplementation(() => ({
      validateClosenessComponent: jest.fn(),
      validateBidirectionalCloseness: jest.fn(),
    }));

    assertNonBlankStringSpy = jest
      .spyOn(dependencyUtils, 'assertNonBlankString')
      .mockImplementation(() => true);

    handler = new EstablishLyingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService,
    });
  });

  afterEach(() => {
    assertNonBlankStringSpy.mockRestore();
  });

  const buildComponentData = () => {
    const components = {
      'furniture:1': {
        'positioning:allows_lying_on': {},
      },
      actor1: {
        'positioning:closeness': { partners: ['actor3'] },
        'positioning:lying_down': { furniture_id: 'furniture:1' },
      },
      actor2: {
        'positioning:closeness': { partners: ['actor3'] },
        'positioning:lying_down': { furniture_id: 'furniture:1' },
      },
      actor3: {
        'positioning:lying_down': { furniture_id: 'furniture:2' },
      },
    };

    mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
      return components[entityId]?.[componentName] ?? null;
    });
  };

  it('establishes bidirectional closeness for all lying actors and dispatches success', async () => {
    buildComponentData();

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([
      { id: 'actor1' },
      { id: 'actor2' },
      { id: 'actor3' },
    ]);

    const validatorInstances = [];
    ComponentStateValidator.mockImplementationOnce(() => {
      const instance = {
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      validatorInstances.push(instance);
      return instance;
    }).mockImplementationOnce(() => {
      const instance = {
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      validatorInstances.push(instance);
      return instance;
    });

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: 'actor1',
      result_variable: 'operationResult',
    };

    const result = await handler.execute(parameters, executionContext);

    expect(result).toEqual({ success: true, otherLyingActors: ['actor2'] });
    expect(validatorInstances[0].validateClosenessComponent).toHaveBeenCalledWith(
      'actor1',
      expect.objectContaining({ partners: ['actor3'] }),
      'establish lying closeness'
    );
    expect(validatorInstances[1].validateBidirectionalCloseness).toHaveBeenCalledWith(
      mockEntityManager,
      'actor1',
      'actor2'
    );
    expect(closenessCircleService.repair).toHaveBeenCalledWith(['actor3', 'actor2']);
    expect(closenessCircleService.repair).toHaveBeenCalledWith(['actor3', 'actor1']);
    expect(mockEntityManager.addComponent).toHaveBeenNthCalledWith(
      1,
      'actor1',
      'positioning:closeness',
      { partners: ['actor2', 'actor3'] }
    );
    expect(mockEntityManager.addComponent).toHaveBeenNthCalledWith(
      2,
      'actor2',
      'positioning:closeness',
      { partners: ['actor1', 'actor3'] }
    );
    expect(updateMovementLock).toHaveBeenCalledWith(mockEntityManager, 'actor1', true);
    expect(updateMovementLock).toHaveBeenCalledWith(mockEntityManager, 'actor2', true);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'positioning:lying_closeness_established',
      expect.objectContaining({
        actorId: 'actor1',
        furnitureId: 'furniture:1',
        otherLyingActors: ['actor2'],
      })
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'operationResult',
      true,
      executionContext,
      mockDispatcher,
      expect.objectContaining({ info: expect.any(Function) })
    );
  });

  it('does not duplicate existing closeness partners', async () => {
    const components = {
      'furniture:1': {
        'positioning:allows_lying_on': {},
      },
      actor1: {
        'positioning:closeness': { partners: ['actor2'] },
        'positioning:lying_down': { furniture_id: 'furniture:1' },
      },
      actor2: {
        'positioning:closeness': { partners: ['actor1'] },
        'positioning:lying_down': { furniture_id: 'furniture:1' },
      },
    };

    mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
      return components[entityId]?.[componentName] ?? null;
    });

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([
      { id: 'actor1' },
      { id: 'actor2' },
    ]);

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: 'actor1',
    };

    await handler.execute(parameters, executionContext);

    expect(mockEntityManager.addComponent).toHaveBeenNthCalledWith(
      1,
      'actor1',
      'positioning:closeness',
      { partners: ['actor2'] }
    );
    expect(mockEntityManager.addComponent).toHaveBeenNthCalledWith(
      2,
      'actor2',
      'positioning:closeness',
      { partners: ['actor1'] }
    );
  });

  it('initializes closeness partners when components are missing or invalid', async () => {
    const components = {
      'furniture:1': {
        'positioning:allows_lying_on': {},
      },
      actor1: {
        'positioning:lying_down': { furniture_id: 'furniture:1' },
      },
      actor2: {
        'positioning:closeness': { partners: 'actor1' },
        'positioning:lying_down': { furniture_id: 'furniture:1' },
      },
    };

    mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
      return components[entityId]?.[componentName] ?? null;
    });

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([
      { id: 'actor1' },
      { id: 'actor2' },
    ]);

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: 'actor1',
    };

    await handler.execute(parameters, executionContext);

    expect(mockEntityManager.addComponent).toHaveBeenNthCalledWith(
      1,
      'actor1',
      'positioning:closeness',
      { partners: ['actor2'] }
    );
    expect(mockEntityManager.addComponent).toHaveBeenNthCalledWith(
      2,
      'actor2',
      'positioning:closeness',
      { partners: ['actor1'] }
    );
  });

  it('logs info and returns success when no other lying actors are found', async () => {
    mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
      if (entityId === 'furniture:1' && componentName === 'positioning:allows_lying_on') {
        return {};
      }

      if (entityId === 'actor1' && componentName === 'positioning:lying_down') {
        return { furniture_id: 'furniture:1' };
      }

      if (entityId === 'actor1' && componentName === 'positioning:closeness') {
        return { partners: [] };
      }

      return null;
    });

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([{ id: 'actor1' }]);

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: 'actor1',
      result_variable: 'resultVar',
    };

    const result = await handler.execute(parameters, executionContext);

    expect(result).toEqual({ success: true, otherLyingActors: [] });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('No other lying actors found, closeness establishment skipped'),
      expect.objectContaining({ actorId: 'actor1', furnitureId: 'furniture:1' })
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'resultVar',
      true,
      executionContext,
      mockDispatcher,
      expect.any(Object)
    );
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('returns success without storing results when result_variable is omitted', async () => {
    mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
      if (entityId === 'furniture:1' && componentName === 'positioning:allows_lying_on') {
        return {};
      }

      if (entityId === 'actor1' && componentName === 'positioning:lying_down') {
        return { furniture_id: 'furniture:1' };
      }

      if (entityId === 'actor1' && componentName === 'positioning:closeness') {
        return { partners: [] };
      }

      return null;
    });

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([{ id: 'actor1' }]);

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: 'actor1',
    };

    const result = await handler.execute(parameters, executionContext);

    expect(result).toEqual({ success: true, otherLyingActors: [] });
    expect(tryWriteContextVariable).not.toHaveBeenCalled();
  });

  it('handles parameter validation failures through InvalidArgumentError wrapping', async () => {
    dependencyUtils.assertNonBlankString.mockImplementationOnce(() => {
      throw new Error('actor_id missing');
    });

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: '',
      result_variable: 'validationResult',
    };

    const result = await handler.execute(parameters, executionContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Parameter validation failed for establish lying closeness');
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'validationResult',
      false,
      executionContext,
      mockDispatcher,
      expect.any(Object)
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      expect.objectContaining({ dispatch: mockDispatcher.dispatch }),
      'Lying closeness establishment failed',
      expect.objectContaining({ actorId: '' }),
      expect.any(Object)
    );
  });

  it('handles missing furniture component errors', async () => {
    mockEntityManager.getComponentData.mockReturnValueOnce(null);

    const parameters = {
      furniture_id: 'furniture:missing',
      actor_id: 'actor1',
    };

    const result = await handler.execute(parameters, executionContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Furniture furniture:missing missing allows_lying_on component');
    expect(safeDispatchError).toHaveBeenCalled();
  });

  it('logs validation errors during final state verification without failing operation', async () => {
    buildComponentData();

    mockEntityManager.getEntitiesWithComponent.mockReturnValue([
      { id: 'actor1' },
      { id: 'actor2' },
    ]);

    ComponentStateValidator.mockImplementationOnce(() => ({
      validateClosenessComponent: jest.fn(),
      validateBidirectionalCloseness: jest.fn(),
    })).mockImplementationOnce(() => ({
      validateClosenessComponent: jest.fn(),
      validateBidirectionalCloseness: jest.fn(() => {
        throw new Error('Bidirectional relationship missing');
      }),
    }));

    const parameters = {
      furniture_id: 'furniture:1',
      actor_id: 'actor1',
    };

    const result = await handler.execute(parameters, executionContext);

    expect(result.success).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Final state validation failed'),
      expect.objectContaining({
        actorId: 'actor1',
        otherLyingActors: ['actor2'],
      })
    );
  });
});
