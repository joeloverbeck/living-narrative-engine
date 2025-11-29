import {
  describe,
  it,
  beforeAll,
  beforeEach,
  expect,
  jest,
} from '@jest/globals';

const handlerBasePath =
  '../../../../src/logic/operationHandlers';

const handlerModuleDefinitions = [
  ['ApplyDamageHandler', `${handlerBasePath}/applyDamageHandler.js`],
  ['ConsumeItemHandler', `${handlerBasePath}/consumeItemHandler.js`],
  ['DispatchEventHandler', `${handlerBasePath}/dispatchEventHandler.js`],
  [
    'DispatchPerceptibleEventHandler',
    `${handlerBasePath}/dispatchPerceptibleEventHandler.js`,
  ],
  ['DispatchSpeechHandler', `${handlerBasePath}/dispatchSpeechHandler.js`],
  ['DispatchThoughtHandler', `${handlerBasePath}/dispatchThoughtHandler.js`],
  ['DigestFoodHandler', `${handlerBasePath}/digestFoodHandler.js`],
  ['LogHandler', `${handlerBasePath}/logHandler.js`],
  [
    'ModifyComponentHandler',
    `${handlerBasePath}/modifyComponentHandler.js`,
  ],
  [
    'ModifyPartHealthHandler',
    `${handlerBasePath}/modifyPartHealthHandler.js`,
  ],
  ['AddComponentHandler', `${handlerBasePath}/addComponentHandler.js`],
  ['RemoveComponentHandler', `${handlerBasePath}/removeComponentHandler.js`],
  ['QueryComponentHandler', `${handlerBasePath}/queryComponentHandler.js`],
  ['QueryComponentsHandler', `${handlerBasePath}/queryComponentsHandler.js`],
  ['QueryLookupHandler', `${handlerBasePath}/queryLookupHandler.js`],
  ['SetVariableHandler', `${handlerBasePath}/setVariableHandler.js`],
  ['EndTurnHandler', `${handlerBasePath}/endTurnHandler.js`],
  [
    'SystemMoveEntityHandler',
    `${handlerBasePath}/systemMoveEntityHandler.js`,
  ],
  ['GetTimestampHandler', `${handlerBasePath}/getTimestampHandler.js`],
  ['GetNameHandler', `${handlerBasePath}/getNameHandler.js`],
  [
    'RebuildLeaderListCacheHandler',
    `${handlerBasePath}/rebuildLeaderListCacheHandler.js`,
  ],
  [
    'CheckFollowCycleHandler',
    `${handlerBasePath}/checkFollowCycleHandler.js`,
  ],
  [
    'EstablishFollowRelationHandler',
    `${handlerBasePath}/establishFollowRelationHandler.js`,
  ],
  [
    'BreakFollowRelationHandler',
    `${handlerBasePath}/breakFollowRelationHandler.js`,
  ],
  ['BurnEnergyHandler', `${handlerBasePath}/burnEnergyHandler.js`],
  ['UpdateHungerStateHandler', `${handlerBasePath}/updateHungerStateHandler.js`],
  [
    'UpdatePartHealthStateHandler',
    `${handlerBasePath}/updatePartHealthStateHandler.js`,
  ],
  [
    'AddPerceptionLogEntryHandler',
    `${handlerBasePath}/addPerceptionLogEntryHandler.js`,
  ],
  ['QueryEntitiesHandler', `${handlerBasePath}/queryEntitiesHandler.js`],
  ['HasComponentHandler', `${handlerBasePath}/hasComponentHandler.js`],
  [
    'ModifyArrayFieldHandler',
    `${handlerBasePath}/modifyArrayFieldHandler.js`,
  ],
  [
    'ModifyContextArrayHandler',
    `${handlerBasePath}/modifyContextArrayHandler.js`,
  ],
  ['IfCoLocatedHandler', `${handlerBasePath}/ifCoLocatedHandler.js`],
  ['MathHandler', `${handlerBasePath}/mathHandler.js`],
  [
    'AutoMoveFollowersHandler',
    `${handlerBasePath}/autoMoveFollowersHandler.js`,
  ],
  [
    'AutoMoveClosenessPartnersHandler',
    `${handlerBasePath}/autoMoveClosenessPartnersHandler.js`,
  ],
  [
    'MergeClosenessCircleHandler',
    `${handlerBasePath}/mergeClosenessCircleHandler.js`,
  ],
  [
    'RemoveFromClosenessCircleHandler',
    `${handlerBasePath}/removeFromClosenessCircleHandler.js`,
  ],
  [
    'EstablishSittingClosenessHandler',
    `${handlerBasePath}/establishSittingClosenessHandler.js`,
  ],
  [
    'EstablishLyingClosenessHandler',
    `${handlerBasePath}/establishLyingClosenessHandler.js`,
  ],
  [
    'RemoveSittingClosenessHandler',
    `${handlerBasePath}/removeSittingClosenessHandler.js`,
  ],
  [
    'RemoveLyingClosenessHandler',
    `${handlerBasePath}/removeLyingClosenessHandler.js`,
  ],
  [
    'BreakClosenessWithTargetHandler',
    `${handlerBasePath}/breakClosenessWithTargetHandler.js`,
  ],
  [
    'HasBodyPartWithComponentValueHandler',
    `${handlerBasePath}/hasBodyPartWithComponentValueHandler.js`,
  ],
  ['UnequipClothingHandler', `${handlerBasePath}/unequipClothingHandler.js`],
  ['LockGrabbingHandler', `${handlerBasePath}/lockGrabbingHandler.js`],
  ['LockMovementHandler', `${handlerBasePath}/lockMovementHandler.js`],
  [
    'LockMouthEngagementHandler',
    `${handlerBasePath}/lockMouthEngagementHandler.js`,
  ],
  ['UnlockGrabbingHandler', `${handlerBasePath}/unlockGrabbingHandler.js`],
  ['UnlockMovementHandler', `${handlerBasePath}/unlockMovementHandler.js`],
  [
    'UnlockMouthEngagementHandler',
    `${handlerBasePath}/unlockMouthEngagementHandler.js`,
  ],
  ['UnwieldItemHandler', `${handlerBasePath}/unwieldItemHandler.js`],
  [
    'RegenerateDescriptionHandler',
    `${handlerBasePath}/regenerateDescriptionHandler.js`,
  ],
  [
    'ResolveDirectionHandler',
    `${handlerBasePath}/resolveDirectionHandler.js`,
  ],
  [
    'ResolveHitLocationHandler',
    `${handlerBasePath}/resolveHitLocationHandler.js`,
  ],
  [
    'AtomicModifyComponentHandler',
    `${handlerBasePath}/atomicModifyComponentHandler.js`,
  ],
  [
    'ResolveOutcomeHandler',
    `${handlerBasePath}/resolveOutcomeHandler.js`,
  ],
  ['SequenceHandler', `${handlerBasePath}/sequenceHandler.js`],
  ['TransferItemHandler', `${handlerBasePath}/transferItemHandler.js`],
  [
    'ValidateInventoryCapacityHandler',
    `${handlerBasePath}/validateInventoryCapacityHandler.js`,
  ],
  [
    'DropItemAtLocationHandler',
    `${handlerBasePath}/dropItemAtLocationHandler.js`,
  ],
  [
    'PickUpItemFromLocationHandler',
    `${handlerBasePath}/pickUpItemFromLocationHandler.js`,
  ],
  [
    'PrepareActionContextHandler',
    `${handlerBasePath}/prepareActionContextHandler.js`,
  ],
  ['OpenContainerHandler', `${handlerBasePath}/openContainerHandler.js`],
  ['TakeFromContainerHandler', `${handlerBasePath}/takeFromContainerHandler.js`],
  ['PutInContainerHandler', `${handlerBasePath}/putInContainerHandler.js`],
  [
    'ValidateContainerCapacityHandler',
    `${handlerBasePath}/validateContainerCapacityHandler.js`,
  ],
  ['DrinkFromHandler', `${handlerBasePath}/drinkFromHandler.js`],
  ['DrinkEntirelyHandler', `${handlerBasePath}/drinkEntirelyHandler.js`],
  ['ForEachHandler', `${handlerBasePath}/forEachHandler.js`],
  ['IfHandler', `${handlerBasePath}/ifHandler.js`],
];

