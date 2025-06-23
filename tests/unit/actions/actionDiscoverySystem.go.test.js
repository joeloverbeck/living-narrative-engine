// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

// --- Action Definitions ---
import coreGoActionDefinition from '../../../data/mods/core/actions/go.action.json';
import coreWaitActionDefinition from '../../../data/mods/core/actions/wait.action.json';

// --- Core Dependencies to Mock ---
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

// --- Mocking Dependencies ---
jest.mock('../../../src/data/gameDataRepository.js');
jest.mock('../../../src/entities/entityManager.js');
jest.mock('../../../src/actions/validation/actionValidationService.js');
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/actions/actionFormatter.js');
jest.mock('../../../src/entities/entityScopeService.js');
jest.mock('../../../src/scopeDsl/scopeRegistry.js');

describe('ActionDiscoveryService - Go Action (Fixed State)', () => {
  let actionDiscoveryService;
  let mockGameDataRepo;
  let mockEntityManager;
  let mockValidationService;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockScopeRegistry;

  // --- Mocks of imported functions ---
  // These are automatically mocked by jest.mock() at the top of the file
  const mockFormatActionCommandFn = formatActionCommand;
  const mockGetEntityIdsForScopesFn = getEntityIdsForScopes;

  const HERO_DEFINITION_ID = 'isekai:hero';
  const GUILD_DEFINITION_ID = 'isekai:adventurers_guild';
  const TOWN_DEFINITION_ID = 'isekai:town';

  const HERO_INSTANCE_ID = 'hero-instance-uuid-integration-1';
  const GUILD_INSTANCE_ID = 'guild-instance-uuid-integration-1';
  const TOWN_INSTANCE_ID = 'town-instance-uuid-integration-1';

  // Helper function to create entity instances for testing
  const createTestEntity = (
    instanceId,
    definitionId,
    defComponents = {},
    instanceOverrides = {}
  ) => {
    const definition = new EntityDefinition(definitionId, {
      description: `Test Definition ${definitionId}`,
      components: defComponents,
    });
    const instanceData = new EntityInstanceData(
      instanceId,
      definition,
      instanceOverrides
    );
    return new Entity(instanceData);
  };

  const heroEntityInitialComponents = {
    'core:actor': {},
    'core:player': {},
    'core:name': { text: 'Hero' },
    [POSITION_COMPONENT_ID]: { locationId: GUILD_INSTANCE_ID },
  };

  // Note: core:go action definition uses `scope: "directions"`. This scope must resolve to a target.
  const adventurersGuildEntityDefinitionData = {
    id: GUILD_DEFINITION_ID,
    components: {
      'core:name': { text: "Adventurers' Guild" },
      'core:description': { text: "The local adventurers' guild." },
      [EXITS_COMPONENT_ID]: [
        {
          direction: 'out to town',
          target: TOWN_INSTANCE_ID, // Exit target is now an instance ID
          blocker: null,
        },
      ],
    },
  };

  let mockHeroEntity;
  let mockAdventurersGuildLocation;
  let mockTownLocation;
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

    mockSafeEventDispatcher = { dispatch: jest.fn() };
    mockScopeRegistry = new ScopeRegistry();

    mockHeroEntity = createTestEntity(
      HERO_INSTANCE_ID,
      HERO_DEFINITION_ID,
      {},
      heroEntityInitialComponents
    );

    mockAdventurersGuildLocation = createTestEntity(
      GUILD_INSTANCE_ID,
      GUILD_DEFINITION_ID,
      {},
      adventurersGuildEntityDefinitionData.components
    );

    mockTownLocation = createTestEntity(
      TOWN_INSTANCE_ID,
      TOWN_DEFINITION_ID,
      { 'core:name': { text: 'The Town' } },
      {}
    );

    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
      coreGoActionDefinition,
    ]);

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === HERO_INSTANCE_ID) return mockHeroEntity;
      if (id === GUILD_INSTANCE_ID) return mockAdventurersGuildLocation;
      if (id === TOWN_INSTANCE_ID) return mockTownLocation;
      return undefined;
    });

    // The mock for getEntityIdsForScopes is now central to making this test work.
    mockGetEntityIdsForScopesFn.mockImplementation((scopes, context) => {
      if (scopes.includes('directions')) {
        // Simulate that the scope resolver correctly found the target of the exit.
        return new Set([TOWN_INSTANCE_ID]);
      }
      return new Set();
    });

    mockValidationService.isValid.mockReturnValue(true);

    mockFormatActionCommandFn.mockImplementation(
      (actionDef, targetContext, entityManager) => {
        if (actionDef.id === 'core:wait') return 'wait';
        if (actionDef.id === 'core:go' && targetContext.type === 'entity') {
          const targetEntity = entityManager.getEntityInstance(
            targetContext.entityId
          );
          const targetName = targetEntity.getComponentData('core:name').text;
          return actionDef.template.replace('{target}', targetName);
        }
        return null;
      }
    );

    mockActionContext = {
      // The service now populates this itself, but providing it is still good practice.
      currentLocation: mockAdventurersGuildLocation,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepo,
      logger: mockLogger,
    };

    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn,
      safeEventDispatcher: mockSafeEventDispatcher,
      scopeRegistry: mockScopeRegistry,
    });
  });

  it('should discover "go to The Town" action when player is in adventurers guild and scope resolves an exit', async () => {
    const result = await actionDiscoveryService.getValidActions(
      mockHeroEntity,
      mockActionContext
    );

    expect(result.errors).toEqual([]);
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);

    const waitAction = {
      id: 'core:wait',
      name: 'Wait',
      command: 'wait',
      description: 'Wait for a moment, doing nothing.',
      params: {},
    };
    const goAction = {
      id: 'core:go',
      name: 'Go',
      command: 'go to The Town',
      description:
        'Moves your character to the specified location, if the way is clear.',
      params: { targetId: TOWN_INSTANCE_ID },
    };

    expect(result.actions).toHaveLength(2);
    expect(result.actions).toContainEqual(waitAction);
    expect(result.actions).toContainEqual(goAction);

    // The new system should have been called
    expect(mockGetEntityIdsForScopesFn).toHaveBeenCalledWith(
      ['directions'], // from core:go action definition
      expect.any(Object), // context, which includes entityManager, actingEntity, location, etc.
      // FIX: Expect any object that looks like a logger, not the specific mock instance.
      // The line above is now incorrect. We expect the mockScopeRegistry and then the mockLogger.
      mockScopeRegistry, // scopeRegistry is the 3rd argument
      expect.objectContaining({ // Expect an object with logger methods
        debug: expect.any(Function),
        info: expect.any(Function),
        warn: expect.any(Function),
        error: expect.any(Function),
      })
    );

    // Assert that the validation and formatting functions were called with the correct, modern context
    const expectedGoTargetContext =
      ActionTargetContext.forEntity(TOWN_INSTANCE_ID);

    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreGoActionDefinition,
      mockHeroEntity,
      expectedGoTargetContext
    );

    // FIX: The call from ActionDiscoveryService only has 5 arguments. The 6th (formatterMap) is a default
    // inside formatActionCommand and is not passed explicitly. The assertion must match the actual call.
    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreGoActionDefinition,
      expectedGoTargetContext,
      mockEntityManager,
      expect.any(Object), // formatterOptions
      expect.any(Function) // getEntityDisplayNameFn
      // The 6th argument `expect.any(Object)` for formatterMap is removed.
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${HERO_INSTANCE_ID}. Found 2 actions.`
      )
    );
  });
});
