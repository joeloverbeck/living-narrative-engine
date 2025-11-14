import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import { VisualizerState } from '../../../src/domUI/visualizer/VisualizerState.js';
import { VisualizerStateController } from '../../../src/domUI/visualizer/VisualizerStateController.js';
import { AnatomyLoadingDetector } from '../../../src/domUI/visualizer/AnatomyLoadingDetector.js';
import { RetryStrategy } from '../../../src/domUI/visualizer/RetryStrategy.js';
import { ErrorRecovery } from '../../../src/domUI/visualizer/ErrorRecovery.js';
import { ErrorReporter } from '../../../src/domUI/visualizer/ErrorReporter.js';
import { AnatomyStateError } from '../../../src/errors/anatomyStateError.js';
import { AnatomyDataError } from '../../../src/errors/anatomyDataError.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createValidAnatomyEntity = (id = 'entity:test') => ({
  id,
  components: {
    'anatomy:body': {
      recipeId: 'anatomy:recipe',
      body: {
        root: 'torso',
        parts: {
          torso: { id: 'torso', connections: ['head'] },
          head: { id: 'head', connections: [] },
        },
      },
    },
    'core:description': { text: 'Test anatomy description' },
  },
});

const createControllerEnv = ({
  entities = [],
  logger = createTestLogger(),
  eventDispatcher,
  entityManager,
  visualizerState,
  anatomyLoadingDetector,
  errorRecovery,
  errorReporter,
  retryStrategy,
} = {}) => {
  const manager = entityManager ?? new SimpleEntityManager(entities);
  const dispatcher =
    eventDispatcher ??
    new EventBus({
      logger,
    });
  const state = visualizerState ?? new VisualizerState();
  const detector =
    anatomyLoadingDetector ??
    new AnatomyLoadingDetector({
      entityManager: manager,
      eventDispatcher: dispatcher,
      logger,
    });
  const strategy =
    retryStrategy ??
    new RetryStrategy(
      { logger },
      {
        maxAttempts: 2,
        baseDelayMs: 1,
        circuitBreakerThreshold: 4,
        circuitBreakerTimeoutMs: 5,
        strategy: RetryStrategy.STRATEGY_TYPES.LINEAR,
      }
    );
  const reporter =
    errorReporter ??
    new ErrorReporter(
      { logger, eventDispatcher: dispatcher },
      { enableMetrics: false, reportLevels: ['CRITICAL', 'HIGH'], maxStackTraceLines: 2 }
    );
  const recovery =
    errorRecovery ??
    new ErrorRecovery(
      { logger, eventDispatcher: dispatcher },
      { maxRetryAttempts: 1, retryDelayMs: 1, useExponentialBackoff: false }
    );

  const controller = new VisualizerStateController({
    visualizerState: state,
    anatomyLoadingDetector: detector,
    eventDispatcher: dispatcher,
    entityManager: manager,
    logger,
    errorRecovery: recovery,
    errorReporter: reporter,
    retryStrategy: strategy,
  });

  return {
    controller,
    visualizerState: state,
    entityManager: manager,
    eventDispatcher: dispatcher,
    anatomyLoadingDetector: detector,
    errorRecovery: recovery,
    errorReporter: reporter,
    retryStrategy: strategy,
    logger,
  };
};

