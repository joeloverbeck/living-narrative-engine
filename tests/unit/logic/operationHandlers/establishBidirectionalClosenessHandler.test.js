/**
 * @file Unit tests for EstablishBidirectionalClosenessHandler.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import EstablishBidirectionalClosenessHandler from '../../../../src/logic/operationHandlers/establishBidirectionalClosenessHandler.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn().mockResolvedValue(true) });

const makeEntityManager = () => ({
  getComponentData: jest.fn(),
  addComponent: jest.fn().mockResolvedValue(true),
  removeComponent: jest.fn().mockResolvedValue(true),
});

const makeRegenerator = () => ({ execute: jest.fn().mockResolvedValue(true) });

describe('EstablishBidirectionalClosenessHandler', () => {
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
    handler = new EstablishBidirectionalClosenessHandler({
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

  it('cleans partner relationships and establishes new components with resolved templates', async () => {
    const components = {
      'actor-1': {
        'hugging:hugging': { embraced_entity_id: 'other-1' },
      },
      'other-1': {
        'hugging:being_hugged': { hugging_entity_id: 'actor-1' },
        'hugging:hugging': { partner_id: 'actor-1' },
      },
      'target-1': {
        'hugging:being_hugged': { hugging_entity_id: 'actor-2' },
      },
    };

    entityManager.getComponentData.mockImplementation(
      (entityId, componentType) => components[entityId]?.[componentType] ?? null
    );

    await handler.execute(
      {
        actor_component_type: 'hugging:hugging',
        target_component_type: 'hugging:being_hugged',
        actor_data: { embraced_entity_id: '{event.payload.targetId}' },
        target_data: { hugging_entity_id: '{event.payload.actorId}' },
      },
      executionContext
    );

    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'other-1',
      'hugging:hugging'
    );
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'other-1',
      'hugging:being_hugged'
    );
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'actor-1',
      'hugging:hugging'
    );
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'target-1',
      'hugging:being_hugged'
    );
    expect(entityManager.addComponent).toHaveBeenCalledWith(
      'actor-1',
      'hugging:hugging',
      {
        embraced_entity_id: 'target-1',
      }
    );
    expect(entityManager.addComponent).toHaveBeenCalledWith(
      'target-1',
      'hugging:being_hugged',
      {
        hugging_entity_id: 'actor-1',
      }
    );
  });

  it('skips partner cleanup when clean_existing is false but still resets actor and target components', async () => {
    entityManager.getComponentData.mockImplementation(() => ({
      embraced_entity_id: 'partner-1',
    }));

    await handler.execute(
      {
        actor_component_type: 'hugging:hugging',
        target_component_type: 'hugging:being_hugged',
        actor_data: {},
        target_data: {},
        clean_existing: false,
      },
      executionContext
    );

    const partnerCalls = entityManager.removeComponent.mock.calls.filter(
      ([entityId]) => entityId === 'partner-1'
    );
    expect(partnerCalls).toHaveLength(0);
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'actor-1',
      'hugging:hugging'
    );
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'target-1',
      'hugging:being_hugged'
    );
  });

  it('regenerates descriptions when requested and dependency is provided', async () => {
    await handler.execute(
      {
        actor_component_type: 'hugging:hugging',
        target_component_type: 'hugging:being_hugged',
        actor_data: {},
        target_data: {},
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

  it('skips regeneration when regenerate_descriptions is false', async () => {
    await handler.execute(
      {
        actor_component_type: 'hugging:hugging',
        target_component_type: 'hugging:being_hugged',
        actor_data: {},
        target_data: {},
        regenerate_descriptions: false,
      },
      executionContext
    );

    expect(regenerator.execute).not.toHaveBeenCalled();
  });

  it('dispatches validation errors when component types are missing', async () => {
    await handler.execute(
      {
        target_component_type: 'hugging:being_hugged',
        actor_data: {},
        target_data: {},
      },
      executionContext
    );

    expect(dispatcher.dispatch).toHaveBeenCalled();
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  it('catches recursion errors in template resolution (line 243)', async () => {
    const circular = {};
    circular.self = circular;

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: circular, // This should trigger stack overflow in recurse
        target_data: {},
      },
      executionContext
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to resolve template variables'),
      expect.any(Object)
    );
  });

  it('handles read component failure during clean existing (lines 249-252)', async () => {
    entityManager.getComponentData.mockImplementation(() => {
      throw new Error('Read failed');
    });

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
        clean_existing: true,
        existing_component_types_to_clean: ['type-a'],
      },
      executionContext
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Unable to read component'),
      expect.objectContaining({ error: 'Read failed' })
    );
  });

  it('skips partner cleanup if partnerId is same as entityId (lines 262-266)', async () => {
    // Mock existing component that points to self
    entityManager.getComponentData.mockImplementation((entityId) => {
      if (entityId === 'actor-1') {
        return { embraced_entity_id: 'actor-1' }; // Self-reference
      }
      return null;
    });

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
        clean_existing: true,
        existing_component_types_to_clean: ['type-a'],
      },
      executionContext
    );

    expect(entityManager.removeComponent).toHaveBeenCalledTimes(1);
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'actor-1',
      'type-a'
    );
  });

  it('handles invalid params object (line 74)', async () => {
    await handler.execute(null, executionContext);
  });

  it('handles missing actorId or targetId (lines 86-92)', async () => {
    const badContext = {
      evaluationContext: { event: { payload: {} } }, // No ids
      logger,
    };

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
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

  it('handles main execution error (lines 135-144)', async () => {
    entityManager.addComponent.mockRejectedValue(new Error('Add failed'));

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
      },
      executionContext
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: expect.stringContaining('handler failed'),
      })
    );
  });

  it('validates actor_data is object (lines 176-182)', async () => {
    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: 'invalid-string',
        target_data: {},
      },
      executionContext
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: expect.stringContaining('"actor_data" must be an object'),
      })
    );
  });

  it('validates target_data is object (lines 186-192)', async () => {
    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: 'invalid-string',
      },
      executionContext
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: expect.stringContaining('"target_data" must be an object'),
      })
    );
  });

  it('handles remove component failure (line 299)', async () => {
    entityManager.getComponentData.mockReturnValue({});
    entityManager.removeComponent.mockRejectedValue(new Error('Remove failed'));

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
      },
      executionContext
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('skipping removal'),
      expect.objectContaining({ error: 'Remove failed' })
    );
  });

  it('handles missing regenerateDescriptionHandler (lines 317-321)', async () => {
    const handlerNoRegen = new EstablishBidirectionalClosenessHandler({
      entityManager,
      safeEventDispatcher: dispatcher,
      logger, // regenerateDescriptionHandler omitted
    });

    await handlerNoRegen.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
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

  it('handles regenerate execution failure (line 330)', async () => {
    regenerator.execute.mockRejectedValue(new Error('Regen failed'));

    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: {},
        target_data: {},
        regenerate_descriptions: true,
      },
      executionContext
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('description regeneration failed'),
      expect.objectContaining({ error: 'Regen failed' })
    );
  });

  it('leaves template string unresolved if path is not found (line 218 coverage)', async () => {
    await handler.execute(
      {
        actor_component_type: 'type-a',
        target_component_type: 'type-b',
        actor_data: { field: '{non.existent.path}' },
        target_data: {},
      },
      executionContext
    );

    expect(entityManager.addComponent).toHaveBeenCalledWith(
      'actor-1',
      'type-a',
      { field: '{non.existent.path}' }
    );
  });
});
