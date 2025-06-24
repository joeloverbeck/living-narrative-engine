import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../../src/dependencyInjection/registrarHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerOperationHandlers } from '../../../../src/dependencyInjection/registrations/operationHandlerRegistrations.js';

/**
 * @file Tests for registerOperationHandlers ensuring each handler token is registered once.
 */

describe('registerOperationHandlers', () => {
  /** @type {AppContainer} */
  let container;
  /** @type {Registrar} */
  let registrar;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registrar = new Registrar(container);
    registerSpy = jest.spyOn(container, 'register');
  });

  it('registers each handler token exactly once', () => {
    registerOperationHandlers(registrar);

    const handlerTokens = [
      tokens.DispatchEventHandler,
      tokens.DispatchPerceptibleEventHandler,
      tokens.DispatchSpeechHandler,
      tokens.LogHandler,
      tokens.ModifyComponentHandler,
      tokens.AddComponentHandler,
      tokens.RemoveComponentHandler,
      tokens.QueryComponentHandler,
      tokens.QueryComponentsHandler,
      tokens.SetVariableHandler,
      tokens.EndTurnHandler,
      tokens.SystemMoveEntityHandler,
      tokens.GetTimestampHandler,
      tokens.GetNameHandler,
      tokens.RebuildLeaderListCacheHandler,
      tokens.CheckFollowCycleHandler,
      tokens.EstablishFollowRelationHandler,
      tokens.BreakFollowRelationHandler,
      tokens.AddPerceptionLogEntryHandler,
      tokens.QueryEntitiesHandler,
      tokens.HasComponentHandler,
      tokens.ModifyArrayFieldHandler,
      tokens.ModifyContextArrayHandler,
      tokens.IfCoLocatedHandler,
      tokens.MathHandler,
      tokens.AutoMoveFollowersHandler,
      tokens.MergeClosenessCircleHandler,
      tokens.RemoveFromClosenessCircleHandler,
    ];

    handlerTokens.forEach((token) => {
      const calls = registerSpy.mock.calls.filter((c) => c[0] === token);
      expect(calls).toHaveLength(1);
    });

    expect(registerSpy).toHaveBeenCalledTimes(handlerTokens.length);
  });
});
