/**
 * @file Provides registration for operation handler singletons.
 */

/** @typedef {import('../../utils/registrarHelpers.js').Registrar} Registrar */

import { tokens } from '../tokens.js';
import DispatchEventHandler from '../../logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import DispatchSpeechHandler from '../../logic/operationHandlers/dispatchSpeechHandler.js';
import DispatchThoughtHandler from '../../logic/operationHandlers/dispatchThoughtHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../logic/operationHandlers/queryComponentHandler.js';
import QueryComponentsHandler from '../../logic/operationHandlers/queryComponentsHandler.js';
import RemoveComponentHandler from '../../logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import EndTurnHandler from '../../logic/operationHandlers/endTurnHandler.js';
import SystemMoveEntityHandler from '../../logic/operationHandlers/systemMoveEntityHandler.js';
import GetTimestampHandler from '../../logic/operationHandlers/getTimestampHandler.js';
import GetNameHandler from '../../logic/operationHandlers/getNameHandler.js';
import RebuildLeaderListCacheHandler from '../../logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import CheckFollowCycleHandler from '../../logic/operationHandlers/checkFollowCycleHandler.js';
import EstablishFollowRelationHandler from '../../logic/operationHandlers/establishFollowRelationHandler.js';
import BreakFollowRelationHandler from '../../logic/operationHandlers/breakFollowRelationHandler.js';
import AddPerceptionLogEntryHandler from '../../logic/operationHandlers/addPerceptionLogEntryHandler.js';
import QueryEntitiesHandler from '../../logic/operationHandlers/queryEntitiesHandler.js';
import HasComponentHandler from '../../logic/operationHandlers/hasComponentHandler.js';
import ModifyArrayFieldHandler from '../../logic/operationHandlers/modifyArrayFieldHandler.js';
import MathHandler from '../../logic/operationHandlers/mathHandler.js';
import IfCoLocatedHandler from '../../logic/operationHandlers/ifCoLocatedHandler.js';
import ModifyContextArrayHandler from '../../logic/operationHandlers/modifyContextArrayHandler.js';
import AutoMoveFollowersHandler from '../../logic/operationHandlers/autoMoveFollowersHandler.js';
import MergeClosenessCircleHandler from '../../logic/operationHandlers/mergeClosenessCircleHandler.js';
import RemoveFromClosenessCircleHandler from '../../logic/operationHandlers/removeFromClosenessCircleHandler.js';
import EstablishSittingClosenessHandler from '../../logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../logic/operationHandlers/removeSittingClosenessHandler.js';
import HasBodyPartWithComponentValueHandler from '../../logic/operationHandlers/hasBodyPartWithComponentValueHandler.js';
import UnequipClothingHandler from '../../logic/operationHandlers/unequipClothingHandler.js';
import LockMovementHandler from '../../logic/operationHandlers/lockMovementHandler.js';
import LockMouthEngagementHandler from '../../logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMovementHandler from '../../logic/operationHandlers/unlockMovementHandler.js';
import UnlockMouthEngagementHandler from '../../logic/operationHandlers/unlockMouthEngagementHandler.js';
import RegenerateDescriptionHandler from '../../logic/operationHandlers/regenerateDescriptionHandler.js';
import AtomicModifyComponentHandler from '../../logic/operationHandlers/atomicModifyComponentHandler.js';
import SequenceHandler from '../../logic/operationHandlers/sequenceHandler.js';
import jsonLogic from 'json-logic-js';

/**
 * Registers all operation handlers as singleton factories.
 *
 * @param {Registrar} registrar - The registrar used for registration.
 * @returns {void}
 */
