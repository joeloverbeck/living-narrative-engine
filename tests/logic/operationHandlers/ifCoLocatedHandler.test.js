import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';

describe('IfCoLocatedHandler', () => {
  let entityManager;
  let opInterpreter;
  let logger;
  let handler;
  let execCtx;

  beforeEach(() => {
    entityManager = {
      getComponentData: jest.fn(),
    };
    opInterpreter = { execute: jest.fn() };
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    handler = new IfCoLocatedHandler({
      entityManager,
      operationInterpreter: opInterpreter,
      logger,
    });
    execCtx = {
      evaluationContext: {
        actor: { id: 'a1' },
        target: { id: 'b1' },
        context: {},
      },
      logger,
    };
  });

  test('executes then_actions when entities share location', () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      return id === 'a1' ? { locationId: 'loc' } : { locationId: 'loc' };
    });
    const params = {
      entity_ref_a: 'actor',
      entity_ref_b: 'target',
      then_actions: [{ type: 'LOG' }],
      else_actions: [{ type: 'SET_VARIABLE' }],
    };

    handler.execute(params, execCtx);

    expect(opInterpreter.execute).toHaveBeenCalledTimes(1);
    expect(opInterpreter.execute).toHaveBeenCalledWith(
      params.then_actions[0],
      execCtx
    );
  });

  test('executes else_actions when locations differ', () => {
    entityManager.getComponentData.mockImplementation((id) => {
      return id === 'a1' ? { locationId: 'locA' } : { locationId: 'locB' };
    });
    const params = {
      entity_ref_a: 'actor',
      entity_ref_b: 'target',
      then_actions: [{ type: 'LOG' }],
      else_actions: [{ type: 'SET_VARIABLE' }],
    };

    handler.execute(params, execCtx);

    expect(opInterpreter.execute).toHaveBeenCalledTimes(1);
    expect(opInterpreter.execute).toHaveBeenCalledWith(
      params.else_actions[0],
      execCtx
    );
  });
});