const registerHandlerMock = (name, modulePath) => {
  jest.mock(modulePath, () => {
    class MockHandler {
      constructor(config) {
        // Mimic BaseOperationHandler's dependency resolution
        this.resolvedDeps = {};
        for (const [key, spec] of Object.entries(config || {})) {
          this.resolvedDeps[key] = spec?.value ?? spec;
        }
        MockHandler.instances.push(this);
      }
    }
    MockHandler.instances = [];

    return { __esModule: true, default: MockHandler };
  });
};

handlerModuleDefinitions.forEach(([name, modulePath]) => {
  registerHandlerMock(name, modulePath);
});

const mockHandlerRegistry = new Map();

const JSON_LOGIC_SENTINEL = Symbol('jsonLogic');

let registerOperationHandlers;
let tokens;
let jsonLogic;
let handlerExpectations;

beforeAll(async () => {
  ({ registerOperationHandlers } = await import(
    '../../../../src/dependencyInjection/registrations/operationHandlerRegistrations.js'
  ));
  for (const [name, modulePath] of handlerModuleDefinitions) {
    const module = await import(modulePath);
    mockHandlerRegistry.set(name, module.default);
  }
  ({ tokens } = await import(
    '../../../../src/dependencyInjection/tokens.js'
  ));
  ({ default: jsonLogic } = await import('json-logic-js'));

  const {
    ILogger,
    IValidatedEventDispatcher,
    ISafeEventDispatcher,
    IEntityManager,
    AddPerceptionLogEntryHandler: AddPerceptionLogEntryHandlerToken,
    RebuildLeaderListCacheHandler: RebuildLeaderListCacheHandlerToken,
    JsonLogicEvaluationService: JsonLogicEvaluationServiceToken,
    OperationInterpreter: OperationInterpreterToken,
    IMoveEntityHandler: IMoveEntityHandlerToken,
    SystemMoveEntityHandler: SystemMoveEntityHandlerToken,
    ClosenessCircleService: ClosenessCircleServiceToken,
    BodyGraphService: BodyGraphServiceToken,
    EquipmentOrchestrator: EquipmentOrchestratorToken,
    BodyDescriptionComposer: BodyDescriptionComposerToken,
    ActionSequence: ActionSequenceToken,
    ChanceCalculationService: ChanceCalculationServiceToken,
  } = tokens;

  handlerExpectations = [
    {
      token: tokens.ApplyDamageHandler,
      handlerName: 'ApplyDamageHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'jsonLogicService',
          token: JsonLogicEvaluationServiceToken,
        },
        { property: 'bodyGraphService', token: BodyGraphServiceToken },
      ],
    },
    {
      token: tokens.ConsumeItemHandler,
      handlerName: 'ConsumeItemHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.DispatchEventHandler,
      handlerName: 'DispatchEventHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'dispatcher', token: IValidatedEventDispatcher },
      ],
    },
    {
      token: tokens.DispatchPerceptibleEventHandler,
      handlerName: 'DispatchPerceptibleEventHandler',
      dependencies: [
        { property: 'dispatcher', token: ISafeEventDispatcher },
        { property: 'logger', token: ILogger },
        {
          property: 'addPerceptionLogEntryHandler',
          token: AddPerceptionLogEntryHandlerToken,
        },
      ],
    },
    {
      token: tokens.DispatchSpeechHandler,
      handlerName: 'DispatchSpeechHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'dispatcher', token: IValidatedEventDispatcher },
      ],
    },
    {
      token: tokens.DispatchThoughtHandler,
      handlerName: 'DispatchThoughtHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'dispatcher', token: IValidatedEventDispatcher },
      ],
    },
    {
      token: tokens.DigestFoodHandler,
      handlerName: 'DigestFoodHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.LogHandler,
      handlerName: 'LogHandler',
      dependencies: [{ property: 'logger', token: ILogger }],
    },
    {
      token: tokens.ModifyComponentHandler,
      handlerName: 'ModifyComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ModifyPartHealthHandler,
      handlerName: 'ModifyPartHealthHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'jsonLogicService',
          token: JsonLogicEvaluationServiceToken,
        },
      ],
    },
    {
      token: tokens.AddComponentHandler,
      handlerName: 'AddComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        { property: 'gameDataRepository', token: tokens.IGameDataRepository },
      ],
    },
    {
      token: tokens.RemoveComponentHandler,
      handlerName: 'RemoveComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.QueryComponentHandler,
      handlerName: 'QueryComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.QueryComponentsHandler,
      handlerName: 'QueryComponentsHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.QueryLookupHandler,
      handlerName: 'QueryLookupHandler',
      dependencies: [
        { property: 'dataRegistry', token: tokens.IDataRegistry },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.SetVariableHandler,
      handlerName: 'SetVariableHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'jsonLogic', token: JSON_LOGIC_SENTINEL },
      ],
    },
    {
      token: tokens.EndTurnHandler,
      handlerName: 'EndTurnHandler',
      dependencies: [
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        { property: 'logger', token: ILogger },
      ],
    },
    {
      token: tokens.ForEachHandler,
      handlerName: 'ForEachHandler',
      dependencies: [
        { property: 'operationInterpreter', token: OperationInterpreterToken, isLazy: true },
        { property: 'jsonLogic', token: JsonLogicEvaluationServiceToken },
        { property: 'logger', token: ILogger },
      ],
    },
    {
      token: tokens.SystemMoveEntityHandler,
      handlerName: 'SystemMoveEntityHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: IMoveEntityHandlerToken,
      factoryResultToken: SystemMoveEntityHandlerToken,
    },
    {
      token: tokens.IfHandler,
      handlerName: 'IfHandler',
      dependencies: [
        { property: 'operationInterpreter', token: OperationInterpreterToken, isLazy: true },
        { property: 'jsonLogic', token: JsonLogicEvaluationServiceToken },
        { property: 'logger', token: ILogger },
      ],
    },
    {
      token: tokens.GetTimestampHandler,
      handlerName: 'GetTimestampHandler',
      dependencies: [{ property: 'logger', token: ILogger }],
    },
    {
      token: tokens.GetNameHandler,
      handlerName: 'GetNameHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.RebuildLeaderListCacheHandler,
      handlerName: 'RebuildLeaderListCacheHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.CheckFollowCycleHandler,
      handlerName: 'CheckFollowCycleHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.EstablishFollowRelationHandler,
      handlerName: 'EstablishFollowRelationHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        {
          property: 'rebuildLeaderListCacheHandler',
          token: RebuildLeaderListCacheHandlerToken,
        },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.BreakFollowRelationHandler,
      handlerName: 'BreakFollowRelationHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        {
          property: 'rebuildLeaderListCacheHandler',
          token: RebuildLeaderListCacheHandlerToken,
        },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.BurnEnergyHandler,
      handlerName: 'BurnEnergyHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UpdateHungerStateHandler,
      handlerName: 'UpdateHungerStateHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UpdatePartHealthStateHandler,
      handlerName: 'UpdatePartHealthStateHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.AddPerceptionLogEntryHandler,
      handlerName: 'AddPerceptionLogEntryHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.QueryEntitiesHandler,
      handlerName: 'QueryEntitiesHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        {
          property: 'jsonLogicEvaluationService',
          token: JsonLogicEvaluationServiceToken,
        },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.HasComponentHandler,
      handlerName: 'HasComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ModifyArrayFieldHandler,
      handlerName: 'ModifyArrayFieldHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ModifyContextArrayHandler,
      handlerName: 'ModifyContextArrayHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.IfCoLocatedHandler,
      handlerName: 'IfCoLocatedHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'operationInterpreter', token: OperationInterpreterToken, isLazy: true },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.MathHandler,
      handlerName: 'MathHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.AutoMoveFollowersHandler,
      handlerName: 'AutoMoveFollowersHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'moveEntityHandler', token: IMoveEntityHandlerToken },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.AutoMoveClosenessPartnersHandler,
      handlerName: 'AutoMoveClosenessPartnersHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'systemMoveEntityHandler', token: SystemMoveEntityHandlerToken },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.MergeClosenessCircleHandler,
      handlerName: 'MergeClosenessCircleHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.RemoveFromClosenessCircleHandler,
      handlerName: 'RemoveFromClosenessCircleHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.EstablishSittingClosenessHandler,
      handlerName: 'EstablishSittingClosenessHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.EstablishLyingClosenessHandler,
      handlerName: 'EstablishLyingClosenessHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.RemoveSittingClosenessHandler,
      handlerName: 'RemoveSittingClosenessHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.RemoveLyingClosenessHandler,
      handlerName: 'RemoveLyingClosenessHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.BreakClosenessWithTargetHandler,
      handlerName: 'BreakClosenessWithTargetHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'closenessCircleService',
          token: ClosenessCircleServiceToken,
        },
      ],
    },
    {
      token: tokens.HasBodyPartWithComponentValueHandler,
      handlerName: 'HasBodyPartWithComponentValueHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'bodyGraphService', token: BodyGraphServiceToken },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UnequipClothingHandler,
      handlerName: 'UnequipClothingHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'equipmentOrchestrator',
          token: EquipmentOrchestratorToken,
        },
      ],
    },
    {
      token: tokens.LockGrabbingHandler,
      handlerName: 'LockGrabbingHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.LockMovementHandler,
      handlerName: 'LockMovementHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.LockMouthEngagementHandler,
      handlerName: 'LockMouthEngagementHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UnlockGrabbingHandler,
      handlerName: 'UnlockGrabbingHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UnlockMovementHandler,
      handlerName: 'UnlockMovementHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UnlockMouthEngagementHandler,
      handlerName: 'UnlockMouthEngagementHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.UnwieldItemHandler,
      handlerName: 'UnwieldItemHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.RegenerateDescriptionHandler,
      handlerName: 'RegenerateDescriptionHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        {
          property: 'bodyDescriptionComposer',
          token: BodyDescriptionComposerToken,
        },
      ],
    },
    {
      token: tokens.ResolveDirectionHandler,
      handlerName: 'ResolveDirectionHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ResolveHitLocationHandler,
      handlerName: 'ResolveHitLocationHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
        { property: 'bodyGraphService', token: BodyGraphServiceToken },
      ],
    },
    {
      token: tokens.AtomicModifyComponentHandler,
      handlerName: 'AtomicModifyComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ResolveOutcomeHandler,
      handlerName: 'ResolveOutcomeHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        {
          property: 'chanceCalculationService',
          token: ChanceCalculationServiceToken,
        },
      ],
    },
    {
      token: tokens.SequenceHandler,
      handlerName: 'SequenceHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'actionSequence', token: ActionSequenceToken },
      ],
    },
    {
      token: tokens.TransferItemHandler,
      handlerName: 'TransferItemHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ValidateInventoryCapacityHandler,
      handlerName: 'ValidateInventoryCapacityHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.DropItemAtLocationHandler,
      handlerName: 'DropItemAtLocationHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.PickUpItemFromLocationHandler,
      handlerName: 'PickUpItemFromLocationHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.PrepareActionContextHandler,
      handlerName: 'PrepareActionContextHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
      ],
    },
    {
      token: tokens.OpenContainerHandler,
      handlerName: 'OpenContainerHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.TakeFromContainerHandler,
      handlerName: 'TakeFromContainerHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.PutInContainerHandler,
      handlerName: 'PutInContainerHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.ValidateContainerCapacityHandler,
      handlerName: 'ValidateContainerCapacityHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.DrinkFromHandler,
      handlerName: 'DrinkFromHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
    {
      token: tokens.DrinkEntirelyHandler,
      handlerName: 'DrinkEntirelyHandler',
      dependencies: [
        { property: 'logger', token: ILogger },
        { property: 'entityManager', token: IEntityManager },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
      ],
    },
  ];
});

