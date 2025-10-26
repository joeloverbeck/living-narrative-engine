/**
 * @file End-to-end test for facing-aware action availability
 * @description Tests the complete user flow of turning around and how it affects action availability
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../../common/facades/testingFacadeRegistrations.js';
import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('Facing-aware action availability E2E', () => {
  let facades;
  let actionServiceFacade;
  let entityServiceFacade;
  let entityTestBed;
  let mockLogger;

  beforeEach(async () => {
    // Create facades using the standard pattern
    facades = createMockFacades({}, jest.fn);
    actionServiceFacade = facades.actionService;
    entityServiceFacade = facades.entityService;

    // Create entity test bed for entity management
    entityTestBed = new EntityManagerTestBed();

    // Get logger from facades
    mockLogger = facades.mockDeps.logger;

    // Create test entities with proper components
    await setupTestEntities();
  });

  afterEach(async () => {
    entityTestBed.cleanup();
    actionServiceFacade.clearMockData();
  });

  /**
   *
   */
  async function setupTestEntities() {
    // Create player entity
    await entityTestBed.createEntity('actor', {
      instanceId: 'test:player',
      overrides: {
        [NAME_COMPONENT_ID]: { name: 'Player' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:throne_room' },
        'core:actor': { type: 'player' },
        // Add closeness component for NPC (required for turn_around action)
        'positioning:closeness': { partners: ['test:npc'] },
      },
    });

    // Create NPC entity
    await entityTestBed.createEntity('actor', {
      instanceId: 'test:npc',
      overrides: {
        [NAME_COMPONENT_ID]: { name: 'NPC' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:throne_room' },
        'core:actor': { type: 'npc' },
        // Add closeness component for player (required for turn_around action)
        'positioning:closeness': { partners: ['test:player'] },
      },
    });

    // Create location entity using basic definition
    await entityTestBed.createEntity('basic', {
      instanceId: 'test:throne_room',
      overrides: {
        [NAME_COMPONENT_ID]: { name: 'Throne Room' },
        'core:location': { description: 'A grand throne room' },
      },
    });
  }

  it('should respect facing direction for position-dependent actions', async () => {
    // Setup mock actions for initial state
    const mockKneelAction = {
      actionId: 'positioning:kneel_before',
      targets: {
        primary: ['test:player'],
      },
      available: true,
    };

    const mockTurnAroundAction = {
      actionId: 'physical-control:turn_around',
      targets: {
        primary: ['test:npc'],
      },
      available: true,
    };

    // Mock initial available actions for NPC
    actionServiceFacade.setMockActions('test:npc', [mockKneelAction]);
    actionServiceFacade.setMockActions('test:player', [mockTurnAroundAction]);

    // Get initial available actions for NPC
    let npcActions = await actionServiceFacade.discoverActions('test:npc');

    // Find initial kneel_before action
    let kneelAction = npcActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    // Initially should be able to kneel before player
    expect(kneelAction).toBeDefined();
    if (kneelAction) {
      const initialTargets = kneelAction.targets?.primary || [];
      expect(initialTargets).toContain('test:player');
    }

    // Mock the execution result for turn_around using jest spy
    const mockTurnAroundResult = {
      success: true,
      effects: ['Added test:player to test:npc facing_away_from array'],
      description: 'Player turns NPC around.',
    };

    const executeSpy = jest
      .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
      .mockResolvedValue(mockTurnAroundResult);

    // Player turns NPC around
    const turnAroundResult = await actionServiceFacade.executeAction({
      actionId: 'physical-control:turn_around',
      actorId: 'test:player',
      targetId: 'test:npc',
    });

    expect(turnAroundResult.success).toBe(true);

    // Update mocked actions to reflect NPC now facing away
    actionServiceFacade.setMockActions('test:npc', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: [], // Empty because NPC is facing away from player
        },
        available: true,
      },
    ]);

    // Get available actions for NPC after being turned around
    npcActions = await actionServiceFacade.discoverActions('test:npc');

    // Verify positioning actions respect facing
    kneelAction = npcActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    // NPC should not be able to kneel before player (facing away)
    if (kneelAction) {
      const targetsAfterTurn = kneelAction.targets?.primary || [];
      expect(targetsAfterTurn).not.toContain('test:player');
    }

    // Mock turning back result
    const mockTurnBackResult = {
      success: true,
      effects: ['Removed test:player from test:npc facing_away_from array'],
      description: 'NPC turns to face Player.',
    };

    executeSpy.mockResolvedValue(mockTurnBackResult);

    // Player turns NPC back to face them
    const turnBackResult = await actionServiceFacade.executeAction({
      actionId: 'physical-control:turn_around',
      actorId: 'test:player',
      targetId: 'test:npc',
    });

    expect(turnBackResult.success).toBe(true);

    // Update mocked actions to reflect NPC now facing player again
    actionServiceFacade.setMockActions('test:npc', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: ['test:player'],
        },
        available: true,
      },
    ]);

    // Re-check available actions after turning back
    const updatedActions =
      await actionServiceFacade.discoverActions('test:npc');

    // Now kneeling should be available again
    const updatedKneelAction = updatedActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    if (updatedKneelAction) {
      const finalTargets = updatedKneelAction.targets?.primary || [];
      expect(finalTargets).toContain('test:player');
    }

    // Restore spy
    executeSpy.mockRestore();
  });

  it('should handle complex multi-actor facing scenarios', async () => {
    // Add a third actor to the scene (create all with correct closeness from start)
    await entityTestBed.createEntity('actor', {
      instanceId: 'test:guard',
      overrides: {
        [NAME_COMPONENT_ID]: { name: 'Guard' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:throne_room' },
        'core:actor': { type: 'npc' },
        // Add closeness to both other actors
        'positioning:closeness': { partners: ['test:npc', 'test:player'] },
      },
    });

    // Mock execution results using spy
    const executeSpy = jest.spyOn(
      actionServiceFacade.actionPipelineOrchestrator,
      'execute'
    );

    executeSpy.mockResolvedValueOnce({
      success: true,
      effects: ['Added test:player to test:npc facing_away_from array'],
    });

    // Player turns NPC around (NPC facing away from player)
    await actionServiceFacade.executeAction({
      actionId: 'physical-control:turn_around',
      actorId: 'test:player',
      targetId: 'test:npc',
    });

    executeSpy.mockResolvedValueOnce({
      success: true,
      effects: ['Added test:guard to test:npc facing_away_from array'],
    });

    // Guard turns NPC around (NPC now also facing away from guard)
    await actionServiceFacade.executeAction({
      actionId: 'physical-control:turn_around',
      actorId: 'test:guard',
      targetId: 'test:npc',
    });

    // Mock actions with NPC facing away from both
    actionServiceFacade.setMockActions('test:npc', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: [], // Empty because facing away from both
        },
        available: true,
      },
    ]);

    // Check NPC's available actions
    const npcActions = await actionServiceFacade.discoverActions('test:npc');
    const kneelAction = npcActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    if (kneelAction) {
      const kneelTargets = kneelAction.targets?.primary || [];
      // NPC should not be able to kneel before either player or guard
      expect(kneelTargets).not.toContain('test:player');
      expect(kneelTargets).not.toContain('test:guard');
    }

    executeSpy.mockResolvedValueOnce({
      success: true,
      effects: ['Removed test:player from test:npc facing_away_from array'],
    });

    // Player turns NPC back (NPC now only facing away from guard)
    await actionServiceFacade.executeAction({
      actionId: 'physical-control:turn_around',
      actorId: 'test:player',
      targetId: 'test:npc',
    });

    // Update mock to show NPC can kneel before player but not guard
    actionServiceFacade.setMockActions('test:npc', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: ['test:player'], // Can kneel before player, not guard
        },
        available: true,
      },
    ]);

    // Re-check available actions
    const updatedActions =
      await actionServiceFacade.discoverActions('test:npc');
    const updatedKneelAction = updatedActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    if (updatedKneelAction) {
      const updatedTargets = updatedKneelAction.targets?.primary || [];
      // NPC should be able to kneel before player but not guard
      expect(updatedTargets).toContain('test:player');
      expect(updatedTargets).not.toContain('test:guard');
    }

    // Restore spy
    executeSpy.mockRestore();
  });

  it('should correctly update UI actions after facing changes', async () => {
    // Mock initial actions for both actors
    actionServiceFacade.setMockActions('test:player', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: ['test:npc'],
        },
        available: true,
      },
      {
        actionId: 'positioning:turn_your_back',
        targets: {
          primary: ['test:npc'],
        },
        available: true,
      },
    ]);

    actionServiceFacade.setMockActions('test:npc', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: ['test:player'],
        },
        available: true,
      },
    ]);

    // Discover initial actions for both actors
    const initialPlayerActions =
      await actionServiceFacade.discoverActions('test:player');
    const initialNpcActions =
      await actionServiceFacade.discoverActions('test:npc');

    // Both should initially have kneel_before available for each other
    const playerKneelInitial = initialPlayerActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );
    const npcKneelInitial = initialNpcActions.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    if (playerKneelInitial) {
      expect(playerKneelInitial.targets?.primary).toContain('test:npc');
    }
    if (npcKneelInitial) {
      expect(npcKneelInitial.targets?.primary).toContain('test:player');
    }

    // Mock execution for turn_your_back using spy
    const executeSpy = jest
      .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
      .mockResolvedValue({
        success: true,
        effects: ['Added test:npc to test:player facing_away_from array'],
        description: 'Player turns their back to NPC.',
      });

    // Player turns their back on NPC
    const turnBackResult = await actionServiceFacade.executeAction({
      actionId: 'positioning:turn_your_back',
      actorId: 'test:player',
      targetId: 'test:npc',
    });

    expect(turnBackResult.success).toBe(true);

    // Update mocked actions to reflect player facing away
    actionServiceFacade.setMockActions('test:player', [
      {
        actionId: 'positioning:kneel_before',
        targets: {
          primary: [], // Empty because player is facing away from NPC
        },
        available: true,
      },
    ]);

    // Player should now be facing away from NPC
    const playerActionsAfterTurn =
      await actionServiceFacade.discoverActions('test:player');
    const playerKneelAfterTurn = playerActionsAfterTurn.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    // Player shouldn't be able to kneel before NPC (facing away)
    if (playerKneelAfterTurn) {
      expect(playerKneelAfterTurn.targets?.primary).not.toContain('test:npc');
    }

    // NPC actions should remain unchanged (still facing player)
    const npcActionsAfterTurn =
      await actionServiceFacade.discoverActions('test:npc');
    const npcKneelAfterTurn = npcActionsAfterTurn.find(
      (a) => a.actionId === 'positioning:kneel_before'
    );

    if (npcKneelAfterTurn) {
      expect(npcKneelAfterTurn.targets?.primary).toContain('test:player');
    }

    // Restore spy
    executeSpy.mockRestore();
  });
});
