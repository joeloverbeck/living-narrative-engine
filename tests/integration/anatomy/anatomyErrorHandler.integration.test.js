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

/**
 *
 * @param root0
 * @param root0.includeCentral
 */
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

  it('returns the wrapped anatomy error when the central sync fallback flags a recovered state', () => {
    const { anatomyErrorHandler, centralErrorHandler } = harness;

    const syncStrategy = () => {
      throw new Error('sync strategy execution should rely on fallback metadata');
    };
    syncStrategy.sync = true;
    syncStrategy.fallback = (errorInfo) => ({
      recovered: true,
      recoveryId: errorInfo.id,
      contextOperation: errorInfo.context.operation,
    });

    centralErrorHandler.registerRecoveryStrategy('AnatomyGenerationError', syncStrategy);

    const upstreamError = new Error('bio-generator overheated');
    const result = anatomyErrorHandler.handle(upstreamError, {
      operation: 'generation',
      entityId: 'entity-recovered',
      recipeId: 'recipe-recovered',
    });

    expect(result).toBeInstanceOf(AnatomyGenerationError);
    expect(result.entityId).toBe('entity-recovered');
    expect(result.recipeId).toBe('recipe-recovered');
    expect(result.cause).toBe(upstreamError);
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

  it('falls back to local graph handling when the central async handler surfaces an unrecoverable error', async () => {
    const { anatomyErrorHandler } = harness;

    const rootError = new Error('graph topology corruption');

    const result = await anatomyErrorHandler.handleAsync(rootError, {
      operation: 'graphBuilding',
      rootId: 'root-critical',
    });

    expect(result).toBeInstanceOf(GraphBuildingError);
    expect(result.rootId).toBe('root-critical');
    expect(result.cause).toBe(rootError);
  });

  it('preserves metadata when handling pre-wrapped anatomy errors without central collaborators', () => {
    const localHarness = createHarness({ includeCentral: false });
    const { anatomyErrorHandler: localErrorHandler } = localHarness;

    const generationCause = new Error('thermal runaway');
    const wrappedGenerationError = new AnatomyGenerationError(
      'generation failed decisively',
      'entity-local',
      'recipe-local',
      generationCause,
    );

    const generationResult = localErrorHandler.handle(wrappedGenerationError, {
      operation: 'generation',
      entityId: 'entity-local',
      recipeId: 'recipe-local',
    });

    expect(generationResult).toBe(wrappedGenerationError);
    expect(generationResult.cause).toBe(generationCause);

    const descriptionCause = new Error('narrative subsystem offline');
    const wrappedDescriptionError = new DescriptionGenerationError(
      'description failed catastrophically',
      'entity-desc',
      ['arm', 'torso'],
      descriptionCause,
    );

    const descriptionResult = localErrorHandler.handleSync(wrappedDescriptionError, {
      operation: 'description',
      entityId: 'entity-desc',
      partIds: ['arm', 'torso'],
    });

    expect(descriptionResult).toBe(wrappedDescriptionError);
    expect(descriptionResult.partIds).toEqual(['arm', 'torso']);
    expect(descriptionResult.cause).toBe(descriptionCause);
  });
});
