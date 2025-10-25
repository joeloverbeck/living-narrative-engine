import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AnatomyErrorHandler,
  AnatomyGenerationError,
  DescriptionGenerationError,
  GraphBuildingError,
} from '../../../../src/anatomy/orchestration/anatomyErrorHandler.js';
import { createMockLogger } from '../../../common/mockFactories.js';

describe('AnatomyErrorHandler', () => {
  let logger;
  let handler;

  beforeEach(() => {
    logger = createMockLogger();
    handler = new AnatomyErrorHandler({ logger });
  });

  it('returns the same error when already wrapped', () => {
    const error = new AnatomyGenerationError('msg', 'e1', 'r1');
    const result = handler.handle(error, {
      operation: 'generation',
      entityId: 'e1',
      recipeId: 'r1',
    });
    expect(result).toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      'AnatomyErrorHandler: AnatomyGenerationError occurred during anatomy operation',
      expect.objectContaining({
        error: 'msg',
        context: { operation: 'generation', entityId: 'e1', recipeId: 'r1' },
        entityId: 'e1',
        recipeId: 'r1',
      })
    );
  });

  it('wraps generic errors for generation operation', () => {
    const error = new Error('boom');
    const result = handler.handle(error, {
      operation: 'generation',
      entityId: 'e2',
      recipeId: 'r2',
    });
    expect(result).toBeInstanceOf(AnatomyGenerationError);
    expect(result.cause).toBe(error);
    expect(result.entityId).toBe('e2');
    expect(result.recipeId).toBe('r2');
  });

  it('wraps generic errors for description operation', () => {
    const error = new Error('oops');
    const result = handler.handle(error, {
      operation: 'description',
      entityId: 'e3',
      partIds: ['p1', 'p2'],
    });
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    expect(result.partIds).toEqual(['p1', 'p2']);
    expect(result.cause).toBe(error);
  });

  it('wraps generic errors for graphBuilding operation', () => {
    const error = new Error('bad');
    const result = handler.handle(error, {
      operation: 'graphBuilding',
      rootId: 'root-1',
    });
    expect(result).toBeInstanceOf(GraphBuildingError);
    expect(result.rootId).toBe('root-1');
    expect(result.cause).toBe(error);
  });

  it('defaults to AnatomyGenerationError when operation unknown', () => {
    const error = new Error('fail');
    const result = handler.handle(error, { entityId: 'e4' });
    expect(result).toBeInstanceOf(AnatomyGenerationError);
    expect(result.entityId).toBe('e4');
  });

  it('logs cause information when present', () => {
    const cause = new Error('inner');
    const error = new Error('outer', { cause });
    const result = handler.handle(error, {
      operation: 'generation',
      entityId: 'e5',
    });
    expect(result.cause).toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      'AnatomyErrorHandler: Error occurred during anatomy operation',
      expect.objectContaining({
        causedBy: { name: cause.name, message: cause.message },
        context: { operation: 'generation', entityId: 'e5' },
      })
    );
  });

  describe('central error handler integration', () => {
    let centralErrorHandler;
    let recoveryStrategyManager;
    let handler;

    beforeEach(() => {
      centralErrorHandler = {
        handle: jest.fn().mockResolvedValue({ recovered: true, fallbackData: {} }),
        handleSync: jest.fn().mockReturnValue({ recovered: true, fallbackData: {} })
      };

      recoveryStrategyManager = {
        executeWithRecovery: jest.fn(),
        registerStrategy: jest.fn()
      };

      handler = new AnatomyErrorHandler({
        logger,
        centralErrorHandler,
        recoveryStrategyManager
      });
    });

    it('delegates to central error handler when available (async)', async () => {
      const error = new Error('test error');
      const context = { operation: 'generation', entityId: 'e1' };

      await handler.handleAsync(error, context);

      expect(centralErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(AnatomyGenerationError),
        expect.objectContaining({
          ...context,
          domain: 'anatomy'
        })
      );
    });

    it('delegates to central error handler when available (sync)', () => {
      const error = new Error('test error');
      const context = { operation: 'generation', entityId: 'e1' };

      handler.handle(error, context);

      expect(centralErrorHandler.handleSync).toHaveBeenCalledWith(
        expect.any(AnatomyGenerationError),
        expect.objectContaining({
          ...context,
          domain: 'anatomy'
        })
      );
    });

    it('returns wrapped error when central handler reports recovery', () => {
      const error = new Error('test error');
      const context = { operation: 'generation', entityId: 'e1' };

      const result = handler.handle(error, context);

      const wrappedError = centralErrorHandler.handleSync.mock.calls[0][0];
      expect(result).toBe(wrappedError);
      expect(result).toBeInstanceOf(AnatomyGenerationError);
      expect(result.cause).toBe(error);
    });

    it('returns central handler result when no recovery metadata provided', () => {
      const centralResult = { processed: true };
      centralErrorHandler.handleSync.mockReturnValueOnce(centralResult);

      const error = new Error('another test error');
      const context = { operation: 'generation', entityId: 'e2' };

      const result = handler.handle(error, context);

      expect(result).toBe(centralResult);
      const wrappedError = centralErrorHandler.handleSync.mock.calls[0][0];
      expect(result).not.toBe(wrappedError);
    });

    it('returns async central handler result', async () => {
      const centralResult = { recovered: false, reason: 'handled elsewhere' };
      centralErrorHandler.handle.mockResolvedValueOnce(centralResult);

      const error = new Error('async failure');
      const context = { operation: 'generation', entityId: 'e3' };

      const result = await handler.handleAsync(error, context);

      expect(result).toBe(centralResult);
    });

    it('registers recovery strategies on initialization', () => {
      expect(recoveryStrategyManager.registerStrategy).toHaveBeenCalledWith(
        'AnatomyGenerationError',
        expect.objectContaining({
          retry: expect.objectContaining({
            maxRetries: 2,
            backoff: 'exponential'
          }),
          fallback: expect.any(Function),
          circuitBreaker: expect.objectContaining({
            failureThreshold: 3,
            resetTimeout: 120000
          })
        })
      );

      expect(recoveryStrategyManager.registerStrategy).toHaveBeenCalledWith(
        'DescriptionGenerationError',
        expect.objectContaining({
          retry: expect.objectContaining({
            maxRetries: 3,
            backoff: 'linear'
          }),
          fallback: expect.any(Function)
        })
      );

      expect(recoveryStrategyManager.registerStrategy).toHaveBeenCalledWith(
        'GraphBuildingError',
        expect.objectContaining({
          retry: expect.objectContaining({
            maxRetries: 1,
            backoff: 'constant'
          }),
          fallback: expect.any(Function)
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Anatomy recovery strategies registered with central system'
      );
    });

    it('falls back to local handling if central handler fails (async)', async () => {
      centralErrorHandler.handle.mockRejectedValueOnce(new Error('Central handler failed'));

      const error = new Error('test error');
      const context = { operation: 'generation', entityId: 'e1' };

      const result = await handler.handleAsync(error, context);

      expect(result).toBeInstanceOf(AnatomyGenerationError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Central error handler failed, using local handling',
        expect.objectContaining({ error: 'Central handler failed' })
      );
    });

    it('falls back to local handling if central handler fails (sync)', () => {
      centralErrorHandler.handleSync.mockImplementationOnce(() => {
        throw new Error('Central handler failed');
      });

      const error = new Error('test error');
      const context = { operation: 'generation', entityId: 'e1' };

      const result = handler.handle(error, context);

      expect(result).toBeInstanceOf(AnatomyGenerationError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Central error handler failed, using local handling',
        expect.objectContaining({ error: 'Central handler failed' })
      );
    });

    it('provides fallback data for anatomy errors', async () => {
      const anatomyStrategy = recoveryStrategyManager.registerStrategy.mock.calls.find(
        ([name]) => name === 'AnatomyGenerationError'
      )[1];
      logger.warn.mockClear();

      const fallbackResult = await anatomyStrategy.fallback({
        context: { entityId: 'entity-123' }
      });

      expect(logger.warn).toHaveBeenCalledWith('Using default anatomy fallback');
      expect(fallbackResult).toEqual({
        type: 'fallback',
        entityId: 'entity-123',
        parts: [
          { id: 'head', type: 'head', description: 'head' },
          { id: 'torso', type: 'torso', description: 'torso' },
          { id: 'leftArm', type: 'arm', description: 'left arm' },
          { id: 'rightArm', type: 'arm', description: 'right arm' },
          { id: 'leftLeg', type: 'leg', description: 'left leg' },
          { id: 'rightLeg', type: 'leg', description: 'right leg' }
        ]
      });
    });

    it('provides fallback data for description errors', async () => {
      const descriptionStrategy = recoveryStrategyManager.registerStrategy.mock.calls.find(
        ([name]) => name === 'DescriptionGenerationError'
      )[1];
      logger.warn.mockClear();

      const fallbackResult = await descriptionStrategy.fallback({
        context: { entityId: 'entity-456', partIds: ['arm', 'leg'] }
      });

      expect(logger.warn).toHaveBeenCalledWith('Using generic description fallback');
      expect(fallbackResult).toEqual({
        type: 'fallback',
        entityId: 'entity-456',
        description: 'A standard humanoid form.',
        parts: [
          { id: 'arm', description: 'arm part' },
          { id: 'leg', description: 'leg part' }
        ]
      });
    });

    it('provides fallback data for graph building errors', async () => {
      const graphStrategy = recoveryStrategyManager.registerStrategy.mock.calls.find(
        ([name]) => name === 'GraphBuildingError'
      )[1];
      logger.warn.mockClear();

      const fallbackResult = await graphStrategy.fallback({
        context: { rootId: 'root-node' }
      });

      expect(logger.warn).toHaveBeenCalledWith('Using minimal graph structure fallback');
      expect(fallbackResult).toEqual({
        type: 'fallback',
        rootId: 'root-node',
        nodes: [{ id: 'root-node', type: 'root' }],
        edges: []
      });
    });
  });

  describe('error severity and recoverability', () => {
    it('AnatomyGenerationError has correct severity and recoverability', () => {
      const error = new AnatomyGenerationError('test', 'e1', 'r1');
      expect(error.getSeverity()).toBe('error');
      expect(error.isRecoverable()).toBe(true);
      expect(error.code).toBe('ANATOMY_GENERATION_ERROR');
    });

    it('DescriptionGenerationError has correct severity and recoverability', () => {
      const error = new DescriptionGenerationError('test', 'e1', ['p1']);
      expect(error.getSeverity()).toBe('warning');
      expect(error.isRecoverable()).toBe(true);
      expect(error.code).toBe('DESCRIPTION_GENERATION_ERROR');
    });

    it('GraphBuildingError has correct severity and recoverability', () => {
      const error = new GraphBuildingError('test', 'root1');
      expect(error.getSeverity()).toBe('error');
      expect(error.isRecoverable()).toBe(false);
      expect(error.code).toBe('GRAPH_BUILDING_ERROR');
    });
  });

  it('handleSync delegates to handle', () => {
    const error = new Error('sync error');
    const context = { operation: 'generation', entityId: 'sync-1' };
    const handleSpy = jest.spyOn(handler, 'handle');

    handler.handleSync(error, context);

    expect(handleSpy).toHaveBeenCalledWith(error, context);
    handleSpy.mockRestore();
  });

  it('extracts graph error context for logging', () => {
    const graphError = new GraphBuildingError('failed', 'root-ctx');
    handler.handle(graphError, { operation: 'graphBuilding', rootId: 'root-ctx' });

    expect(logger.error).toHaveBeenCalledWith(
      'AnatomyErrorHandler: GraphBuildingError occurred during anatomy operation',
      expect.objectContaining({
        context: { operation: 'graphBuilding', rootId: 'root-ctx' },
        rootId: 'root-ctx'
      })
    );
  });
});