export function registerOperationHandlers(registrar) {
  const handlerFactories = [
    [
      tokens.DispatchEventHandler,
      DispatchEventHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        }),
    ],
    [
      tokens.DispatchPerceptibleEventHandler,
      DispatchPerceptibleEventHandler,
      (c, Handler) =>
        new Handler({
          dispatcher: c.resolve(tokens.ISafeEventDispatcher),
          logger: c.resolve(tokens.ILogger),
          addPerceptionLogEntryHandler: c.resolve(
            tokens.AddPerceptionLogEntryHandler
          ),
        }),
    ],
    [
      tokens.DispatchSpeechHandler,
      DispatchSpeechHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        }),
    ],
    [
      tokens.DispatchThoughtHandler,
      DispatchThoughtHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        }),
    ],
    [
      tokens.LogHandler,
      LogHandler,
      (c, Handler) => new Handler({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.ModifyComponentHandler,
      ModifyComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.AddComponentHandler,
      AddComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.RemoveComponentHandler,
      RemoveComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.QueryComponentHandler,
      QueryComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.QueryComponentsHandler,
      QueryComponentsHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.SetVariableHandler,
      SetVariableHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          jsonLogic,
        }),
    ],
    [
      tokens.EndTurnHandler,
      EndTurnHandler,
      (c, Handler) =>
        new Handler({
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.SystemMoveEntityHandler,
      SystemMoveEntityHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.IMoveEntityHandler,
      SystemMoveEntityHandler,
      (c) => c.resolve(tokens.SystemMoveEntityHandler),
    ],
    [
      tokens.GetTimestampHandler,
      GetTimestampHandler,
      (c, Handler) => new Handler({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.GetNameHandler,
      GetNameHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.RebuildLeaderListCacheHandler,
      RebuildLeaderListCacheHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.CheckFollowCycleHandler,
      CheckFollowCycleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.EstablishFollowRelationHandler,
      EstablishFollowRelationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          rebuildLeaderListCacheHandler: c.resolve(
            tokens.RebuildLeaderListCacheHandler
          ),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.BreakFollowRelationHandler,
      BreakFollowRelationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          rebuildLeaderListCacheHandler: c.resolve(
            tokens.RebuildLeaderListCacheHandler
          ),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.AddPerceptionLogEntryHandler,
      AddPerceptionLogEntryHandler,
      (c, H) =>
        new H({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.QueryEntitiesHandler,
      QueryEntitiesHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          jsonLogicEvaluationService: c.resolve(
            tokens.JsonLogicEvaluationService
          ),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.HasComponentHandler,
      HasComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.ModifyArrayFieldHandler,
      ModifyArrayFieldHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.ModifyContextArrayHandler,
      ModifyContextArrayHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.IfCoLocatedHandler,
      IfCoLocatedHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          operationInterpreter: c.resolve(tokens.OperationInterpreter),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.MathHandler,
      MathHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.AutoMoveFollowersHandler,
      AutoMoveFollowersHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          moveEntityHandler: c.resolve(tokens.IMoveEntityHandler),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.MergeClosenessCircleHandler,
      MergeClosenessCircleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
        }),
    ],
    [
      tokens.RemoveFromClosenessCircleHandler,
      RemoveFromClosenessCircleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
        }),
    ],
    [
      tokens.EstablishSittingClosenessHandler,
      EstablishSittingClosenessHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
        }),
    ],
    [
      tokens.RemoveSittingClosenessHandler,
      RemoveSittingClosenessHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
        }),
    ],
    [
      tokens.HasBodyPartWithComponentValueHandler,
      HasBodyPartWithComponentValueHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          bodyGraphService: c.resolve(tokens.BodyGraphService),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.UnequipClothingHandler,
      UnequipClothingHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
        }),
    ],
    [
      tokens.LockMovementHandler,
      LockMovementHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.LockMouthEngagementHandler,
      LockMouthEngagementHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.UnlockMovementHandler,
      UnlockMovementHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.UnlockMouthEngagementHandler,
      UnlockMouthEngagementHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.RegenerateDescriptionHandler,
      RegenerateDescriptionHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          bodyDescriptionComposer: c.resolve(tokens.BodyDescriptionComposer),
        }),
    ],
    [
      tokens.AtomicModifyComponentHandler,
      AtomicModifyComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.SequenceHandler,
      SequenceHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          actionSequence: c.resolve(tokens.ActionSequence),
        }),
    ],
  ];

  for (const [token, ctor, factory] of handlerFactories) {
    registrar.singletonFactory(token, (c) => factory(c, ctor));
  }
}
