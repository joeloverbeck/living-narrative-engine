// tests/integration/actionDiscoverySystem.go.test.js
// --- FILE START ---

// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import { ActionDiscoverySystem } from '../../src/systems/actionDiscoverySystem.js';

// --- Core Dependencies to Mock ---
import { GameDataRepository } from '../../src/services/gameDataRepository.js';
import EntityManager from '../../src/entities/entityManager.js';
import { ActionValidationService } from '../../src/services/actionValidationService.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import { formatActionCommand as formatActionCommandFn } from '../../src/services/actionFormatter.js';
import { getEntityIdsForScopes as getEntityIdsForScopesFn } from '../../src/services/entityScopeService.js';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../src/models/actionTargetContext.js';
import Entity from '../../src/entities/entity.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

/** @typedef {import('../../src/types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../src/actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../src/services/consoleLogger.js').default} ILogger */

// --- Mocking Dependencies ---
jest.mock('../../src/services/gameDataRepository.js');
jest.mock('../../src/entities/entityManager.js');
jest.mock('../../src/services/actionValidationService.js');
jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/services/actionFormatter.js');
jest.mock('../../src/services/entityScopeService.js');

describe('ActionDiscoverySystem - Go Action (Fixed State)', () => {
  /** @type {jest.Mocked<ActionDiscoverySystem>} */ // Type it as mocked if you intend to spy on its methods, though usually test SUT directly.
  let actionDiscoverySystem;
  /** @type {jest.Mocked<GameDataRepository>} */
  let mockGameDataRepo;
  /** @type {jest.Mocked<EntityManager>} */
  let mockEntityManager;
  /** @type {jest.Mocked<ActionValidationService>} */
  let mockValidationService;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.MockedFunction<typeof formatActionCommandFn>} */
  let mockFormatActionCommandFn;
  /** @type {jest.MockedFunction<typeof getEntityIdsForScopesFn>} */
  let mockGetEntityIdsForScopesFn;

  const HERO_DEFINITION_ID = 'isekai:hero';
  const GUILD_DEFINITION_ID = 'isekai:adventurers_guild';
  const TOWN_DEFINITION_ID = 'isekai:town'; // Assuming this is the target of the exit

  const HERO_INSTANCE_ID = 'hero-instance-uuid-integration-1';
  const GUILD_INSTANCE_ID = 'guild-instance-uuid-integration-1';
  // const TOWN_INSTANCE_ID = "town-instance-uuid-integration-1"; // If town was an actual entity instance

  /** @type {ActionDefinition} */
  const coreGoActionDefinition = {
    id: 'core:go',
    commandVerb: 'go',
    name: 'Go',
    target_domain: 'direction',
    prerequisites: [
      {
        logic: {
          '==': [{ var: 'target.blocker' }, null],
        },
        failure_message: 'The way is blocked.',
      },
    ],
    template: 'go {direction}',
  };

  /** @type {ActionDefinition} */
  const coreWaitActionDefinition = {
    id: 'core:wait',
    commandVerb: 'wait',
    name: 'Wait',
    target_domain: 'none',
    prerequisites: [],
    template: 'wait',
  };

  // These are definition data objects, not Entity instances
  const heroEntityDefinitionData = {
    id: HERO_DEFINITION_ID,
    components: {
      'core:actor': {},
      'core:player': {},
      'core:name': { text: 'Hero' },
      [POSITION_COMPONENT_ID]: { locationId: GUILD_INSTANCE_ID, x: 0, y: 0 }, // Hero is at guild instance
    },
  };

  const adventurersGuildEntityDefinitionData = {
    id: GUILD_DEFINITION_ID,
    components: {
      'core:name': { text: "Adventurers' Guild" },
      'core:description': { text: "The local adventurers' guild." },
      [EXITS_COMPONENT_ID]: [
        { direction: 'out to town', target: TOWN_DEFINITION_ID, blocker: null }, // Target is a definition ID
      ],
    },
  };

  /** @type {Entity} */
  let mockHeroEntity;
  /** @type {Entity} */
  let mockAdventurersGuildLocation;
  /** @type {ActionContext} */
  let mockActionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Since these are classes mocked by jest.mock, new Class() returns a mock constructor.
    // The instances will have jest.fn() for all methods.
    mockGameDataRepo = new GameDataRepository();
    mockEntityManager = new EntityManager();
    mockValidationService = new ActionValidationService();
    mockLogger = new ConsoleLogger(); // This will be the mocked constructor from jest.mock
    // Ensure logger methods are jest.fn() if not automatically by global mock
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    mockFormatActionCommandFn = formatActionCommandFn; // Already a mock
    mockGetEntityIdsForScopesFn = getEntityIdsForScopesFn; // Already a mock

    // Correctly instantiate Entity objects using new (instanceId, definitionId) signature
    mockHeroEntity = new Entity(HERO_INSTANCE_ID, HERO_DEFINITION_ID);
    // Manually add components to the mock entity as EntityManager would in a real scenario
    Object.entries(heroEntityDefinitionData.components || {}).forEach(
      ([typeId, data]) => {
        mockHeroEntity.addComponent(typeId, JSON.parse(JSON.stringify(data)));
      }
    );

    mockAdventurersGuildLocation = new Entity(
      GUILD_INSTANCE_ID,
      GUILD_DEFINITION_ID
    );
    Object.entries(
      adventurersGuildEntityDefinitionData.components || {}
    ).forEach(([typeId, data]) => {
      mockAdventurersGuildLocation.addComponent(
        typeId,
        JSON.parse(JSON.stringify(data))
      );
    });

    // Setup mock return values
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
      coreGoActionDefinition,
    ]);

    mockEntityManager.getEntityInstance.mockImplementation((instanceId) => {
      if (instanceId === HERO_INSTANCE_ID) return mockHeroEntity;
      if (instanceId === GUILD_INSTANCE_ID) return mockAdventurersGuildLocation;
      // For simplicity, we are not mocking the "isekai:town" entity instance in this test setup
      // If ActionDiscoverySystem needed to fetch it (e.g. to check its properties), it would return undefined
      return undefined;
    });

    mockEntityManager.getComponentData.mockImplementation(
      (instanceId, componentTypeId) => {
        let targetEntity;
        if (instanceId === HERO_INSTANCE_ID) targetEntity = mockHeroEntity;
        else if (instanceId === GUILD_INSTANCE_ID)
          targetEntity = mockAdventurersGuildLocation;

        return targetEntity
          ? targetEntity.getComponentData(componentTypeId)
          : undefined;
      }
    );

    mockEntityManager.hasComponent.mockImplementation(
      (instanceId, componentTypeId) => {
        let targetEntity;
        if (instanceId === HERO_INSTANCE_ID) targetEntity = mockHeroEntity;
        else if (instanceId === GUILD_INSTANCE_ID)
          targetEntity = mockAdventurersGuildLocation;

        return targetEntity
          ? targetEntity.hasComponent(componentTypeId)
          : false;
      }
    );

    mockValidationService.isValid.mockImplementation(
      (actionDef, actor, targetContext) => {
        if (actor.id !== HERO_INSTANCE_ID) return false; // Check against instance ID
        if (actionDef.id === 'core:wait') {
          return targetContext.type === 'none';
        }
        if (actionDef.id === 'core:go') {
          if (targetContext.type === 'none') return true; // Initial actor check
          if (
            targetContext.type === 'direction' &&
            targetContext.direction === 'out to town'
          ) {
            // Simulate prerequisite check (blocker is null)
            const guildExits =
              mockAdventurersGuildLocation.getComponentData(EXITS_COMPONENT_ID);
            const relevantExit = guildExits?.find(
              (e) => e.direction === 'out to town'
            );
            return !!relevantExit && relevantExit.blocker === null;
          }
        }
        return false;
      }
    );

    mockFormatActionCommandFn.mockImplementation((actionDef, targetContext) => {
      if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
        return 'wait';
      }
      if (
        actionDef.id === 'core:go' &&
        targetContext.type === 'direction' &&
        targetContext.direction === 'out to town'
      ) {
        return 'go out to town';
      }
      return null;
    });

    mockGetEntityIdsForScopesFn.mockReturnValue(new Set());

    mockActionContext = {
      actor: mockHeroEntity,
      currentLocation: mockAdventurersGuildLocation,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepo,
      logger: mockLogger,
      worldContext: /** @type {any} */ ({}),
    };

    actionDiscoverySystem = new ActionDiscoverySystem({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn,
    });
  });

  it('should discover "go out to town" action when player is in adventurers guild and exit is available', async () => {
    const validActions = await actionDiscoverySystem.getValidActions(
      mockHeroEntity,
      mockActionContext
    );

    expect(validActions).toBeDefined();
    expect(Array.isArray(validActions)).toBe(true);

    const waitAction = {
      id: 'core:wait',
      name: 'Wait',
      command: 'wait',
      description: '',
    };
    const goAction = {
      id: 'core:go',
      name: 'Go',
      command: 'go out to town',
      description: '',
    };

    expect(validActions).toContainEqual(waitAction);
    expect(validActions).toContainEqual(goAction);

    // ActionDiscoverySystem logs INSTANCE IDs
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Checking exits data (component ${EXITS_COMPONENT_ID}) for location: ${GUILD_INSTANCE_ID}`, // Location's instance ID
      adventurersGuildEntityDefinitionData.components[EXITS_COMPONENT_ID] // The actual component data
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found ${adventurersGuildEntityDefinitionData.components[EXITS_COMPONENT_ID].length} potential exits from ${EXITS_COMPONENT_ID}. Checking validation...`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `    -> Processing exit direction: out to town`
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `    * Found valid action (direction: out to town): '${coreGoActionDefinition.name}' (ID: core:go)`
    );

    expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
    // getComponentData is called with the location's INSTANCE ID
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      GUILD_INSTANCE_ID,
      EXITS_COMPONENT_ID
    );

    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreWaitActionDefinition,
      mockHeroEntity,
      ActionTargetContext.noTarget()
    );
    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreGoActionDefinition,
      mockHeroEntity,
      ActionTargetContext.noTarget()
    );
    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreGoActionDefinition,
      mockHeroEntity,
      ActionTargetContext.forDirection('out to town')
    );

    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreWaitActionDefinition,
      ActionTargetContext.noTarget(),
      mockEntityManager,
      expect.any(Object)
    );
    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreGoActionDefinition,
      ActionTargetContext.forDirection('out to town'),
      mockEntityManager,
      expect.any(Object)
    );

    expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
    // Log check uses actor's INSTANCE ID
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${HERO_INSTANCE_ID}. Found 2 valid commands/actions.`
      )
    );
  });
});
// --- FILE END ---
