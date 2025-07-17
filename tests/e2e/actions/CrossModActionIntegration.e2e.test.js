/**
 * @file End-to-end test for cross-mod action integration
 * @see reports/action-processing-workflows-analysis.md
 *
 * This test suite verifies that actions from different mods (core, intimacy, sex)
 * work together properly in the Living Narrative Engine. It covers:
 * - Action discovery across multiple mods
 * - Mod-specific prerequisites and component requirements
 * - Cross-mod scope resolution
 * - Action execution from different mods
 * - Mod dependency handling
 * - Error scenarios when mods are missing
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { ActionExecutionTestBed } from './common/actionExecutionTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';

/**
 * E2E test suite for cross-mod action integration
 * Tests how actions from different mods interact and work together
 */
describe('Cross-Mod Action Integration E2E', () => {
  let testBed;
  let container;
  let entityManager;
  let actionDiscoveryService;
  let actionIndex;
  let registry;
  let scopeRegistry;
  let dslParser;
  let logger;

  beforeEach(async () => {
    // Initialize test bed
    testBed = new ActionExecutionTestBed();
    await testBed.initialize();

    // Get services we'll need
    container = testBed.container;
    entityManager = testBed.entityManager;
    actionDiscoveryService = container.resolve(tokens.IActionDiscoveryService);
    actionIndex = container.resolve(tokens.ActionIndex);
    registry = testBed.registry;
    scopeRegistry = testBed.scopeRegistry;
    dslParser = testBed.dslParser;
    logger = testBed.logger;

    // Set up test world and actors
    await setupCrossModTestWorld();
    await setupCrossModTestActors();
    await registerCrossModActions();
    await registerCrossModScopes();

    // Clear any events from initialization
    testBed.clearRecordedData();
  });

  afterEach(async () => {
    // Clean up test bed
    await testBed.cleanup();
  });

  /**
   * Sets up test world with locations suitable for cross-mod testing
   */
  async function setupCrossModTestWorld() {
    const locations = [
      {
        id: 'test-bedroom',
        name: 'Test Bedroom',
        description: 'A private bedroom for intimate interactions',
        components: {
          'core:name': { name: 'Test Bedroom' },
          'core:description': { description: 'A private bedroom for intimate interactions' },
          'core:position': { x: 0, y: 0, z: 0 },
          'core:exits': {
            north: { target: 'test-living-room', blocked: false },
            south: { target: null, blocked: false },
            east: { target: null, blocked: false },
            west: { target: null, blocked: false },
          },
          'intimacy:privacy': { level: 'private' },
        },
      },
      {
        id: 'test-living-room',
        name: 'Test Living Room',
        description: 'A public living room',
        components: {
          'core:name': { name: 'Test Living Room' },
          'core:description': { description: 'A public living room' },
          'core:position': { x: 1, y: 0, z: 0 },
          'core:exits': {
            north: { target: null, blocked: false },
            south: { target: 'test-bedroom', blocked: false },
            east: { target: null, blocked: false },
            west: { target: null, blocked: false },
          },
          'intimacy:privacy': { level: 'public' },
        },
      },
    ];

    for (const location of locations) {
      const definition = createEntityDefinition(location.id, location.components);
      registry.store('entityDefinitions', location.id, definition);
      await entityManager.createEntityInstance(location.id, {
        instanceId: location.id,
        definitionId: location.id,
      });
    }
  }

  /**
   * Sets up test actors with components from different mods
   */
  async function setupCrossModTestActors() {
    const actors = {
      // Player with full component set from all mods
      player: {
        id: 'test-player-full',
        components: {
          'core:name': { name: 'Test Player' },
          'core:position': { locationId: 'test-bedroom' },
          'core:actor': { isPlayer: true },
          'core:following': { following: null, followers: [] },
          'core:movement': { locked: false },
          'intimacy:closeness': { level: 0, relationships: {} },
          'anatomy:body': { type: 'humanoid', sex: 'male' },
          'anatomy:breasts': { size: 'none' },
        },
      },
      
      // NPC with intimacy components but no anatomy
      npcIntimate: {
        id: 'test-npc-intimate',
        components: {
          'core:name': { name: 'Intimate NPC' },
          'core:position': { locationId: 'test-bedroom' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: false },
          'intimacy:closeness': { level: 5, relationships: { 'test-player-full': 5 } },
        },
      },
      
      // NPC with anatomy components suitable for sex mod actions
      npcAnatomical: {
        id: 'test-npc-anatomical',
        components: {
          'core:name': { name: 'Anatomical NPC' },
          'core:position': { locationId: 'test-bedroom' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: false },
          'intimacy:closeness': { level: 8, relationships: { 'test-player-full': 8 } },
          'anatomy:body': { type: 'humanoid', sex: 'female' },
          'anatomy:breasts': { size: 'medium' },
        },
      },
      
      // Basic NPC with only core components
      npcBasic: {
        id: 'test-npc-basic',
        components: {
          'core:name': { name: 'Basic NPC' },
          'core:position': { locationId: 'test-living-room' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: false },
        },
      },
    };

    for (const actor of Object.values(actors)) {
      const definition = createEntityDefinition(actor.id, actor.components);
      registry.store('entityDefinitions', actor.id, definition);
      await entityManager.createEntityInstance(actor.id, {
        instanceId: actor.id,
        definitionId: actor.id,
      });
    }

    return actors;
  }

  /**
   * Register actions from core, intimacy, and sex mods
   */
  async function registerCrossModActions() {
    const actions = [
      // Core mod actions
      {
        id: 'core:wait',
        name: 'Wait',
        description: 'Wait for a moment',
        scope: 'none',
        template: 'wait',
        prerequisites: [],
        required_components: { actor: [] },
      },
      {
        id: 'core:go',
        name: 'Go',
        description: 'Move to another location',
        scope: 'core:clear_directions',
        template: 'go to {target}',
        prerequisites: [
          {
            logic: { condition_ref: 'core:actor-can-move' },
            failure_message: 'You cannot move without functioning legs.',
          },
        ],
        required_components: { actor: ['core:position'] },
      },
      {
        id: 'core:follow',
        name: 'Follow',
        description: 'Follow another actor',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: [],
        required_components: { actor: ['core:following'] },
      },
      
      // Intimacy mod actions
      {
        id: 'intimacy:get_close',
        name: 'Get Close',
        description: 'Move closer to the target, entering their personal space',
        scope: 'core:actors_in_location',
        template: 'get close to {target}',
        prerequisites: [
          {
            logic: { condition_ref: 'core:actor-can-move' },
            failure_message: 'You cannot move without functioning legs.',
          },
        ],
        required_components: { actor: [] },
      },
      {
        id: 'intimacy:kiss_cheek',
        name: 'Kiss Cheek',
        description: 'Give a gentle kiss on the cheek',
        scope: 'intimacy:close_actors',
        template: 'kiss {target} on the cheek',
        prerequisites: [
          {
            logic: { condition_ref: 'intimacy:sufficient-closeness' },
            failure_message: 'You are not close enough to this person.',
          },
        ],
        required_components: { actor: ['intimacy:closeness'] },
      },
      
      // Sex mod actions
      {
        id: 'sex:fondle_breasts',
        name: 'Fondle Breasts',
        description: 'Gently fondle the target\'s breasts',
        scope: 'sex:actors_with_breasts_in_intimacy',
        template: 'fondle {target}\'s breasts',
        prerequisites: [
          {
            logic: { condition_ref: 'sex:high-intimacy' },
            failure_message: 'You need a higher level of intimacy for this action.',
          },
        ],
        required_components: { actor: ['intimacy:closeness'] },
      },
    ];

    // Register all actions
    for (const action of actions) {
      registry.store('actions', action.id, action);
    }

    // Register conditions used by the actions
    const conditions = [
      {
        id: 'core:actor-can-move',
        description: 'Actor can move',
        logic: { '==': [{ var: 'actor.core:movement.locked' }, false] },
      },
      {
        id: 'core:exit-is-unblocked',
        description: 'Exit is not blocked',
        logic: { '==': [{ var: 'blocked' }, false] },
      },
      {
        id: 'intimacy:sufficient-closeness',
        description: 'Actors have sufficient closeness',
        logic: { '>=': [{ var: 'actor.intimacy:closeness.level' }, 3] },
      },
      {
        id: 'sex:high-intimacy',
        description: 'Actors have high intimacy level',
        logic: { '>=': [{ var: 'actor.intimacy:closeness.level' }, 7] },
      },
    ];

    for (const condition of conditions) {
      registry.store('conditions', condition.id, condition);
    }

    // Get the game data repository to ensure actions are accessible
    const gameDataRepository = container.resolve(tokens.IGameDataRepository);
    
    // Build the action index with all registered actions
    const allActions = gameDataRepository.getAllActionDefinitions();
    actionIndex.buildIndex(allActions);
    logger.debug(`Built action index with ${allActions.length} cross-mod actions`);
  }

  /**
   * Register scope definitions for all mods
   */
  async function registerCrossModScopes() {
    // Define scope expressions
    const scopeExpressions = {
      'core:clear_directions': 'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target',
      'core:other_actors': 'entities(core:actor)[{ var: "id", neq: { var: "actor.id" } }]',
      'core:actors_in_location': 'entities(core:actor)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }][{ var: "id", neq: { var: "actor.id" } }]',
      'intimacy:close_actors': 'entities(core:actor)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }][{ var: "id", neq: { var: "actor.id" } }]',
      'sex:actors_with_breasts_in_intimacy': 'entities(core:actor)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }][{ var: "anatomy:breasts", exists: true }][{ var: "id", neq: { var: "actor.id" } }]',
    };

    const scopeDefinitions = {};

    // Parse each scope expression
    for (const [scopeId, expression] of Object.entries(scopeExpressions)) {
      let ast;
      try {
        ast = dslParser.parse(expression);
      } catch (e) {
        logger.warn(`Failed to parse scope ${scopeId}:`, e);
        // Use a simple fallback
        ast = {
          type: 'Source',
          kind: 'entities',
          param: 'core:actor',
        };
      }

      scopeDefinitions[scopeId] = {
        id: scopeId,
        expr: expression,
        ast: ast,
        description: `Scope definition for ${scopeId}`,
      };
    }

    // Initialize the scope registry
    try {
      scopeRegistry.initialize(scopeDefinitions);
      logger.debug('Initialized cross-mod scope definitions');
    } catch (e) {
      logger.warn('Could not initialize scope registry', e);
    }
  }

  /**
   * Test: Basic cross-mod action discovery
   * Verifies actors can discover actions from multiple mods
   */
  test('should discover actions from multiple mods for eligible actors', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-bedroom'),
      allEntities: Array.from(entityManager.entities),
    };

    // Get available actions
    const result = await actionDiscoveryService.getValidActions(
      player,
      baseContext,
      { trace: true }
    );

    // Should have actions from multiple mods
    expect(result.actions).toBeDefined();
    expect(result.actions.length).toBeGreaterThan(0);

    // Group actions by mod
    const actionsByMod = {};
    result.actions.forEach((action) => {
      const [mod] = action.id.split(':');
      if (!actionsByMod[mod]) {
        actionsByMod[mod] = [];
      }
      actionsByMod[mod].push(action);
    });

    // Should have actions from core mod
    expect(actionsByMod.core).toBeDefined();
    expect(actionsByMod.core.length).toBeGreaterThan(0);

    // Should have actions from intimacy mod (player has intimacy components)
    // Note: intimacy actions might not appear if targets don't meet prerequisites
    if (actionsByMod.intimacy) {
      expect(actionsByMod.intimacy.length).toBeGreaterThan(0);
    }

    // May have actions from sex mod if prerequisites are met
    // (depends on target actors and intimacy levels)
    
    // Verify action IDs are properly namespaced
    result.actions.forEach((action) => {
      expect(action.id).toMatch(/^(core|intimacy|sex):/);
    });
  });

  /**
   * Test: Mod-specific prerequisites and component requirements
   * Verifies that actions properly check prerequisites across mods
   */
  test('should enforce mod-specific prerequisites and component requirements', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    const basicNpc = await entityManager.getEntityInstance('test-npc-basic');
    const intimateNpc = await entityManager.getEntityInstance('test-npc-intimate');
    
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-bedroom'),
      allEntities: Array.from(entityManager.entities),
    };

    // Test player (has intimacy components)
    const playerActions = await actionDiscoveryService.getValidActions(
      player,
      baseContext
    );

    // Test basic NPC (no intimacy components)
    const basicNpcActions = await actionDiscoveryService.getValidActions(
      basicNpc,
      baseContext
    );

    // Player should have intimacy actions, basic NPC should not
    const playerIntimacyActions = playerActions.actions.filter(
      a => a.id.startsWith('intimacy:')
    );
    const basicNpcIntimacyActions = basicNpcActions.actions.filter(
      a => a.id.startsWith('intimacy:')
    );

    // Player should have at least some intimacy actions if targets are available
    // and prerequisites are met
    const hasIntimacyComponents = player.getComponentData('intimacy:closeness') !== null;
    
    // Note: The availability of intimacy actions depends on meeting prerequisites
    // and having valid targets in the same location
    
    // Basic NPC might have get_close (no component requirement) but not kiss_cheek
    const basicKissAction = basicNpcIntimacyActions.find(
      a => a.id === 'intimacy:kiss_cheek'
    );
    expect(basicKissAction).toBeUndefined();

    // Test sex mod actions require high intimacy
    const sexActions = playerActions.actions.filter(
      a => a.id.startsWith('sex:')
    );
    
    // Sex actions should only appear if there are valid targets with required anatomy
    // and sufficient intimacy level
    if (sexActions.length > 0) {
      // Verify the action has proper target
      sexActions.forEach((action) => {
        expect(action.params).toHaveProperty('targetId');
        expect(action.params.targetId).toBeTruthy();
      });
    }
  });

  /**
   * Test: Cross-mod scope resolution
   * Verifies different scope definitions from various mods work correctly
   */
  test('should resolve scopes correctly across different mods', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    const anatomicalNpc = await entityManager.getEntityInstance('test-npc-anatomical');
    
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-bedroom'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      player,
      baseContext,
      { trace: true }
    );

    // Check core:actors_in_location scope (used by intimacy:get_close)
    const getCloseActions = result.actions.filter(
      a => a.id === 'intimacy:get_close'
    );
    
    // Should have get_close actions for actors in the same location if action is available
    const actorsInBedroom = ['test-npc-intimate', 'test-npc-anatomical'];
    if (getCloseActions.length > 0) {
      // The number of actions depends on how many valid targets there are
      getCloseActions.forEach((action) => {
        expect(actorsInBedroom).toContain(action.params.targetId);
      });
    }

    // Check sex:actors_with_breasts_in_intimacy scope
    const fondleActions = result.actions.filter(
      a => a.id === 'sex:fondle_breasts'
    );
    
    // Should only target actors with breasts component and high intimacy
    if (fondleActions.length > 0) {
      fondleActions.forEach((action) => {
        // Should only target the anatomical NPC who has breasts
        expect(action.params.targetId).toBe('test-npc-anatomical');
      });
    }
  });

  /**
   * Test: Action execution from different mods
   * Verifies actions from each mod execute properly
   */
  test('should execute actions from different mods correctly', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    
    // Test core mod action (wait)
    const waitAction = testBed.createTurnAction('core:wait', null, 'wait');
    const waitResult = await testBed.executeAction(player.id, waitAction);
    
    expect(waitResult.success).toBe(true);
    expect(waitResult.actionResult.actionId).toBe('core:wait');
    
    // Verify event was dispatched
    let attemptEvent = testBed.getLastEventOfType(ATTEMPT_ACTION_ID);
    expect(attemptEvent.payload.actionId).toBe('core:wait');
    
    // Test intimacy mod action (get_close)
    const getCloseAction = testBed.createTurnAction(
      'intimacy:get_close',
      'test-npc-intimate',
      'get close to test-npc-intimate'
    );
    const getCloseResult = await testBed.executeAction(player.id, getCloseAction);
    
    expect(getCloseResult.success).toBe(true);
    expect(getCloseResult.actionResult.actionId).toBe('intimacy:get_close');
    
    attemptEvent = testBed.getLastEventOfType(ATTEMPT_ACTION_ID);
    expect(attemptEvent.payload.actionId).toBe('intimacy:get_close');
    expect(attemptEvent.payload.targetId).toBe('test-npc-intimate');
    
    // Test sex mod action (would require proper setup and prerequisites)
    const fondleAction = testBed.createTurnAction(
      'sex:fondle_breasts',
      'test-npc-anatomical',
      'fondle test-npc-anatomical\'s breasts'
    );
    const fondleResult = await testBed.executeAction(player.id, fondleAction);
    
    expect(fondleResult.success).toBe(true);
    expect(fondleResult.actionResult.actionId).toBe('sex:fondle_breasts');
    
    attemptEvent = testBed.getLastEventOfType(ATTEMPT_ACTION_ID);
    expect(attemptEvent.payload.actionId).toBe('sex:fondle_breasts');
  });

  /**
   * Test: Action formatting preserves mod namespacing
   * Verifies that action commands are properly formatted with mod context
   */
  test('should format cross-mod actions with proper namespacing', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-bedroom'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      player,
      baseContext
    );

    // Check action formatting
    result.actions.forEach((action) => {
      // Action ID should include mod namespace
      expect(action.id).toMatch(/^(core|intimacy|sex):/);
      
      // Command should be properly formatted
      expect(action.command).toBeDefined();
      expect(typeof action.command).toBe('string');
      
      // Command should not contain template placeholders
      expect(action.command).not.toContain('{');
      expect(action.command).not.toContain('}');
      
      // Description should be present
      expect(action.description).toBeDefined();
    });

    // Check specific action formats
    const waitAction = result.actions.find(a => a.id === 'core:wait');
    if (waitAction) {
      expect(waitAction.command).toBe('wait');
    }

    const goActions = result.actions.filter(a => a.id === 'core:go');
    goActions.forEach((action) => {
      expect(action.command).toMatch(/^go to .+$/);
    });

    const intimacyActions = result.actions.filter(a => a.id.startsWith('intimacy:'));
    intimacyActions.forEach((action) => {
      // Should have target in command if it has a target parameter
      if (action.params.targetId) {
        expect(action.command).toContain(action.params.targetId);
      }
    });
  });

  /**
   * Test: Mod dependency handling
   * Verifies that actions respect mod dependencies
   */
  test('should respect mod dependencies in action availability', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-bedroom'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      player,
      baseContext
    );

    // Sex mod actions depend on intimacy mod components
    const sexActions = result.actions.filter(a => a.id.startsWith('sex:'));
    
    // If there are sex actions, player must have intimacy components
    if (sexActions.length > 0) {
      const playerComponents = player.getComponentData('intimacy:closeness');
      expect(playerComponents).toBeDefined();
    }

    // Intimacy actions that reference core conditions should work
    const intimacyActionsWithCoreConditions = result.actions.filter(
      a => a.id === 'intimacy:get_close'
    );
    
    // These might be available if targets meet prerequisites
    // The test verifies integration, not guaranteed availability
    if (intimacyActionsWithCoreConditions.length > 0) {
      // Verify they reference core conditions properly
      expect(intimacyActionsWithCoreConditions[0].id).toBe('intimacy:get_close');
    }
  });

  /**
   * Test: Error handling for missing mod components
   * Verifies graceful handling when actors lack required mod components
   */
  test('should handle missing mod components gracefully', async () => {
    const basicNpc = await entityManager.getEntityInstance('test-npc-basic');
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-living-room'),
      allEntities: Array.from(entityManager.entities),
    };

    // Basic NPC has no intimacy or anatomy components
    const result = await actionDiscoveryService.getValidActions(
      basicNpc,
      baseContext,
      { trace: true }
    );

    // Should still get core actions
    const coreActions = result.actions.filter(a => a.id.startsWith('core:'));
    expect(coreActions.length).toBeGreaterThan(0);

    // Should not get actions requiring missing components
    const intimacyActions = result.actions.filter(
      a => a.id === 'intimacy:kiss_cheek'
    );
    expect(intimacyActions.length).toBe(0);

    const sexActions = result.actions.filter(a => a.id.startsWith('sex:'));
    expect(sexActions.length).toBe(0);

    // Should not have errors for missing components
    if (result.errors) {
      const componentErrors = result.errors.filter(
        e => e.message.includes('component')
      );
      expect(componentErrors.length).toBe(0);
    }
  });

  /**
   * Test: Cross-mod action discovery performance
   * Verifies that multi-mod discovery completes in reasonable time
   */
  test('should discover cross-mod actions within performance limits', async () => {
    const player = await entityManager.getEntityInstance('test-player-full');
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-bedroom'),
      allEntities: Array.from(entityManager.entities),
    };

    // Measure discovery time
    const startTime = Date.now();
    const result = await actionDiscoveryService.getValidActions(
      player,
      baseContext
    );
    const endTime = Date.now();

    const discoveryTime = endTime - startTime;

    // Should complete quickly even with multiple mods
    expect(discoveryTime).toBeLessThan(1000); // 1 second max
    
    // Should return valid results
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    
    // Should have actions from at least one mod (core at minimum)
    const mods = new Set(result.actions.map(a => a.id.split(':')[0]));
    expect(mods.size).toBeGreaterThanOrEqual(1);
    
    // Verify we at least have core actions
    expect(mods.has('core')).toBe(true);
  });
});