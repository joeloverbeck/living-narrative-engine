/**
 * @file Provides registration for operation handler singletons.
 *
 * Operation Handler Factory Registrations
 *
 * Registers operation handler classes with the DI container using factory pattern
 *
 * When adding a new operation handler:
 * 1. Import the handler class at the top of this file
 * 2. Add factory entry to handlerFactories array: [token, HandlerClass, factory function]
 * 3. Ensure token is defined in tokens-core.js (without "I" prefix)
 * 4. Keep imports and factory entries alphabetically sorted
 *
 * Requirements:
 * - Handler class must extend BaseOperationHandler
 * - Token must be defined in tokens-core.js (e.g., DrinkFromHandler, not IDrinkFromHandler)
 * - Handler file must exist in src/logic/operationHandlers/
 *
 * Verification:
 * Run `npm run typecheck` to verify imports and registrations
 * @see src/dependencyInjection/tokens/tokens-core.js
 * @see src/logic/operationHandlers/ (handler implementations)
 */

/** @typedef {import('../../utils/registrarHelpers.js').Registrar} Registrar */

import { tokens } from '../tokens.js';

// Import handlers (keep alphabetically sorted)
import DispatchEventHandler from '../../logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import DispatchSpeechHandler from '../../logic/operationHandlers/dispatchSpeechHandler.js';
import DispatchThoughtHandler from '../../logic/operationHandlers/dispatchThoughtHandler.js';
import DigestFoodHandler from '../../logic/operationHandlers/digestFoodHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../logic/operationHandlers/queryComponentHandler.js';
import QueryComponentsHandler from '../../logic/operationHandlers/queryComponentsHandler.js';
import QueryLookupHandler from '../../logic/operationHandlers/queryLookupHandler.js';
import RemoveComponentHandler from '../../logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import EndTurnHandler from '../../logic/operationHandlers/endTurnHandler.js';
import ForEachHandler from '../../logic/operationHandlers/forEachHandler.js';
import SystemMoveEntityHandler from '../../logic/operationHandlers/systemMoveEntityHandler.js';
import IfHandler from '../../logic/operationHandlers/ifHandler.js';
import GetTimestampHandler from '../../logic/operationHandlers/getTimestampHandler.js';
import GetNameHandler from '../../logic/operationHandlers/getNameHandler.js';
import RebuildLeaderListCacheHandler from '../../logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import CheckFollowCycleHandler from '../../logic/operationHandlers/checkFollowCycleHandler.js';
import EstablishFollowRelationHandler from '../../logic/operationHandlers/establishFollowRelationHandler.js';
import BreakFollowRelationHandler from '../../logic/operationHandlers/breakFollowRelationHandler.js';
import BurnEnergyHandler from '../../logic/operationHandlers/burnEnergyHandler.js';
import AddPerceptionLogEntryHandler from '../../logic/operationHandlers/addPerceptionLogEntryHandler.js';
import QueryEntitiesHandler from '../../logic/operationHandlers/queryEntitiesHandler.js';
import HasComponentHandler from '../../logic/operationHandlers/hasComponentHandler.js';
import ModifyArrayFieldHandler from '../../logic/operationHandlers/modifyArrayFieldHandler.js';
import MathHandler from '../../logic/operationHandlers/mathHandler.js';
import IfCoLocatedHandler from '../../logic/operationHandlers/ifCoLocatedHandler.js';
import ModifyContextArrayHandler from '../../logic/operationHandlers/modifyContextArrayHandler.js';
import AutoMoveFollowersHandler from '../../logic/operationHandlers/autoMoveFollowersHandler.js';
import AutoMoveClosenessPartnersHandler from '../../logic/operationHandlers/autoMoveClosenessPartnersHandler.js';
import MergeClosenessCircleHandler from '../../logic/operationHandlers/mergeClosenessCircleHandler.js';
import RemoveFromClosenessCircleHandler from '../../logic/operationHandlers/removeFromClosenessCircleHandler.js';
import EstablishSittingClosenessHandler from '../../logic/operationHandlers/establishSittingClosenessHandler.js';
import EstablishLyingClosenessHandler from '../../logic/operationHandlers/establishLyingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../logic/operationHandlers/removeSittingClosenessHandler.js';
import RemoveLyingClosenessHandler from '../../logic/operationHandlers/removeLyingClosenessHandler.js';
import BreakClosenessWithTargetHandler from '../../logic/operationHandlers/breakClosenessWithTargetHandler.js';
import HasBodyPartWithComponentValueHandler from '../../logic/operationHandlers/hasBodyPartWithComponentValueHandler.js';
import UnequipClothingHandler from '../../logic/operationHandlers/unequipClothingHandler.js';
import LockMovementHandler from '../../logic/operationHandlers/lockMovementHandler.js';
import LockMouthEngagementHandler from '../../logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMovementHandler from '../../logic/operationHandlers/unlockMovementHandler.js';
import UnlockMouthEngagementHandler from '../../logic/operationHandlers/unlockMouthEngagementHandler.js';
import RegenerateDescriptionHandler from '../../logic/operationHandlers/regenerateDescriptionHandler.js';
import ResolveDirectionHandler from '../../logic/operationHandlers/resolveDirectionHandler.js';
import AtomicModifyComponentHandler from '../../logic/operationHandlers/atomicModifyComponentHandler.js';
import SequenceHandler from '../../logic/operationHandlers/sequenceHandler.js';
import TransferItemHandler from '../../logic/operationHandlers/transferItemHandler.js';
import ValidateInventoryCapacityHandler from '../../logic/operationHandlers/validateInventoryCapacityHandler.js';
import DropItemAtLocationHandler from '../../logic/operationHandlers/dropItemAtLocationHandler.js';
import PickUpItemFromLocationHandler from '../../logic/operationHandlers/pickUpItemFromLocationHandler.js';
import OpenContainerHandler from '../../logic/operationHandlers/openContainerHandler.js';
import TakeFromContainerHandler from '../../logic/operationHandlers/takeFromContainerHandler.js';
import PutInContainerHandler from '../../logic/operationHandlers/putInContainerHandler.js';
import ValidateContainerCapacityHandler from '../../logic/operationHandlers/validateContainerCapacityHandler.js';
import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';
import DrinkEntirelyHandler from '../../logic/operationHandlers/drinkEntirelyHandler.js';
import jsonLogic from 'json-logic-js';

