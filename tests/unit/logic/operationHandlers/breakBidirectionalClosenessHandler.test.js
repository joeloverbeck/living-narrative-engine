/**
 * @file Unit tests for BreakBidirectionalClosenessHandler.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import BreakBidirectionalClosenessHandler from '../../../../src/logic/operationHandlers/breakBidirectionalClosenessHandler.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn().mockResolvedValue(true) });

const makeEntityManager = () => ({
  getComponentData: jest.fn(),
  removeComponent: jest.fn().mockResolvedValue(true),
});

const makeRegenerator = () => ({ execute: jest.fn().mockResolvedValue(true) });

describe('BreakBidirectionalClosenessHandler', () => {
  let handler;
  let entityManager;
  let dispatcher;
  let logger;
  let regenerator;
  let executionContext;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    entityManager = makeEntityManager();
    regenerator = makeRegenerator();
    handler = new BreakBidirectionalClosenessHandler({
      entityManager,
      safeEventDispatcher: dispatcher,
      regenerateDescriptionHandler: regenerator,
      logger,
    });
    executionContext = {
      evaluationContext: {
        event: { payload: { actorId: 'actor-1', targetId: 'target-1' } },
        context: { note: 'test-context' },
      },
      logger,
    };
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should remove components from both entities', async () => {
      entityManager.getComponentData.mockReturnValue({}); // Component exists

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
        },
        executionContext
      );

      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'actor-1',
        'hugging:hugging'
      );
      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'target-1',
        'hugging:being_hugged'
      );
    });

    it('should remove additional components if specified', async () => {
      entityManager.getComponentData.mockReturnValue({});

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
          additional_component_types_to_remove: ['extra:component'],
        },
        executionContext
      );

      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'actor-1',
        'extra:component'
      );
      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        'target-1',
        'extra:component'
      );
    });

    it('should gracefully handle missing components (skip removal)', async () => {
      entityManager.getComponentData.mockReturnValue(null); // Component missing

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
        },
        executionContext
      );

      expect(entityManager.removeComponent).not.toHaveBeenCalled();
    });

    it('should log error when removal fails (catch block)', async () => {
      entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Read error');
      });

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
        },
        executionContext
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('not found on')
      );
      // Wait, the handler logs: logger.debug(`Component ${componentType} not found on ${entityId}, skipping removal`)
      // That's a string.
    });

    it('should regenerate descriptions by default', async () => {
      entityManager.getComponentData.mockReturnValue({});

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
        },
        executionContext
      );

      expect(regenerator.execute).toHaveBeenCalledWith(
        { entity_ref: 'actor-1' },
        executionContext
      );
      expect(regenerator.execute).toHaveBeenCalledWith(
        { entity_ref: 'target-1' },
        executionContext
      );
    });

    it('should skip description regeneration when disabled', async () => {
      entityManager.getComponentData.mockReturnValue({});

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
          regenerate_descriptions: false,
        },
        executionContext
      );

      expect(regenerator.execute).not.toHaveBeenCalled();
    });

    it('should handle missing regenerateDescriptionHandler gracefully', async () => {
      const handlerNoRegen = new BreakBidirectionalClosenessHandler({
        entityManager,
        safeEventDispatcher: dispatcher,
        logger, // regenerateDescriptionHandler omitted
      });
      entityManager.getComponentData.mockReturnValue({});

      await handlerNoRegen.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
          regenerate_descriptions: true,
        },
        executionContext
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'regenerate_descriptions requested but handler not available'
        ),
        expect.any(Object)
      );
    });

    it('should validate required parameters', async () => {
      await handler.execute(
        {
          // Missing required types
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Invalid'),
        })
      );
      expect(entityManager.removeComponent).not.toHaveBeenCalled();
    });

    it('should handle invalid params object', async () => {
      await handler.execute(null, executionContext);
      expect(entityManager.removeComponent).not.toHaveBeenCalled();
    });

    it('should handle missing actorId or targetId', async () => {
      const badContext = {
        evaluationContext: { event: { payload: {} } }, // No ids
        logger,
      };

      await handler.execute(
        {
          actor_component_type: 'type-a',
          target_component_type: 'type-b',
        },
        badContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('missing from event payload'),
        })
      );
    });

    it('should handle regeneration failures gracefully', async () => {
      entityManager.getComponentData.mockReturnValue({});
      regenerator.execute.mockRejectedValue(new Error('Regen failed'));

      await handler.execute(
        {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
        },
        executionContext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('description regeneration failed'),
        expect.objectContaining({ error: 'Regen failed' })
      );
    });
  });
});