describe('registerOperationHandlers', () => {
  /** @type {Map<string | symbol, (container: any) => any>} */
  let registrations;
  let registrar;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandlerRegistry.forEach((stats) => {
      if (stats?.instances) {
        stats.instances.length = 0;
      }
    });
    registrations = new Map();
    registrar = {
      singletonFactory: jest.fn((token, factory) => {
        if (registrations.has(token)) {
          throw new Error(`Duplicate registration for token ${String(token)}`);
        }
        registrations.set(token, factory);
      }),
    };

    registerOperationHandlers(registrar);
  });

  it('registers each operation handler token exactly once', () => {
    expect(mockHandlerRegistry.size).toBe(handlerModuleDefinitions.length);
    // Removed brittle count assertion that breaks with every new handler addition
    // expect(registrations.size).toBe(handlerExpectations.length);
    expect(registrar.singletonFactory).toHaveBeenCalled();

    const registeredTokens = Array.from(registrations.keys());
    const expectedTokens = handlerExpectations.map(({ token }) => token);

    expect(registeredTokens.sort()).toEqual(expectedTokens.sort());
  });

  it('creates each handler with resolved dependencies', () => {
    const dependencyInstances = new Map();
    const getDependencyInstance = (token) => {
      if (!dependencyInstances.has(token)) {
        dependencyInstances.set(token, { token });
      }
      return dependencyInstances.get(token);
    };

    const mockContainer = {
      resolve: jest.fn((token) => getDependencyInstance(token)),
    };

    handlerExpectations.forEach((expectation) => {
      const factory = registrations.get(expectation.token);
      expect(factory).toBeDefined();

      const previousCallCount = mockContainer.resolve.mock.calls.length;
      const result = factory(mockContainer);
      const newResolveCalls = mockContainer.resolve.mock.calls.slice(
        previousCallCount
      );

      if (expectation.dependencies) {
        const handlerStats = mockHandlerRegistry.get(expectation.handlerName);
        expect(handlerStats).toBeDefined();
        expect(handlerStats.instances).toHaveLength(1);

        const [handlerInstance] = handlerStats.instances;
        const resolvedDeps = handlerInstance.resolvedDeps;
        expectation.dependencies.forEach(({ property, token, isLazy }) => {
          expect(resolvedDeps).toHaveProperty(property);
          if (token === JSON_LOGIC_SENTINEL) {
            expect(resolvedDeps[property]).toBe(jsonLogic);
          } else if (isLazy) {
            // For lazy resolvers, verify it's a function
            expect(typeof resolvedDeps[property]).toBe('function');
            // Verify it resolves correctly when called
            const resolved = resolvedDeps[property]();
            expect(resolved).toBe(getDependencyInstance(token));
          } else {
            const dependencyInstance = getDependencyInstance(token);
            expect(resolvedDeps[property]).toBe(dependencyInstance);
          }
        });

        const expectedTokens = expectation.dependencies
          .filter(({ token, isLazy }) => token !== JSON_LOGIC_SENTINEL && !isLazy)
          .map(({ token }) => token);
        expect(newResolveCalls.map(([token]) => token)).toEqual(
          expectedTokens
        );
      } else if (expectation.factoryResultToken) {
        const expectedInstance = getDependencyInstance(
          expectation.factoryResultToken
        );
        expect(result).toBe(expectedInstance);
        expect(newResolveCalls.map(([token]) => token)).toEqual([
          expectation.factoryResultToken,
        ]);
      } else {
        throw new Error('Invalid handler expectation configuration.');
      }
    });
  });
});
