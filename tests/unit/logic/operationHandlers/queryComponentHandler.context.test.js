// src/tests/logic/operationHandlers/queryComponentHandler.context.test.js

import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

const getLoggerMock = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('QueryComponentHandler (Context Alignment Test Suite)', () => {
  let entityManagerMock;
  let loggerMock;
  let dispatcherMock;
  let handler;

  beforeEach(() => {
    entityManagerMock = {
      getComponentData: jest.fn(),
    };
    loggerMock = getLoggerMock();
    dispatcherMock = { dispatch: jest.fn() };
    handler = new QueryComponentHandler({
      entityManager: entityManagerMock,
      logger: loggerMock,
      safeEventDispatcher: dispatcherMock,
    });
  });

  // --- REVISED: Helper to create the nested ExecutionContext structure ---
  const createNestedExecutionContext = (
    actorId = null,
    targetId = null,
    initialRuleVars = {}
  ) => ({
    event: { type: 'testEvent', payload: {} },
    // Top-level actor/target might still exist for other purposes or by convention from SystemLogicInterpreter
    // but for entity_ref: 'actor'/'target' in QueryComponentHandler, we now test against evaluationContext's actor/target
    actor: actorId ? { id: `top-${actorId}`, components: {} } : null,
    target: targetId ? { id: `top-${targetId}`, components: {} } : null,
    logger: loggerMock,
    evaluationContext: {
      // The nested structure
      actor: actorId ? { id: actorId, components: {} } : null,
      target: targetId ? { id: targetId, components: {} } : null,
      context: initialRuleVars, // This is where rule variables are stored
    },
  });

  test('should query component for "actor" and store it in evaluationContext.context', () => {
    const mockActorId = 'hero1';
    const executionContext = createNestedExecutionContext(
      mockActorId,
      null,
      {}
    );
    const componentData = { text: 'Hero' };
    entityManagerMock.getComponentData.mockReturnValue(componentData);

    const params = {
      entity_ref: 'actor',
      component_type: 'core:name',
      result_variable: 'actorName',
    };

    handler.execute(params, executionContext);

    // resolveEntityId utility uses executionContext.evaluationContext.actor.id
    expect(entityManagerMock.getComponentData).toHaveBeenCalledWith(
      mockActorId,
      'core:name'
    );
    // Verify data is stored in executionContext.evaluationContext.context.actorName
    expect(executionContext.evaluationContext.context.actorName).toBe(
      componentData
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Successfully queried component "core:name" from entity "hero1". Result stored in "actorName": {"text":"Hero"}'
      )
    );
  });

  test('should query component for direct entity ID and store it in evaluationContext.context', () => {
    const directEntityId = 'npc123';
    const executionContext = createNestedExecutionContext(null, null, {}); // actor/target in evalContext are null
    const componentData = { value: 42 };
    entityManagerMock.getComponentData.mockReturnValue(componentData);

    const params = {
      entity_ref: directEntityId, // Direct ID doesn't rely on context's actor/target
      component_type: 'core:stats',
      result_variable: 'npcStats',
    };

    handler.execute(params, executionContext);

    expect(entityManagerMock.getComponentData).toHaveBeenCalledWith(
      directEntityId,
      'core:stats'
    );
    expect(executionContext.evaluationContext.context.npcStats).toBe(
      componentData
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('should store undefined in evaluationContext.context if component is not found', () => {
    const mockActorId = 'hero2';
    const executionContext = createNestedExecutionContext(
      mockActorId,
      null,
      {}
    );
    entityManagerMock.getComponentData.mockReturnValue(undefined);

    const params = {
      entity_ref: 'actor',
      component_type: 'core:nonexistent',
      result_variable: 'missingComp',
    };

    handler.execute(params, executionContext);

    expect(entityManagerMock.getComponentData).toHaveBeenCalledWith(
      mockActorId,
      'core:nonexistent'
    );
    expect(
      executionContext.evaluationContext.context.missingComp
    ).toBeUndefined();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Component "core:nonexistent" not found on entity "hero2". Stored \'undefined\' in "missingComp"'
      )
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('should log error and return if executionContext.evaluationContext.context is null', () => {
    const executionContext = createNestedExecutionContext('hero1');
    // Setup the specific failure condition
    executionContext.evaluationContext.context = null;

    const params = {
      entity_ref: 'actor',
      component_type: 'core:name',
      result_variable: 'actorName',
    };

    handler.execute(params, executionContext);

    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'executionContext.evaluationContext.context is missing'
        ),
      })
    );
    expect(entityManagerMock.getComponentData).not.toHaveBeenCalled();
  });

  test('should log error and return if executionContext.evaluationContext.context is not an object', () => {
    const executionContext = createNestedExecutionContext('hero1');
    // Setup the specific failure condition
    executionContext.evaluationContext.context = 'not_an_object';

    const params = {
      entity_ref: 'actor',
      component_type: 'core:name',
      result_variable: 'actorName',
    };

    handler.execute(params, executionContext);

    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'executionContext.evaluationContext.context is missing'
        ),
      })
    );
    expect(entityManagerMock.getComponentData).not.toHaveBeenCalled();
  });

  test('should log error if entity_ref parameter is missing', () => {
    // This test should pass if the primary context check passes.
    // The error for missing entity_ref comes after the main context check.
    const executionContext = createNestedExecutionContext('hero1', null, {});
    const params = {
      component_type: 'core:name',
      result_variable: 'actorName',
      // entity_ref is missing
    };
    handler.execute(params, executionContext);
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Could not resolve entity id'),
      })
    );
    expect(entityManagerMock.getComponentData).not.toHaveBeenCalled();
  });

  test('should log error if component_type parameter is missing or invalid', () => {
    const executionContext = createNestedExecutionContext('hero1', null, {});
    const params = {
      entity_ref: 'actor',
      component_type: '  ', // Invalid
      result_variable: 'actorName',
    };
    handler.execute(params, executionContext);
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Could not resolve entity id from entity_ref or component_type.'
        ),
      })
    );
    expect(entityManagerMock.getComponentData).not.toHaveBeenCalled();
  });

  test('should log error if result_variable parameter is missing or invalid', () => {
    const executionContext = createNestedExecutionContext('hero1', null, {});
    const params = {
      entity_ref: 'actor',
      component_type: 'core:name',
      result_variable: '', // Invalid
    };
    handler.execute(params, executionContext);
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('"result_variable"'),
      })
    );
    expect(entityManagerMock.getComponentData).not.toHaveBeenCalled();
  });

  test('should handle error during entityManager.getComponentData gracefully', () => {
    const mockActorId = 'heroWithError';
    const executionContext = createNestedExecutionContext(
      mockActorId,
      null,
      {}
    );
    const emError = new Error('EntityManager failed');
    entityManagerMock.getComponentData.mockImplementation(() => {
      throw emError;
    });

    const params = {
      entity_ref: 'actor', // This will resolve to mockActorId from evaluationContext.actor
      component_type: 'core:name',
      result_variable: 'faultyComp',
    };

    handler.execute(params, executionContext);

    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Error during EntityManager.getComponentData'
        ),
      })
    );
    expect(
      executionContext.evaluationContext.context.faultyComp
    ).toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      `QueryComponentHandler: Stored 'undefined' in "faultyComp" due to EntityManager error.`
    );
  });

  // New test: Verifying actor resolution failure from evaluationContext.actor
  test('should log error if "actor" in evaluationContext cannot be resolved', () => {
    const executionContext = createNestedExecutionContext(null, null, {}); // No actorId passed, so evaluationContext.actor is null

    const params = {
      entity_ref: 'actor',
      component_type: 'core:name',
      result_variable: 'actorName',
    };
    handler.execute(params, executionContext);
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Could not resolve entity id'),
      })
    );
    expect(entityManagerMock.getComponentData).not.toHaveBeenCalled();
  });
});
