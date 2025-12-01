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
    expect(entityManager.addComponent).toHaveBeenCalledWith('actor-1', 'hugging:hugging', {
      embraced_entity_id: 'target-1',
    });
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
});
