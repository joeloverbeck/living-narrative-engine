/**
 * @file TestScenarioPresets - Pre-configured test scenarios for common use cases
 * @description Provides ready-to-use test module configurations for rapid test creation
 */

import { TestModuleRegistry } from '../testModuleRegistry.js';
import { TurnExecutionTestModule } from '../modules/turnExecutionTestModule.js';
import { EntityManagementTestModule } from '../modules/entityManagementTestModule.js';
import { LLMTestingModule } from '../modules/llmTestingModule.js';

/**
 * Pre-configured test scenarios for common testing needs.
 * Each preset returns a configured test module ready for further customization or immediate use.
 *
 * @example
 * // Use a preset directly
 * const testEnv = await TestScenarioPresets.combat().build();
 * @example
 * // Customize a preset
 * const testEnv = await TestScenarioPresets.exploration()
 *   .withTestActors(['explorer1', 'explorer2'])
 *   .build();
 */
export class TestScenarioPresets {
  // Initialize presets registration on class load
  static {
    TestModuleRegistry.registerPreset('combat', TestScenarioPresets.combat);
    TestModuleRegistry.registerPreset(
      'socialInteraction',
      TestScenarioPresets.socialInteraction
    );
    TestModuleRegistry.registerPreset(
      'exploration',
      TestScenarioPresets.exploration
    );
    TestModuleRegistry.registerPreset(
      'performance',
      TestScenarioPresets.performance
    );
    TestModuleRegistry.registerPreset(
      'entityManagement',
      TestScenarioPresets.entityManagement
    );
    TestModuleRegistry.registerPreset(
      'llmBehavior',
      TestScenarioPresets.llmBehavior
    );
    TestModuleRegistry.registerPreset(
      'fullIntegration',
      TestScenarioPresets.fullIntegration
    );
    TestModuleRegistry.registerPreset(
      'multiActor',
      TestScenarioPresets.multiActor
    );
    TestModuleRegistry.registerPreset('stealth', TestScenarioPresets.stealth);
    TestModuleRegistry.registerPreset(
      'errorHandling',
      TestScenarioPresets.errorHandling
    );
  }
  /**
   * Combat scenario with multiple actors and action tracking.
   * Configured for testing combat mechanics with AI fighters and observers.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured combat test module
   */
  static combat(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 0.8,
        mockResponses: {
          default: {
            actionId: 'core:attack',
            targets: { target: 'enemy' },
            reasoning: 'Engaging the enemy in combat',
            speech: 'For victory!',
          },
        },
      })
      .withTestActors([
        { id: 'ai-fighter', type: 'ai', role: 'combatant', name: 'Fighter' },
        { id: 'enemy', type: 'ai', role: 'opponent', name: 'Enemy' },
        { id: 'player', type: 'player', role: 'observer', name: 'Observer' },
      ])
      .withWorld({
        name: 'Combat Arena',
        combatEnabled: true,
        size: 'small',
        generateLocations: false,
      })
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 150, // Combat turns may be slower
          actionDiscovery: 75,
          eventProcessing: 20,
        },
      })
      .withEventCapture([
        'COMBAT_INITIATED',
        'DAMAGE_DEALT',
        'DAMAGE_RECEIVED',
        'COMBAT_ENDED',
        'AI_DECISION_MADE',
        'ACTION_EXECUTED',
      ]);
  }

  /**
   * Social interaction scenario with dialogue focus.
   * Configured for testing conversation systems and relationship mechanics.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured social interaction test module
   */
  static socialInteraction(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'json-schema',
        temperature: 1.2, // Higher temperature for more varied dialogue
        mockResponses: {
          default: {
            actionId: 'core:speak',
            targets: { content: 'Hello there!' },
            reasoning: 'Starting a friendly conversation',
            speech: 'Hello there! How can I help you today?',
            thoughts: 'This person seems friendly',
          },
        },
      })
      .withTestActors([
        { id: 'ai-npc', type: 'ai', role: 'merchant', name: 'Merchant' },
        { id: 'player', type: 'player', role: 'customer', name: 'Player' },
      ])
      .withWorld({
        name: 'Marketplace',
        socialInteractionsEnabled: true,
        size: 'medium',
        generateLocations: true,
      })
      .withEventCapture([
        'DIALOGUE_STARTED',
        'DIALOGUE_CHOICE_MADE',
        'DIALOGUE_ENDED',
        'RELATIONSHIP_CHANGED',
        'TRADE_INITIATED',
        'TRADE_COMPLETED',
        'AI_DECISION_MADE',
      ]);
  }

  /**
   * Exploration scenario with movement and discovery.
   * Configured for testing navigation, discovery mechanics, and world interaction.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured exploration test module
   */
  static exploration(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 1.0,
        mockResponses: {
          'ai-explorer': {
            actionId: 'core:move',
            targets: { direction: 'north' },
            reasoning: 'Exploring new territories',
            speech: "Let's see what lies to the north.",
            thoughts: 'I wonder what I might discover',
            notes: [
              {
                text: 'Northern path looks promising',
                subject: 'exploration',
                context: 'navigation',
                tags: ['exploration', 'movement'],
              },
            ],
          },
        },
      })
      .withTestActors([
        { id: 'ai-explorer', type: 'ai', role: 'explorer', name: 'Explorer' },
      ])
      .withWorld({
        name: 'Unknown Territory',
        size: 'large',
        generateLocations: true,
        createConnections: true,
        explorationEnabled: true,
      })
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 100,
          actionDiscovery: 50,
        },
      })
      .withEventCapture([
        'LOCATION_DISCOVERED',
        'ITEM_FOUND',
        'MOVEMENT_COMPLETED',
        'MAP_UPDATED',
        'EXPLORATION_MILESTONE',
        'AI_DECISION_MADE',
      ]);
  }

  /**
   * Performance testing scenario with minimal overhead.
   * Configured for benchmarking and performance validation with streamlined setup.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured performance test module
   */
  static performance(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        fastMode: true,
        temperature: 0.7,
        mockResponses: {
          default: {
            actionId: 'core:look',
            targets: {},
          },
        },
      })
      .withTestActors([{ id: 'ai-test', type: 'ai', name: 'Test Actor' }])
      .withWorld({
        name: 'Perf Test',
        minimal: true,
        size: 'small',
        createConnections: false,
      })
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 50, // Strict performance requirements
          actionDiscovery: 25,
          eventProcessing: 5,
        },
      });
  }

  /**
   * Multi-actor scenario for testing complex interactions.
   * Configured with multiple AI actors for testing group dynamics.
   *
   * @param {number} [actorCount] - Number of AI actors to create
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured multi-actor test module
   */
  static multiActor(actorCount = 3, mockFn = null) {
    const actors = Array.from({ length: actorCount }, (_, i) => ({
      id: `ai-actor-${i}`,
      type: 'ai',
      name: `Actor ${i + 1}`,
    }));

    // Add a player actor as observer
    actors.push({
      id: 'player-observer',
      type: 'player',
      role: 'observer',
      name: 'Observer',
    });

    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 0.9,
        mockResponses: {
          default: {
            actionId: 'core:interact',
            reasoning: 'Interacting with other actors',
          },
        },
      })
      .withTestActors(actors)
      .withWorld({
        name: 'Multi-Actor Test Environment',
        size: 'medium',
        createConnections: true,
      })
      .withEventCapture([
        'AI_DECISION_MADE',
        'ACTION_EXECUTED',
        'ACTOR_INTERACTION',
        'GROUP_FORMED',
        'GROUP_DISBANDED',
      ]);
  }

  /**
   * Stealth scenario for testing visibility and detection mechanics.
   * Configured for testing stealth gameplay and detection systems.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured stealth test module
   */
  static stealth(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 0.6, // Lower temperature for more calculated decisions
        mockResponses: {
          'ai-infiltrator': {
            actionId: 'core:sneak',
            targets: { direction: 'shadows' },
            reasoning: 'Moving quietly to avoid detection',
            thoughts: 'Must remain unseen',
          },
          'ai-guard': {
            actionId: 'core:patrol',
            targets: { route: 'perimeter' },
            reasoning: 'Maintaining watch for intruders',
            thoughts: 'Everything seems quiet... too quiet',
          },
        },
      })
      .withTestActors([
        {
          id: 'ai-infiltrator',
          type: 'ai',
          role: 'stealth',
          name: 'Infiltrator',
        },
        { id: 'ai-guard', type: 'ai', role: 'guard', name: 'Guard' },
        { id: 'player', type: 'player', role: 'observer', name: 'Observer' },
      ])
      .withWorld({
        name: 'Secure Facility',
        stealthEnabled: true,
        visibilitySystem: true,
        size: 'medium',
      })
      .withEventCapture([
        'STEALTH_ENTERED',
        'STEALTH_BROKEN',
        'DETECTION_ATTEMPTED',
        'DETECTION_SUCCESSFUL',
        'ALARM_RAISED',
        'VISIBILITY_CHANGED',
      ]);
  }

  /**
   * Error handling scenario for testing failure cases.
   * Configured to test error conditions and recovery mechanisms.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured error handling test module
   */
  static errorHandling(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 1.0,
        mockResponses: {
          'ai-error-test': {
            actionId: 'invalid:action', // Intentionally invalid
            targets: { invalid: 'target' },
            reasoning: 'Testing error handling',
          },
        },
      })
      .withTestActors([
        { id: 'ai-error-test', type: 'ai', name: 'Error Test Actor' },
      ])
      .withWorld({
        name: 'Error Test World',
        minimal: true,
      })
      .withEventCapture([
        'ERROR_OCCURRED',
        'VALIDATION_FAILED',
        'ACTION_FAILED',
        'RECOVERY_ATTEMPTED',
        'RECOVERY_SUCCESSFUL',
      ]);
  }

  /**
   * Entity management scenario for testing entity lifecycle.
   * Configured for testing entity creation, updates, and relationships.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {EntityManagementTestModule} Pre-configured entity management test module
   */
  static entityManagement(mockFn = null) {
    return new EntityManagementTestModule(mockFn)
      .withEntities([
        { type: 'core:actor', id: 'player-1', name: 'Hero' },
        { type: 'core:actor', id: 'npc-merchant', name: 'Merchant' },
        { type: 'core:item', id: 'sword-legendary', name: 'Excalibur' },
        { type: 'core:item', id: 'potion-health', name: 'Health Potion' },
        { type: 'core:location', id: 'town-square', name: 'Town Square' },
      ])
      .withComponents({
        'player-1': {
          'core:health': { current: 100, max: 100 },
          'core:inventory': { items: ['sword-legendary'], capacity: 20 },
          'core:location': { locationId: 'town-square' },
        },
        'npc-merchant': {
          'core:merchant': { gold: 1000, items: ['potion-health'] },
          'core:location': { locationId: 'town-square' },
        },
        'sword-legendary': {
          'core:weapon': { damage: 50, type: 'sword', rarity: 'legendary' },
        },
        'potion-health': {
          'core:consumable': { effect: 'heal', amount: 50, uses: 1 },
        },
      })
      .withRelationships([
        { from: 'player-1', to: 'sword-legendary', type: 'owns' },
        { from: 'npc-merchant', to: 'potion-health', type: 'sells' },
        { from: 'town-square', to: 'player-1', type: 'contains' },
        { from: 'town-square', to: 'npc-merchant', type: 'contains' },
      ])
      .withEventTracking([
        'ENTITY_CREATED',
        'COMPONENT_UPDATED',
        'RELATIONSHIP_CREATED',
        'RELATIONSHIP_REMOVED',
      ]);
  }

  /**
   * LLM testing scenario for AI behavior validation.
   * Configured for testing prompt generation, response processing, and decision-making.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {LLMTestingModule} Pre-configured LLM testing module
   */
  static llmBehavior(mockFn = null) {
    return new LLMTestingModule(mockFn)
      .withStrategy('tool-calling')
      .withActors([
        { id: 'warrior', name: 'Brave Warrior', personality: 'aggressive' },
        { id: 'scholar', name: 'Wise Scholar', personality: 'cautious' },
        { id: 'rogue', name: 'Sneaky Rogue', personality: 'opportunistic' },
      ])
      .withMockResponses({
        warrior: {
          actionId: 'core:attack',
          targets: { enemy: 'nearest' },
          reasoning: 'A warrior strikes first!',
          speech: 'For honor and glory!',
        },
        scholar: {
          actionId: 'core:analyze',
          targets: { subject: 'situation' },
          reasoning: 'Knowledge before action',
          speech: 'Let me study this carefully...',
        },
        rogue: {
          actionId: 'core:hide',
          targets: { location: 'shadows' },
          reasoning: 'Better to strike from the shadows',
          speech: '*disappears into the darkness*',
        },
      })
      .withScenarios([
        {
          name: 'combat-decision',
          actor: 'warrior',
          context: { inCombat: true, enemyCount: 3 },
          expectedActions: ['attack', 'defend', 'flee'],
        },
        {
          name: 'puzzle-solving',
          actor: 'scholar',
          context: { puzzle: 'ancient riddle', complexity: 'high' },
          expectedActions: ['analyze', 'consult', 'experiment'],
        },
        {
          name: 'stealth-mission',
          actor: 'rogue',
          context: { guards: 2, lightLevel: 'dim' },
          expectedActions: ['hide', 'sneak', 'distract'],
        },
      ])
      .withTokenLimits({ input: 2000, output: 500 })
      .withParameters({ temperature: 0.8, topP: 0.9 })
      .withMonitoring({
        promptCapture: true,
        responseCapture: true,
        tokenCounting: true,
        validation: true,
      });
  }

  /**
   * Integration testing scenario combining multiple modules.
   * Configured for testing complex interactions between different systems.
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   * @returns {TurnExecutionTestModule} Pre-configured integration test module
   */
  static fullIntegration(mockFn = null) {
    return new TurnExecutionTestModule(mockFn)
      .withMockLLM({
        strategy: 'tool-calling',
        temperature: 0.9,
        mockResponses: {
          'ai-hero': {
            actionId: 'core:quest_accept',
            targets: { quest: 'dragon_slaying' },
            reasoning: 'This quest will bring great rewards',
            speech: 'I accept this noble quest!',
            notes: [
              {
                text: 'Dragon located in northern mountains',
                subject: 'quest',
                context: 'dragon_slaying',
                tags: ['quest', 'important'],
              },
            ],
          },
        },
      })
      .withTestActors([
        {
          id: 'ai-hero',
          type: 'ai',
          role: 'protagonist',
          name: 'Hero',
          components: {
            'core:quests': { active: [], completed: [] },
            'core:reputation': { fame: 100, infamy: 0 },
          },
        },
        {
          id: 'npc-questgiver',
          type: 'ai',
          role: 'questgiver',
          name: 'Village Elder',
        },
        {
          id: 'player',
          type: 'player',
          role: 'companion',
          name: 'Player',
        },
      ])
      .withWorld({
        name: 'Epic Fantasy World',
        size: 'large',
        createConnections: true,
        features: ['quests', 'reputation', 'factions'],
      })
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 200, // Complex integrations may be slower
          actionDiscovery: 100,
          eventProcessing: 30,
        },
      })
      .withEventCapture([
        'QUEST_OFFERED',
        'QUEST_ACCEPTED',
        'QUEST_COMPLETED',
        'REPUTATION_CHANGED',
        'WORLD_STATE_CHANGED',
        'AI_DECISION_MADE',
        'INTEGRATION_EVENT',
      ])
      .withCustomFacades({
        // Can override specific facades for integration testing
      });
  }

  /**
   * Private constructor to prevent instantiation
   *
   * @private
   */
  constructor() {
    throw new Error(
      'TestScenarioPresets is a static class and cannot be instantiated'
    );
  }
}
