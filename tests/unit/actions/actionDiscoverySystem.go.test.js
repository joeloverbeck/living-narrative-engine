// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

// --- Action Definitions ---
import coreGoActionDefinition from '../../../data/mods/core/actions/go.action.json';
import coreWaitActionDefinition from '../../../data/mods/core/actions/wait.action.json';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

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
// FIX: Create a mock for the new dependency
const mockPrereqService = {
  evaluate: jest.fn(),
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
const mockTargetResolutionService = {
  resolveTargets: jest.fn(),
};
const mockFormatActionCommandFn = jest.fn();

describe('ActionDiscoveryService - Go Action (Fixed State)', () => {
  let actionDiscoveryService;

  const HERO_INSTANCE_ID = 'hero-instance-uuid-integration-1';
  const GUILD_INSTANCE_ID = 'guild-instance-uuid-integration-1';
  const TOWN_INSTANCE_ID = 'town-instance-uuid-integration-1';

  const createTestEntity = (instanceId, components = {}) => ({
    id: instanceId,
    components: components,
    getComponentData: (id) => components[id] || null,
  });

  const heroEntityInitialComponents = {
    [POSITION_COMPONENT_ID]: { locationId: GUILD_INSTANCE_ID },
  };

  const adventurersGuildComponents = {
    [EXITS_COMPONENT_ID]: [{ direction: 'out', target: TOWN_INSTANCE_ID }],
  };

  let mockHeroEntity;
  let mockActionIndex;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHeroEntity = createTestEntity(
      HERO_INSTANCE_ID,
      heroEntityInitialComponents
    );
    const mockAdventurersGuildLocation = createTestEntity(
      GUILD_INSTANCE_ID,
      adventurersGuildComponents
    );
    const mockTownLocation = createTestEntity(TOWN_INSTANCE_ID, {});

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

    mockEntityManager.getComponentData.mockImplementation(
      (entityId, compId) => {
        if (entityId === HERO_INSTANCE_ID && compId === POSITION_COMPONENT_ID) {
          return { locationId: GUILD_INSTANCE_ID };
        }
        return null;
      }
    );

    mockTargetResolutionService.resolveTargets.mockImplementation(async (scopeName) => {
      if (scopeName === 'core:clear_directions') {
        return [{ type: 'entity', entityId: TOWN_INSTANCE_ID }];
      }
      if (scopeName === 'none') {
        return [{ type: 'none', entityId: null }];
      }
      return [];
    });

    // FIX: Default prerequisite checks to pass for this test
    mockPrereqService.evaluate.mockReturnValue(true);

    mockFormatActionCommandFn.mockImplementation((actionDef) => {
      if (actionDef.id === 'core:wait') return { ok: true, value: 'wait' };
      if (actionDef.id === 'core:go') return { ok: true, value: 'go to The Town' };
      return { ok: false, error: 'invalid' };
    });

    mockActionIndex = {
      getCandidateActions: jest
        .fn()
        .mockImplementation(() => mockGameDataRepo.getAllActionDefinitions()),
    };

    // FIX: Add the new prerequisiteEvaluationService dependency and targetResolutionService
    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      prerequisiteEvaluationService: mockPrereqService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      safeEventDispatcher: mockSafeEventDispatcher,
      targetResolutionService: mockTargetResolutionService,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      actionIndex: mockActionIndex,
    });
  });

  it('should discover "go to The Town" action when player is in adventurers guild and scope resolves an exit', async () => {
    const result = await actionDiscoveryService.getValidActions(
      mockHeroEntity,
      { jsonLogicEval: {} }
    );

    expect(result.errors).toEqual([]);
    expect(result.actions).toBeDefined();

    // FIX: Corrected params for 'none' scope actions
    const waitAction = {
      id: 'core:wait',
      name: 'Wait',
      command: 'wait',
      description: 'Wait for a moment, doing nothing.',
      params: { targetId: null },
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

    expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith('core:clear_directions', mockHeroEntity, expect.anything(), null);
    expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith('none', mockHeroEntity, expect.anything(), null);

    const expectedGoTargetContext =
      ActionTargetContext.forEntity(TOWN_INSTANCE_ID);

    // FIX: Assert that prerequisiteEvaluationService.evaluate is called, not actionValidationService.isValid
    expect(mockValidationService.isValid).not.toHaveBeenCalled();
    expect(mockPrereqService.evaluate).toHaveBeenCalledWith(
      coreGoActionDefinition.prerequisites,
      coreGoActionDefinition,
      mockHeroEntity,
      null
    );

    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreGoActionDefinition,
      expectedGoTargetContext,
      expect.any(Object),
      expect.any(Object),
      expect.any(Function)
    );
  });
});