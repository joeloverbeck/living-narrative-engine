// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import { ActionDiscoveryService } from '../../src/actions/actionDiscoveryService.js';

// --- Action Definitions ---
import coreGoActionDefinition from '../../data/mods/core/actions/go.action.json';
import coreWaitActionDefinition from '../../data/mods/core/actions/wait.action.json';

// --- Core Dependencies to Mock ---
import { GameDataRepository } from '../../src/data/gameDataRepository.js';
import EntityManager from '../../src/entities/entityManager.js';
import { ActionValidationService } from '../../src/actions/validation/actionValidationService.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import { formatActionCommand as formatActionCommandFn } from '../../src/actions/actionFormatter.js';
import { getEntityIdsForScopes as getEntityIdsForScopesFn } from '../../src/entities/entityScopeService.js';
import { getAvailableExits } from '../../src/utils/locationUtils.js';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../src/models/actionTargetContext.js';
import Entity from '../../src/entities/entity.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// --- Mocking Dependencies ---
jest.mock('../../src/data/gameDataRepository.js');
jest.mock('../../src/entities/entityManager.js');
jest.mock('../../src/actions/validation/actionValidationService.js');
jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/actions/actionFormatter.js');
jest.mock('../../src/entities/entityScopeService.js');
jest.mock('../../src/utils/locationUtils.js');

describe('ActionDiscoveryService - Go Action (Fixed State)', () => {
  let actionDiscoveryService;
  let mockGameDataRepo;
  let mockEntityManager;
  let mockValidationService;
  let mockLogger;
  let mockFormatActionCommandFn;
  let mockGetEntityIdsForScopesFn;
  let mockGetAvailableExits;
  let availableExits;

  const HERO_DEFINITION_ID = 'isekai:hero';
  const GUILD_DEFINITION_ID = 'isekai:adventurers_guild';
  const TOWN_DEFINITION_ID = 'isekai:town';

  const HERO_INSTANCE_ID = 'hero-instance-uuid-integration-1';
  const GUILD_INSTANCE_ID = 'guild-instance-uuid-integration-1';

  const heroEntityDefinitionData = {
    id: HERO_DEFINITION_ID,
    components: {
      'core:actor': {},
      'core:player': {},
      'core:name': { text: 'Hero' },
      [POSITION_COMPONENT_ID]: { locationId: GUILD_INSTANCE_ID, x: 0, y: 0 },
    },
  };
  const adventurersGuildEntityDefinitionData = {
    id: GUILD_DEFINITION_ID,
    components: {
      'core:name': { text: "Adventurers' Guild" },
      'core:description': { text: "The local adventurers' guild." },
      [EXITS_COMPONENT_ID]: [
        {
          direction: 'out to town',
          target: TOWN_DEFINITION_ID,
          blocker: null,
        },
      ],
    },
  };

  let mockHeroEntity;
  let mockAdventurersGuildLocation;
  let mockActionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGameDataRepo = new GameDataRepository();
    mockEntityManager = new EntityManager();
    mockValidationService = new ActionValidationService();
    mockLogger = new ConsoleLogger();
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    mockFormatActionCommandFn = formatActionCommandFn;
    mockGetEntityIdsForScopesFn = getEntityIdsForScopesFn;
    mockGetAvailableExits = getAvailableExits;

    mockHeroEntity = new Entity(HERO_INSTANCE_ID, HERO_DEFINITION_ID);
    Object.entries(heroEntityDefinitionData.components).forEach(
      ([typeId, data]) => {
        mockHeroEntity.addComponent(typeId, JSON.parse(JSON.stringify(data)));
      }
    );

    mockAdventurersGuildLocation = new Entity(
      GUILD_INSTANCE_ID,
      GUILD_DEFINITION_ID
    );
    Object.entries(adventurersGuildEntityDefinitionData.components).forEach(
      ([typeId, data]) => {
        mockAdventurersGuildLocation.addComponent(
          typeId,
          JSON.parse(JSON.stringify(data))
        );
      }
    );

    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
      coreGoActionDefinition,
    ]);

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === HERO_INSTANCE_ID) return mockHeroEntity;
      if (id === GUILD_INSTANCE_ID) return mockAdventurersGuildLocation;
      return undefined;
    });

    mockEntityManager.getComponentData.mockImplementation(
      (instanceId, componentTypeId) => {
        const target =
          instanceId === HERO_INSTANCE_ID
            ? mockHeroEntity
            : instanceId === GUILD_INSTANCE_ID
              ? mockAdventurersGuildLocation
              : null;
        return target ? target.getComponentData(componentTypeId) : undefined;
      }
    );

    mockEntityManager.hasComponent.mockImplementation(
      (instanceId, componentTypeId) => {
        const target =
          instanceId === HERO_INSTANCE_ID
            ? mockHeroEntity
            : instanceId === GUILD_INSTANCE_ID
              ? mockAdventurersGuildLocation
              : null;
        return target ? target.hasComponent(componentTypeId) : false;
      }
    );

    availableExits = [
      { direction: 'out to town', target: TOWN_DEFINITION_ID, blocker: null },
    ];
    mockGetAvailableExits.mockReturnValue(availableExits);

    mockValidationService.isValid.mockImplementation(
      (actionDef, actor, targetContext) => {
        if (actor.id !== HERO_INSTANCE_ID) return false;
        if (actionDef.id === 'core:wait') {
          return targetContext.type === 'none';
        }
        if (actionDef.id === 'core:go') {
          return (
            targetContext.type === 'direction' &&
            targetContext.direction === 'out to town' &&
            availableExits.find((e) => e.direction === 'out to town')
              .blocker === null
          );
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
      actingEntity: mockHeroEntity,
      currentLocation: mockAdventurersGuildLocation,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepo,
      logger: mockLogger,
      worldContext: {},
    };

    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn,
    });
  });

  it('should discover "go out to town" action when player is in adventurers guild and exit is available', async () => {
    const validActions = await actionDiscoveryService.getValidActions(
      mockHeroEntity,
      mockActionContext
    );

    expect(validActions).toBeDefined();
    expect(Array.isArray(validActions)).toBe(true);

    const waitAction = {
      id: 'core:wait',
      name: 'Wait',
      command: 'wait',
      description: 'Passes your turn without performing any action.',
      params: {},
    };
    const goAction = {
      id: 'core:go',
      name: 'Go',
      command: 'go out to town',
      description:
        'Moves your character in the specified direction, if the way is clear.',
      params: { targetId: TOWN_DEFINITION_ID },
    };

    expect(validActions).toContainEqual(waitAction);
    expect(validActions).toContainEqual(goAction);

    expect(mockGetAvailableExits).toHaveBeenCalledWith(
      mockAdventurersGuildLocation,
      mockEntityManager,
      mockLogger
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Found ${availableExits.length} available exits for location: ${GUILD_INSTANCE_ID} via getAvailableExits.`
    );

    expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);

    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreWaitActionDefinition,
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

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${HERO_INSTANCE_ID}. Found 2 actions.`
      )
    );
  });
});