describe('VisualizerStateController integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects entities with production collaborators and dispatches UI state changes', async () => {
    const entity = createValidAnatomyEntity('entity:visual-success');
    const env = createControllerEnv({ entities: [entity] });
    const dispatchSpy = jest.spyOn(env.eventDispatcher, 'dispatch');

    await env.controller.selectEntity(entity.id);

    expect(env.controller.getCurrentState()).toBe('LOADED');
    expect(env.controller.getSelectedEntity()).toBe(entity.id);
    expect(env.controller.getAnatomyData()).toEqual(
      entity.components['anatomy:body'].body
    );
    expect(env.controller.getError()).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith(
      'anatomy:visualizer_state_changed',
      expect.objectContaining({
        currentState: 'LOADED',
        selectedEntity: entity.id,
      })
    );
  });

  it('invokes error recovery when entity id input is invalid', async () => {
    const entity = createValidAnatomyEntity('entity:invalid-input');
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(),
    };
    const errorRecovery = {
      handleError: jest.fn().mockResolvedValue({ success: false }),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [entity],
      errorReporter,
      errorRecovery,
    });

    await env.controller.selectEntity('');

    expect(errorReporter.report).toHaveBeenCalledWith(
      expect.any(AnatomyStateError),
      expect.objectContaining({
        operation: 'entity_selection',
        component: 'VisualizerStateController',
      })
    );
    expect(errorRecovery.handleError).toHaveBeenCalledWith(
      expect.any(AnatomyStateError),
      expect.objectContaining({ operation: 'entity_selection' })
    );
    expect(env.controller.getError()).toBeInstanceOf(AnatomyStateError);
  });

  it('prevents concurrent selections while loading and surfaces recovery context', async () => {
    const entity = createValidAnatomyEntity('entity:loading-guard');
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(),
    };
    const errorRecovery = {
      handleError: jest.fn().mockResolvedValue({ success: false }),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [entity],
      errorReporter,
      errorRecovery,
    });

    env.visualizerState.selectEntity('entity:in-flight');
    await env.controller.selectEntity(entity.id);

    expect(errorRecovery.handleError).toHaveBeenCalledWith(
      expect.any(AnatomyStateError),
      expect.objectContaining({ operation: 'entity_selection' })
    );
  });

  it('reports timeouts when anatomy loading never completes', async () => {
    const entity = createValidAnatomyEntity('entity:timeout');
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(),
    };
    const errorRecovery = {
      handleError: jest.fn().mockResolvedValue({ success: false }),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [entity],
      errorReporter,
      errorRecovery,
    });
    jest
      .spyOn(env.anatomyLoadingDetector, 'waitForEntityWithAnatomy')
      .mockResolvedValue(false);

    await env.controller.selectEntity(entity.id);

    const [error, context] = errorRecovery.handleError.mock.calls[0];
    expect(error).toBeInstanceOf(AnatomyStateError);
    expect(context).toEqual(
      expect.objectContaining({
        operation: 'entity_selection',
        data: expect.objectContaining({
          entityId: entity.id,
          retryCallback: expect.any(Function),
        }),
      })
    );
  });

  it('validates anatomy data structure while processing entities', async () => {
    const nullBodyEntity = createValidAnatomyEntity('entity:null-body');
    nullBodyEntity.components['anatomy:body'] = { body: null };
    nullBodyEntity.components['core:description'] = { text: 'Null body' };
    const missingRootEntity = createValidAnatomyEntity('entity:no-root');
    missingRootEntity.components['anatomy:body'] = { body: { parts: {} } };
    missingRootEntity.components['core:description'] = { text: 'Missing root' };
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(),
    };
    const errorRecovery = {
      handleError: jest.fn().mockResolvedValue({ success: false }),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [nullBodyEntity, missingRootEntity],
      errorReporter,
      errorRecovery,
    });
    jest
      .spyOn(env.anatomyLoadingDetector, 'waitForEntityWithAnatomy')
      .mockResolvedValue(true);

    await env.controller.selectEntity(nullBodyEntity.id);
    await env.controller.selectEntity(missingRootEntity.id);

    expect(env.logger.error).toHaveBeenNthCalledWith(
      1,
      `Failed to process anatomy data for entity ${nullBodyEntity.id}:`,
      expect.any(AnatomyDataError)
    );
    expect(env.logger.error).toHaveBeenNthCalledWith(
      2,
      `Failed to process anatomy data for entity ${missingRootEntity.id}:`,
      expect.any(AnatomyDataError)
    );
    expect(errorRecovery.handleError).toHaveBeenCalledTimes(2);
    expect(errorRecovery.handleError.mock.calls[0][0]).toBeInstanceOf(AnatomyDataError);
    expect(errorRecovery.handleError.mock.calls[1][0]).toBeInstanceOf(AnatomyDataError);
  });

  it('applies structured recovery results and advances rendering state', async () => {
    const entity = createValidAnatomyEntity('entity:recovery');
    const bodyData = entity.components['anatomy:body'].body;
    const errorRecovery = {
      handleError: jest
        .fn()
        .mockResolvedValueOnce({ success: true, result: { emptyVisualization: true } })
        .mockResolvedValueOnce({ success: true, result: { stateReset: true } })
        .mockResolvedValueOnce({ success: true, result: { textFallback: true } }),
      dispose: jest.fn(),
    };
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [entity],
      errorRecovery,
      errorReporter,
    });

    await env.controller.handleError(new Error('empty'), { operation: 'rendering' });
    expect(env.logger.warn).toHaveBeenCalledWith(
      'Failed to apply recovery result:',
      expect.any(Error)
    );

    env.visualizerState.selectEntity(entity.id);
    env.visualizerState.setError(new Error('state-reset'));
    await env.controller.handleError(new Error('reset'), { operation: 'rendering' });
    expect(env.controller.getCurrentState()).toBe('IDLE');

    env.visualizerState.selectEntity(entity.id);
    env.visualizerState.setAnatomyData(bodyData);
    env.visualizerState.startRendering();
    await env.controller.handleError(new Error('text'), { operation: 'rendering' });
    expect(env.controller.getCurrentState()).toBe('READY');
    expect(env.logger.info).toHaveBeenCalledWith(
      'Error recovery successful for operation: rendering'
    );
    expect(errorReporter.report).toHaveBeenCalledTimes(3);
  });

  it('falls back to error state when recovery pipeline throws', async () => {
    const entity = createValidAnatomyEntity('entity:recovery-failure');
    const errorRecovery = {
      handleError: jest.fn().mockRejectedValue(new Error('recovery failure')),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [entity],
      errorRecovery,
    });

    await env.controller.handleError(new Error('catastrophic'), {
      operation: 'rendering',
    });

    expect(env.logger.error).toHaveBeenCalledWith(
      'Error recovery failed:',
      expect.any(Error)
    );
    expect(env.controller.getError()).toBeInstanceOf(Error);
  });

  it('exposes retry, reset, and accessor helpers', () => {
    const entity = createValidAnatomyEntity('entity:accessors');
    const bodyData = entity.components['anatomy:body'].body;
    const env = createControllerEnv({ entities: [entity] });

    expect(env.controller.getCurrentState()).toBe('IDLE');
    expect(env.controller.getSelectedEntity()).toBeNull();
    expect(env.controller.getAnatomyData()).toBeNull();
    expect(env.controller.getError()).toBeNull();
    expect(env.controller.isDisposed()).toBe(false);

    expect(() => env.controller.retry()).toThrow('Cannot retry when not in ERROR state');

    env.visualizerState.selectEntity(entity.id);
    env.visualizerState.setAnatomyData(bodyData);
    env.visualizerState.setError(new Error('boom'));
    env.controller.retry();
    expect(env.controller.getCurrentState()).toBe('LOADING');

    env.controller.reset();
    expect(env.controller.getCurrentState()).toBe('IDLE');
    expect(env.controller.getSelectedEntity()).toBeNull();
    expect(env.controller.getAnatomyData()).toBeNull();
  });

  it('enforces rendering state transitions', () => {
    const entity = createValidAnatomyEntity('entity:rendering');
    const bodyData = entity.components['anatomy:body'].body;
    const env = createControllerEnv({ entities: [entity] });

    expect(() => env.controller.startRendering()).toThrow(
      'Cannot start rendering from IDLE state'
    );
    expect(() => env.controller.completeRendering()).toThrow(
      'Cannot complete rendering from IDLE state'
    );

    env.visualizerState.selectEntity(entity.id);
    env.visualizerState.setAnatomyData(bodyData);
    env.controller.startRendering();
    env.controller.completeRendering();
    expect(env.controller.getCurrentState()).toBe('READY');
  });

  it('logs dispatch failures while propagating state changes', async () => {
    const entity = createValidAnatomyEntity('entity:dispatch');
    const logger = createTestLogger();
    class ThrowingDispatcher {
      dispatch() {
        throw new Error('dispatch failure');
      }
      subscribe() {
        return () => {};
      }
    }
    const dispatcher = new ThrowingDispatcher();
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(),
    };
    const errorRecovery = {
      handleError: jest.fn().mockResolvedValue({ success: false }),
      dispose: jest.fn(),
    };
    const env = createControllerEnv({
      entities: [entity],
      logger,
      eventDispatcher: dispatcher,
      errorReporter,
      errorRecovery,
    });

    await env.controller.selectEntity(entity.id);

    expect(logger.warn).toHaveBeenCalledWith(
      'Error dispatching state change event:',
      expect.any(Error)
    );
  });

  it('disposes resources, suppresses late events, and guards future calls', async () => {
    const entity = createValidAnatomyEntity('entity:dispose');
    const logger = createTestLogger();
    const eventDispatcher = new EventBus({ logger });
    const entityManager = new SimpleEntityManager([entity]);
    const detector = new AnatomyLoadingDetector({
      entityManager,
      eventDispatcher,
      logger,
    });
    jest.spyOn(detector, 'dispose').mockImplementation(() => {
      throw new Error('detector dispose fail');
    });
    const errorRecovery = {
      handleError: jest.fn().mockResolvedValue({ success: false }),
      dispose: jest.fn(() => {
        throw new Error('recovery dispose fail');
      }),
    };
    const errorReporter = {
      report: jest.fn().mockResolvedValue({ status: 'reported' }),
      dispose: jest.fn(() => {
        throw new Error('reporter dispose fail');
      }),
    };
    const visualizerState = new VisualizerState();
    const originalSubscribe = visualizerState.subscribe.bind(visualizerState);
    visualizerState.subscribe = (observer) => {
      originalSubscribe(observer);
      return () => {
        throw new Error('unsubscribe failure');
      };
    };
    visualizerState.dispose = jest.fn();
    const env = createControllerEnv({
      entities: [entity],
      logger,
      eventDispatcher,
      entityManager,
      anatomyLoadingDetector: detector,
      errorRecovery,
      errorReporter,
      visualizerState,
    });
    const dispatchSpy = jest.spyOn(eventDispatcher, 'dispatch');

    await env.controller.selectEntity(entity.id);
    env.controller.dispose();

    expect(logger.warn).toHaveBeenCalledWith(
      'Error unsubscribing from state changes:',
      expect.any(Error)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Error disposing dependencies:',
      expect.any(Error)
    );
    expect(env.controller.isDisposed()).toBe(true);
    await expect(env.controller.selectEntity(entity.id)).rejects.toThrow(
      'VisualizerStateController has been disposed'
    );
    expect(() => env.controller.getCurrentState()).toThrow(
      'VisualizerStateController has been disposed'
    );

    const previousDispatchCount = dispatchSpy.mock.calls.length;
    visualizerState.selectEntity('entity:post-dispose');
    expect(dispatchSpy.mock.calls.length).toBe(previousDispatchCount);

    env.controller.dispose();
  });
});
