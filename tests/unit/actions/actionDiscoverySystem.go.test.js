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
// NOTE: We are no longer using jest.mock() for these. We'll create manual mocks.
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
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

// --- Mocking Setup ---
// We create manual mocks instead of using jest.mock() to have finer control.
const mockGameDataRepo = {
  getAllActionDefinitions: jest.fn(),
};
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
};
const mockValidationService = {
  isValid: jest.fn(),
};
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockSafeEventDispatcher = {
  dispatch: jest.fn(),
};
const mockScopeRegistry = {
  getScope: jest.fn(),
};
const mockScopeEngine = {
  resolve: jest.fn(),
};
const mockFormatActionCommandFn = jest.fn();

describe('ActionDiscoveryService - Go Action (Fixed State)', () => {
  let actionDiscoveryService;

  const HERO_INSTANCE_ID = 'hero-instance-uuid-integration-1';
  const GUILD_INSTANCE_ID = 'guild-instance-uuid-integration-1';
  const TOWN_INSTANCE_ID = 'town-instance-uuid-integration-1';

  // Helper function to create a simplified entity-like object for testing
  const createTestEntity = (instanceId, components = {}) => ({
    id: instanceId,
    components: components,
    getComponentData: (id) => components[id] || null,
  });

  const heroEntityInitialComponents = {
    'core:actor': {},
    'core:player': {},
    'core:name': { text: 'Hero' },
    [POSITION_COMPONENT_ID]: { locationId: GUILD_INSTANCE_ID },
  };

  const adventurersGuildComponents = {
    'core:name': { text: "Adventurers' Guild" },
    'core:description': { text: "The local adventurers' guild." },
    [EXITS_COMPONENT_ID]: [
      {
        direction: 'out to town',
        target: TOWN_INSTANCE_ID,
      },
    ],
  };

  let mockHeroEntity;
  let mockAdventurersGuildLocation;
  let mockTownLocation;
  let mockActionContext;

  beforeEach(() => {
    // Reset all manual mocks before each test
    jest.clearAllMocks();

    mockHeroEntity = createTestEntity(
      HERO_INSTANCE_ID,
      heroEntityInitialComponents
    );
    mockAdventurersGuildLocation = createTestEntity(
      GUILD_INSTANCE_ID,
      adventurersGuildComponents
    );
    mockTownLocation = createTestEntity(TOWN_INSTANCE_ID, {
      'core:name': { text: 'The Town' },
    });

    // --- Configure Mocks for the Test Scenario ---
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

    // Mock the location lookup via the position component
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, compId) => {
        if (entityId === HERO_INSTANCE_ID && compId === POSITION_COMPONENT_ID) {
          return { locationId: GUILD_INSTANCE_ID };
        }
        return null;
      }
    );

    // Mock the new dependencies: scopeRegistry and scopeEngine
    mockScopeRegistry.getScope.mockImplementation((scopeName) => {
      if (scopeName === 'directions') {
        // The service needs a valid expression to parse
        return { expr: 'location.core:exits[].target' };
      }
      return null;
    });

    mockScopeEngine.resolve.mockReturnValue(new Set([TOWN_INSTANCE_ID]));

    mockValidationService.isValid.mockReturnValue(true);

    mockFormatActionCommandFn.mockImplementation((actionDef, targetContext) => {
      if (actionDef.id === 'core:wait') {
        return { ok: true, value: 'wait' };
      }
      if (actionDef.id === 'core:go') {
        // Simplified for test; real one uses getEntityDisplayName
        return { ok: true, value: 'go to The Town' };
      }
      return { ok: false, error: 'invalid' };
    });

    mockActionContext = {
      // Provide jsonLogicEval as it's needed by the service's runtime context
      jsonLogicEval: {},
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
      safeEventDispatcher: mockSafeEventDispatcher,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
    });
  });

  it('should discover "go to The Town" action when player is in adventurers guild and scope resolves an exit', async () => {
    const result = await actionDiscoveryService.getValidActions(
      mockHeroEntity,
      mockActionContext
    );

    expect(result.errors).toEqual([]);
    expect(result.actions).toBeDefined();

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

    // --- Assertions ---
    expect(result.actions).toHaveLength(2);
    expect(result.actions).toContainEqual(waitAction);
    expect(result.actions).toContainEqual(goAction);

    // Assert that the new dependencies were called
    expect(mockScopeRegistry.getScope).toHaveBeenCalledWith('directions');
    expect(mockScopeEngine.resolve).toHaveBeenCalled();

    // Assert that validation and formatting were called correctly for the GO action
    const expectedGoTargetContext =
      ActionTargetContext.forEntity(TOWN_INSTANCE_ID);

    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreGoActionDefinition,
      mockHeroEntity,
      expectedGoTargetContext
    );

    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreGoActionDefinition,
      expectedGoTargetContext,
      expect.any(Object), // entityManager
      expect.any(Object), // formatterOptions
      expect.any(Function) // getEntityDisplayNameFn
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${HERO_INSTANCE_ID}. Found 2 actions.`
      )
    );
  });
});