/**
 * Registers all operation handlers as singleton factories.
 *
 * Each entry in handlerFactories is [token, HandlerClass, factoryFunction]
 * Format: [tokens.HandlerName, HandlerClass, (c, Handler) => new Handler({ deps })]
 *
 * @param {Registrar} registrar - The registrar used for registration.
 * @returns {void}
 */
export function registerOperationHandlers(registrar) {
  // Handler factory entries (keep alphabetically sorted by token name)
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
      tokens.DigestFoodHandler,
      DigestFoodHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
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
          gameDataRepository: c.resolve(tokens.IGameDataRepository),
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
      tokens.QueryLookupHandler,
      QueryLookupHandler,
      (c, Handler) =>
        new Handler({
          dataRegistry: c.resolve(tokens.IDataRegistry),
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
      tokens.ForEachHandler,
      ForEachHandler,
      (c, Handler) =>
        new Handler({
          operationInterpreter: () => c.resolve(tokens.OperationInterpreter),
          jsonLogic: c.resolve(tokens.JsonLogicEvaluationService),
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
      tokens.IfHandler,
      IfHandler,
      (c, Handler) =>
        new Handler({
          operationInterpreter: () => c.resolve(tokens.OperationInterpreter),
          jsonLogic: c.resolve(tokens.JsonLogicEvaluationService),
          logger: c.resolve(tokens.ILogger),
        }),
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
      tokens.BurnEnergyHandler,
      BurnEnergyHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
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
          operationInterpreter: () => c.resolve(tokens.OperationInterpreter),
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
      tokens.AutoMoveClosenessPartnersHandler,
      AutoMoveClosenessPartnersHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          systemMoveEntityHandler: c.resolve(tokens.SystemMoveEntityHandler),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          operationInterpreter: () => c.resolve(tokens.OperationInterpreter),
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
      tokens.EstablishLyingClosenessHandler,
      EstablishLyingClosenessHandler,
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
      tokens.RemoveLyingClosenessHandler,
      RemoveLyingClosenessHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
        }),
    ],
    [
      tokens.BreakClosenessWithTargetHandler,
      BreakClosenessWithTargetHandler,
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
      tokens.ResolveDirectionHandler,
      ResolveDirectionHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
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
    [
      tokens.TransferItemHandler,
      TransferItemHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.ValidateInventoryCapacityHandler,
      ValidateInventoryCapacityHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.DropItemAtLocationHandler,
      DropItemAtLocationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.PickUpItemFromLocationHandler,
      PickUpItemFromLocationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.OpenContainerHandler,
      OpenContainerHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.TakeFromContainerHandler,
      TakeFromContainerHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.PutInContainerHandler,
      PutInContainerHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.ValidateContainerCapacityHandler,
      ValidateContainerCapacityHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.DrinkFromHandler,
      DrinkFromHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.DrinkEntirelyHandler,
      DrinkEntirelyHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
  ];

  for (const [token, ctor, factory] of handlerFactories) {
    registrar.singletonFactory(token, (c) => factory(c, ctor));
  }
}
