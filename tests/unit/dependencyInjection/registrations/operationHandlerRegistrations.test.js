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
  ['DispatchEventHandler', `${handlerBasePath}/dispatchEventHandler.js`],
  [
    'DispatchPerceptibleEventHandler',
    `${handlerBasePath}/dispatchPerceptibleEventHandler.js`,
  ],
  ['DispatchSpeechHandler', `${handlerBasePath}/dispatchSpeechHandler.js`],
  ['DispatchThoughtHandler', `${handlerBasePath}/dispatchThoughtHandler.js`],
  ['LogHandler', `${handlerBasePath}/logHandler.js`],
  [
    'ModifyComponentHandler',
    `${handlerBasePath}/modifyComponentHandler.js`,
  ],
  ['AddComponentHandler', `${handlerBasePath}/addComponentHandler.js`],
  ['RemoveComponentHandler', `${handlerBasePath}/removeComponentHandler.js`],
  ['QueryComponentHandler', `${handlerBasePath}/queryComponentHandler.js`],
  ['QueryComponentsHandler', `${handlerBasePath}/queryComponentsHandler.js`],
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
    'RemoveSittingClosenessHandler',
    `${handlerBasePath}/removeSittingClosenessHandler.js`,
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
  ['LockMovementHandler', `${handlerBasePath}/lockMovementHandler.js`],
  [
    'LockMouthEngagementHandler',
    `${handlerBasePath}/lockMouthEngagementHandler.js`,
  ],
  ['UnlockMovementHandler', `${handlerBasePath}/unlockMovementHandler.js`],
  [
    'UnlockMouthEngagementHandler',
    `${handlerBasePath}/unlockMouthEngagementHandler.js`,
  ],
  [
    'RegenerateDescriptionHandler',
    `${handlerBasePath}/regenerateDescriptionHandler.js`,
  ],
  [
    'AtomicModifyComponentHandler',
    `${handlerBasePath}/atomicModifyComponentHandler.js`,
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
  ['OpenContainerHandler', `${handlerBasePath}/openContainerHandler.js`],
  ['TakeFromContainerHandler', `${handlerBasePath}/takeFromContainerHandler.js`],
  ['PutInContainerHandler', `${handlerBasePath}/putInContainerHandler.js`],
  [
    'ValidateContainerCapacityHandler',
    `${handlerBasePath}/validateContainerCapacityHandler.js`,
  ],
];

const registerHandlerMock = (name, modulePath) => {
  jest.mock(modulePath, () => {
    class MockHandler {
      constructor(config) {
        this.config = config;
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
  } = tokens;

  handlerExpectations = [
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
      token: tokens.AddComponentHandler,
      handlerName: 'AddComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
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
        { property: 'operationInterpreter', token: OperationInterpreterToken },
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
      token: tokens.AtomicModifyComponentHandler,
      handlerName: 'AtomicModifyComponentHandler',
      dependencies: [
        { property: 'entityManager', token: IEntityManager },
        { property: 'logger', token: ILogger },
        { property: 'safeEventDispatcher', token: ISafeEventDispatcher },
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
    expect(registrations.size).toBe(handlerExpectations.length);
    expect(registrar.singletonFactory).toHaveBeenCalledTimes(
      handlerExpectations.length
    );

    const registeredTokens = Array.from(registrations.keys());
    const expectedTokens = handlerExpectations.map(({ token }) => token);

    expect(registeredTokens).toEqual(expectedTokens);
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
        const config = handlerInstance.config;
        expectation.dependencies.forEach(({ property, token }) => {
          expect(config).toHaveProperty(property);
          if (token === JSON_LOGIC_SENTINEL) {
            expect(config[property]).toBe(jsonLogic);
          } else {
            const dependencyInstance = getDependencyInstance(token);
            expect(config[property]).toBe(dependencyInstance);
          }
        });

        const expectedTokens = expectation.dependencies
          .filter(({ token }) => token !== JSON_LOGIC_SENTINEL)
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
