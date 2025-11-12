import { describe, beforeEach, it, expect } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import RecoveryStrategyManager from '../../../src/errors/RecoveryStrategyManager.js';
import MonitoringCoordinator from '../../../src/entities/monitoring/MonitoringCoordinator.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import {
  AnatomyErrorHandler,
  AnatomyGenerationError,
  DescriptionGenerationError,
  GraphBuildingError,
} from '../../../src/anatomy/orchestration/anatomyErrorHandler.js';

function createHarness({ includeCentral = true } = {}) {
  const logger = new ConsoleLogger(LogLevel.NONE);
  const eventBus = new EventBus({ logger });
  const monitoringCoordinator = new MonitoringCoordinator({
    logger,
    eventBus,
    enabled: false,
  });
  monitoringCoordinator.setEnabled(false);

  let centralErrorHandler = null;
  let recoveryStrategyManager = null;

  if (includeCentral) {
    centralErrorHandler = new CentralErrorHandler({
      logger,
      eventBus,
      monitoringCoordinator,
    });
    recoveryStrategyManager = new RecoveryStrategyManager({
      logger,
      monitoringCoordinator,
    });
  }

  const dispatchEvents = [];
  const originalDispatch = eventBus.dispatch.bind(eventBus);
  eventBus.dispatch = (eventNameOrEvent, payload = {}) => {
    if (typeof eventNameOrEvent === 'object' && eventNameOrEvent !== null) {
      const event = eventNameOrEvent;
      dispatchEvents.push(event);
      return originalDispatch(event.type, event.payload ?? {});
    }

    dispatchEvents.push({ type: eventNameOrEvent, payload });
    return originalDispatch(eventNameOrEvent, payload);
  };

  const anatomyErrorHandler = new AnatomyErrorHandler({
    logger,
    centralErrorHandler,
    recoveryStrategyManager,
  });

  return {
    logger,
    eventBus,
    monitoringCoordinator,
    centralErrorHandler,
    recoveryStrategyManager,
    anatomyErrorHandler,
    dispatchEvents,
  };
}

describe('AnatomyErrorHandler integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('delegates synchronous generation failures to the central handler fallback when available', () => {
    const { anatomyErrorHandler, centralErrorHandler, dispatchEvents } = harness;

    const syncStrategy = () => {
      throw new Error('synchronous strategies should rely on fallback');
    };
    syncStrategy.sync = true;
    syncStrategy.fallback = (errorInfo) => ({
      handledBy: 'central-sync',
      errorType: errorInfo.type,
      entityFromContext: errorInfo.context.entityId,
      operation: errorInfo.context.operation,
    });

    centralErrorHandler.registerRecoveryStrategy('AnatomyGenerationError', syncStrategy);

    const result = anatomyErrorHandler.handle(new Error('generation pipeline halted'), {
      operation: 'generation',
      entityId: 'entity-sync',
      recipeId: 'recipe-sync',
    });

    expect(result).toEqual({
      handledBy: 'central-sync',
      errorType: 'AnatomyGenerationError',
      entityFromContext: 'entity-sync',
      operation: 'generation',
    });

    const errorEvents = dispatchEvents.filter((event) => event.type === 'ERROR_OCCURRED');
    expect(errorEvents.some((event) => event.payload?.errorType === 'AnatomyGenerationError')).toBe(true);
  });

  it('wraps errors in graph-specific metadata and falls back to local handling when central sync handling fails', () => {
    const { anatomyErrorHandler } = harness;

    const result = anatomyErrorHandler.handle(new Error('graph linkage missing'), {
      operation: 'graphBuilding',
      rootId: 'root-node-42',
    });

    expect(result).toBeInstanceOf(GraphBuildingError);
    expect(result.rootId).toBe('root-node-42');
    expect(result.message).toContain('Graph building failed: graph linkage missing');
  });

  it('registers anatomy recovery strategies that surface detailed fallbacks from the recovery manager', async () => {
    const { recoveryStrategyManager } = harness;

    const anatomyFallback = await recoveryStrategyManager.executeWithRecovery(
      async () => {
        throw new AnatomyGenerationError('primary anatomy service failure', 'entity-1', 'recipe-1');
      },
      {
        operationName: 'anatomy-generation',
        errorType: 'AnatomyGenerationError',
        useCircuitBreaker: false,
        cacheResult: false,
        maxRetries: 1,
      }
    );

    expect(anatomyFallback).toEqual({
      type: 'fallback',
      entityId: 'entity-1',
      parts: [
        { id: 'head', type: 'head', description: 'head' },
        { id: 'torso', type: 'torso', description: 'torso' },
        { id: 'leftArm', type: 'arm', description: 'left arm' },
        { id: 'rightArm', type: 'arm', description: 'right arm' },
        { id: 'leftLeg', type: 'leg', description: 'left leg' },
        { id: 'rightLeg', type: 'leg', description: 'right leg' },
      ],
    });

    const descriptionFallback = await recoveryStrategyManager.executeWithRecovery(
      async () => {
        throw new DescriptionGenerationError('language model timeout', 'entity-2', ['torso', 'leftArm']);
      },
      {
        operationName: 'description-generation',
        errorType: 'DescriptionGenerationError',
        useCircuitBreaker: false,
        cacheResult: false,
        maxRetries: 1,
      }
    );

    expect(descriptionFallback).toEqual({
      type: 'fallback',
      entityId: 'entity-2',
      description: 'A standard humanoid form.',
      parts: [
        { id: 'torso', description: 'torso part' },
        { id: 'leftArm', description: 'leftArm part' },
      ],
    });

    const graphFallback = await recoveryStrategyManager.executeWithRecovery(
      async () => {
        throw new GraphBuildingError('graph service offline', 'root-node');
      },
      {
        operationName: 'graph-building',
        errorType: 'GraphBuildingError',
        useCircuitBreaker: false,
        cacheResult: false,
        maxRetries: 1,
      }
    );

    expect(graphFallback).toEqual({
      type: 'fallback',
      rootId: 'root-node',
      nodes: [{ id: 'root-node', type: 'root' }],
      edges: [],
    });

    const metrics = recoveryStrategyManager.getMetrics();
    expect(metrics.registeredStrategies).toBeGreaterThanOrEqual(3);
  });

  it('awaits the central handler recovery path when handling async description failures', async () => {
    const { anatomyErrorHandler, centralErrorHandler, recoveryStrategyManager } = harness;

    centralErrorHandler.registerRecoveryStrategy('DescriptionGenerationError', async (errorInfo) => {
      return recoveryStrategyManager.executeWithRecovery(
        async () => {
          throw errorInfo.originalError;
        },
        {
          operationName: 'description-recovery',
          errorType: 'DescriptionGenerationError',
          useCircuitBreaker: false,
          cacheResult: false,
          maxRetries: 1,
        }
      );
    });

    const result = await anatomyErrorHandler.handleAsync(new Error('stream interruption detected'), {
      operation: 'description',
      entityId: 'entity-async',
      partIds: ['spine', 'rightArm'],
    });

    expect(result).toEqual({
      type: 'fallback',
      entityId: 'entity-async',
      description: 'A standard humanoid form.',
      parts: [
        { id: 'spine', description: 'spine part' },
        { id: 'rightArm', description: 'rightArm part' },
      ],
    });
  });
});
