/**
 * @file promptGenerationTestBed.js
 * @description Test bed for prompt generation E2E tests
 *
 * Provides a comprehensive test environment for testing the complete prompt
 * generation pipeline from AI actor decision request through final prompt assembly.
 *
 * Note: Due to the complexity of LLM configuration loading, this test bed
 * uses a simplified approach that focuses on the prompt generation components
 * without requiring actual LLM API configurations.
 */

import { jest } from '@jest/globals';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { aiTokens } from '../../../../src/dependencyInjection/tokens/tokens-ai.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import { TestConfigurationFactory } from '../../../common/testConfigurationFactory.js';

/**
 * Test bed for prompt generation pipeline testing
 *
 * This test bed creates a temporary test environment with:
 * - Test LLM configuration files
 * - Test prompt template files
 * - Test actors, world, and actions
 * - Full container with real dependencies
 */
export class PromptGenerationTestBed {
  constructor() {
    this.container = null;
    this.entityManager = null;
    this.aiPromptPipeline = null;
    this.llmAdapter = null;
    this.eventBus = null;
    this.logger = null;
    this.registry = null;
    this.scopeRegistry = null;
    this.dslParser = null;
    this.events = [];
    this.eventSubscription = null;

    // Test data
    this.testActors = {};
    this.testActions = [];
    this.testWorld = null;

    // Test configuration - cached for performance
    this.testConfiguration = null;
    this.testConfigurationCleanup = null;

    // Performance optimization: cache expensive operations
    this._schemaCache = null;
    this._configCache = null;
    this._fileCache = new Map(); // Cache file reads
    this._originalFetch = null;
  }

  /**
   * Initialize the test bed with all required services
   */
  async initialize() {
    this._installConfigFetchStub();
    // Use cached test configuration if available, otherwise create new one
    if (!this._configCache) {
      const testConfig =
        await TestConfigurationFactory.createTestConfiguration();
      this._configCache = {
        pathConfiguration: testConfig.pathConfiguration,
        cleanup: testConfig.cleanup,
      };
    }
    this.testConfiguration = this._configCache.pathConfiguration;
    this.testConfigurationCleanup = this._configCache.cleanup;

    // Create and configure container with test paths
    this.container = new AppContainer();

    // Configure container with test UI elements
    await configureContainer(this.container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Override the path configuration with our test configuration
    this.container.register(
      tokens.IPathConfiguration,
      () => this.testConfiguration,
      {
        lifecycle: 'singleton',
      }
    );

    // Create and register mock data fetcher to avoid file system access
    this.container.register(
      tokens.IDataFetcher,
      () => this.createMockDataFetcher(),
      {
        lifecycle: 'singleton',
      }
    );

    // Resolve core services
    this.entityManager = this.container.resolve(tokens.IEntityManager);
    this.eventBus = this.container.resolve(tokens.IEventBus);
    this.logger = this.container.resolve(tokens.ILogger);
    this.registry = this.container.resolve(tokens.IDataRegistry);
    this.scopeRegistry = this.container.resolve(tokens.IScopeRegistry);
    this.dslParser = this.container.resolve(tokens.DslParser);

    // Resolve AI/prompting services
    this.aiPromptPipeline = this.container.resolve(aiTokens.IAIPromptPipeline);
    this.llmAdapter = this.container.resolve(aiTokens.LLMAdapter);

    // Set test API key environment variable
    process.env.TEST_API_KEY = 'test-api-key-12345';

    // Initialize LLM adapter with our test config
    const llmConfigLoader = this.container.resolve(tokens.LlmConfigLoader);
    await this.llmAdapter.init({ llmConfigLoader });

    // Load schemas first before other services - cache for performance
    if (!this._schemaCache) {
      const schemaLoader = this.container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();

      // Manually register component schemas that we need for testing
      const schemaValidator = this.container.resolve(tokens.ISchemaValidator);

      // Register core:notes schema
      await schemaValidator.addSchema(
        {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            notes: {
              type: 'array',
              items: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      text: { type: 'string', minLength: 1 },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                    required: ['text'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      text: { type: 'string', minLength: 1 },
                      subject: { type: 'string', minLength: 1 },
                      context: { type: 'string' },
                      tags: { type: 'array', items: { type: 'string' } },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                    required: ['text', 'subject'],
                    additionalProperties: false,
                  },
                ],
              },
            },
          },
          required: ['notes'],
          additionalProperties: false,
        },
        'core:notes'
      );

      // Register core:perception_log schema
      await schemaValidator.addSchema(
        {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            logEntries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  descriptionText: { type: 'string' },
                  timestamp: { type: 'string' },
                  perceptionType: { type: 'string' },
                  actorId: { type: 'string' },
                },
                required: ['descriptionText'],
                additionalProperties: true,
              },
            },
            maxEntries: { type: 'number' },
          },
          required: ['logEntries'],
          additionalProperties: false,
        },
        'core:perception_log'
      );

      this._schemaCache = true; // Mark schemas as loaded
    }

    // Initialize all systems tagged with INITIALIZABLE (includes PromptStaticContentService)
    const systemInitializer = this.container.resolve(tokens.SystemInitializer);
    await systemInitializer.initializeAll();

    // Ensure prompt static content is initialized even if tagging changes
    const promptStaticContentService = this.container.resolve(
      aiTokens.IPromptStaticContentService
    );
    if (typeof promptStaticContentService.initialize === 'function') {
      await promptStaticContentService.initialize();
    }

    // Mock the LLM Configuration Manager to return our test LLM configurations
    const llmConfigManager = this.container.resolve(
      aiTokens.ILLMConfigurationManager
    );

    // Store reference for later use in reset
    this._llmConfigManager = llmConfigManager;

    // Create the mock implementation once
    this._llmConfigMockImpl = async (llmId) => {
      if (llmId === 'test-llm-toolcalling') {
        return {
          configId: 'test-llm-toolcalling',
          displayName: 'Test LLM (Tool Calling)',
          promptElements: [
            {
              key: 'task_definition',
              prefix: '<task_definition>\n',
              suffix: '\n</task_definition>\n',
            },
            {
              key: 'character_persona',
              prefix: '<character_persona>\n',
              suffix: '\n</character_persona>\n',
            },
            {
              key: 'world_context',
              prefix: '<world_context>\n',
              suffix: '\n</world_context>\n',
            },
            {
              key: 'perception_log_wrapper',
              prefix: '<perception_log>\n',
              suffix: '\n</perception_log>\n',
            },
            {
              key: 'perception_log_entry',
              prefix: '- ',
              suffix: '\n',
            },
            {
              key: 'thoughts_wrapper',
              prefix: '<thoughts>\n',
              suffix: '\n</thoughts>\n',
            },
            {
              key: 'thoughts_entry',
              prefix: '- ',
              suffix: '\n',
            },
            {
              key: 'notes_wrapper',
              prefix: '<notes>\n',
              suffix: '\n</notes>\n',
            },
            {
              key: 'notes_entry',
              prefix: '- ',
              suffix: '\n',
            },
            {
              key: 'goals_wrapper',
              prefix: '<goals>\n',
              suffix: '\n</goals>\n',
            },
            {
              key: 'goals_entry',
              prefix: '- ',
              suffix: '\n',
            },
            {
              key: 'indexed_choices',
              prefix: '<indexed_choices>\n',
              suffix: '\n</indexed_choices>\n',
            },
            {
              key: 'final_instructions',
              prefix: '<final_instructions>\n',
              suffix: '\n</final_instructions>\n',
            },
          ],
          promptAssemblyOrder: [
            'task_definition',
            'character_persona',
            'world_context',
            'perception_log_wrapper',
            'thoughts_wrapper',
            'notes_wrapper',
            'goals_wrapper',
            'indexed_choices',
            'final_instructions',
          ],
        };
      }
      if (llmId === 'test-llm-jsonschema') {
        return {
          configId: 'test-llm-jsonschema',
          displayName: 'Test LLM (JSON Schema)',
          promptElements: [
            {
              key: 'task_definition',
              prefix: '## Task\n',
              suffix: '\n\n',
            },
            {
              key: 'character_persona',
              prefix: '## Character\n',
              suffix: '\n\n',
            },
            {
              key: 'indexed_choices',
              prefix: '## Available Actions\n',
              suffix: '\n\n',
            },
            {
              key: 'final_instructions',
              prefix: '## Instructions\n',
              suffix: '\n\n',
            },
          ],
          promptAssemblyOrder: [
            'task_definition',
            'character_persona',
            'indexed_choices',
            'final_instructions',
          ],
        };
      }
      return null;
    };

    jest
      .spyOn(llmConfigManager, 'loadConfiguration')
      .mockImplementation(this._llmConfigMockImpl);

    // Mock the LLM adapter to return a valid LLM ID - ensure it's persistent
    if (!this.llmAdapter.getCurrentActiveLlmId._isMockFunction) {
      jest
        .spyOn(this.llmAdapter, 'getCurrentActiveLlmId')
        .mockResolvedValue('test-llm-toolcalling');
    }

    // Mock getCurrentActiveLlmConfig to return the test config - ensure it's persistent
    if (!this.llmAdapter.getCurrentActiveLlmConfig._isMockFunction) {
      jest
        .spyOn(this.llmAdapter, 'getCurrentActiveLlmConfig')
        .mockResolvedValue({
          configId: 'test-llm-toolcalling',
          displayName: 'Test LLM (Tool Calling)',
          contextTokenLimit: 8000,
          // Add other config properties as needed
        });
    }

    // Mock setActiveLlm to handle LLM switching - ensure it's persistent
    if (!this.llmAdapter.setActiveLlm._isMockFunction) {
      jest
        .spyOn(this.llmAdapter, 'setActiveLlm')
        .mockImplementation(async (llmId) => {
          // Update the mocked getCurrentActiveLlmId to return the new ID
          this.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(llmId);

          // Update getCurrentActiveLlmConfig based on the new ID
          if (llmId === 'test-llm-jsonschema') {
            this.llmAdapter.getCurrentActiveLlmConfig.mockResolvedValue({
              configId: 'test-llm-jsonschema',
              displayName: 'Test LLM (JSON Schema)',
              contextTokenLimit: 8000,
            });
          }
          return true;
        });
    }

    // Set up event monitoring
    this.setupEventMonitoring();
  }

  /**
   * Reset test state between tests without full cleanup for performance
   */
  resetTestState() {
    // Clear recorded events but keep subscriptions
    this.events = [];

    // Reset any modified actor data to original state
    // This is faster than recreating everything
    this.clearRecordedEvents();

    // Ensure LLM adapter mocks are properly restored for each test
    this._ensureLLMAdapterMocks();
  }

  /**
   * Ensure LLM adapter mocks are properly set up
   *
   * @private
   */
  _ensureLLMAdapterMocks() {
    if (!this.llmAdapter) return;

    // Restore or create the getCurrentActiveLlmId mock
    if (
      !this.llmAdapter.getCurrentActiveLlmId ||
      !this.llmAdapter.getCurrentActiveLlmId.mockResolvedValue
    ) {
      jest
        .spyOn(this.llmAdapter, 'getCurrentActiveLlmId')
        .mockResolvedValue('test-llm-toolcalling');
    } else {
      this.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(
        'test-llm-toolcalling'
      );
    }

    // Restore or create the getCurrentActiveLlmConfig mock
    if (
      !this.llmAdapter.getCurrentActiveLlmConfig ||
      !this.llmAdapter.getCurrentActiveLlmConfig.mockResolvedValue
    ) {
      jest
        .spyOn(this.llmAdapter, 'getCurrentActiveLlmConfig')
        .mockResolvedValue({
          configId: 'test-llm-toolcalling',
          displayName: 'Test LLM (Tool Calling)',
          contextTokenLimit: 8000,
        });
    } else {
      this.llmAdapter.getCurrentActiveLlmConfig.mockResolvedValue({
        configId: 'test-llm-toolcalling',
        displayName: 'Test LLM (Tool Calling)',
        contextTokenLimit: 8000,
      });
    }

    // Restore or create the setActiveLlm mock
    if (
      !this.llmAdapter.setActiveLlm ||
      !this.llmAdapter.setActiveLlm.mockImplementation
    ) {
      jest
        .spyOn(this.llmAdapter, 'setActiveLlm')
        .mockImplementation(async (llmId) => {
          this.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(llmId);
          if (llmId === 'test-llm-jsonschema') {
            this.llmAdapter.getCurrentActiveLlmConfig.mockResolvedValue({
              configId: 'test-llm-jsonschema',
              displayName: 'Test LLM (JSON Schema)',
              contextTokenLimit: 8000,
            });
          } else {
            this.llmAdapter.getCurrentActiveLlmConfig.mockResolvedValue({
              configId: 'test-llm-toolcalling',
              displayName: 'Test LLM (Tool Calling)',
              contextTokenLimit: 8000,
            });
          }
          return true;
        });
    }

    // Ensure LLMConfigurationManager mock persists
    if (this._llmConfigManager && this._llmConfigMockImpl) {
      if (
        !this._llmConfigManager.loadConfiguration ||
        !this._llmConfigManager.loadConfiguration.mockImplementation
      ) {
        jest
          .spyOn(this._llmConfigManager, 'loadConfiguration')
          .mockImplementation(this._llmConfigMockImpl);
      } else {
        this._llmConfigManager.loadConfiguration.mockImplementation(
          this._llmConfigMockImpl
        );
      }
    }
  }

  /**
   * Clean up resources after tests
   */
  async cleanup() {
    this._restoreConfigFetchStub();
    // Clean up event subscription first
    if (this.eventSubscription) {
      this.eventSubscription();
      this.eventSubscription = null;
    }

    // Clear all data structures
    this.events = [];
    this.testActors = {};
    this.testActions = [];
    this.testWorld = null;

    // Clean up environment variables
    delete process.env.TEST_API_KEY;

    // Clean up test configuration
    if (this.testConfigurationCleanup) {
      await this.testConfigurationCleanup();
    }

    this.testConfiguration = null;
    this.testConfigurationCleanup = null;

    // Clear service references to prevent cross-test contamination
    if (this.container) {
      // Clear any cached instances to prevent schema persistence
      // The container itself doesn't need explicit cleanup, but we clear references
      this.entityManager = null;
      this.aiPromptPipeline = null;
      this.llmAdapter = null;
      this.eventBus = null;
      this.logger = null;
      this.registry = null;
      this.scopeRegistry = null;
      this.dslParser = null;
      this.container = null;
    }
  }

  /**
   * Set up monitoring of all events dispatched through the system
   */
  setupEventMonitoring() {
    this.eventSubscription = this.eventBus.subscribe('*', (event) => {
      this.events.push({
        timestamp: Date.now(),
        type: event.type,
        payload: event.payload,
      });
    });
  }

  /**
   * Create a test world with locations
   */
  async createTestWorld() {
    const locations = [
      {
        id: 'test-tavern',
        name: 'The Rusty Tankard',
        description:
          'A cozy tavern with worn wooden tables and a roaring fireplace.',
        components: {
          'core:name': { text: 'The Rusty Tankard' },
          'core:description': {
            text: 'A cozy tavern with worn wooden tables and a roaring fireplace.',
          },
          'core:position': { x: 0, y: 0, z: 0 },
          'locations:exits': {
            north: { target: 'test-market', blocked: false },
            south: { target: null, blocked: false },
            east: { target: 'test-alley', blocked: false },
            west: { target: null, blocked: false },
          },
        },
      },
      {
        id: 'test-market',
        name: 'Market Square',
        description: 'A bustling marketplace filled with vendors and shoppers.',
        components: {
          'core:name': { text: 'Market Square' },
          'core:description': {
            text: 'A bustling marketplace filled with vendors and shoppers.',
          },
          'core:position': { x: 0, y: 1, z: 0 },
          'locations:exits': {
            north: { target: null, blocked: false },
            south: { target: 'test-tavern', blocked: false },
            east: { target: null, blocked: false },
            west: { target: null, blocked: false },
          },
        },
      },
      {
        id: 'test-alley',
        name: 'Dark Alley',
        description:
          'A narrow alley between buildings, dimly lit and mysterious.',
        components: {
          'core:name': { text: 'Dark Alley' },
          'core:description': {
            text: 'A narrow alley between buildings, dimly lit and mysterious.',
          },
          'core:position': { x: 1, y: 0, z: 0 },
          'locations:exits': {
            north: { target: null, blocked: false },
            south: { target: null, blocked: false },
            east: { target: null, blocked: false },
            west: { target: 'test-tavern', blocked: false },
          },
        },
      },
    ];

    for (const location of locations) {
      const definition = createEntityDefinition(
        location.id,
        location.components
      );
      this.registry.store('entityDefinitions', location.id, definition);
      await this.entityManager.createEntityInstance(location.id, {
        instanceId: location.id,
        definitionId: location.id,
      });
    }

    this.testWorld = locations;
    return locations;
  }

  /**
   * Create test actors with AI configurations
   */
  async createTestActors() {
    const actors = {
      aiActor: {
        id: 'test-ai-actor',
        components: {
          'core:name': { text: 'Elara the Bard' },
          'core:position': { locationId: 'test-tavern' },
          'core:actor': { isPlayer: false, isAI: true },
          'core:mood': {
            valence: 0,
            arousal: 0,
            agency_control: 0,
            threat: 0,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
          },
          'core:sexual_state': {
            sex_excitation: 0,
            sex_inhibition: 0,
            baseline_libido: 0,
          },
          'core:ai': {
            personality:
              'A cheerful bard who loves telling stories and making friends.',
            goals: [
              'Make people happy',
              'Collect interesting stories',
              'Find adventure',
            ],
            memories: [
              'Just arrived in town after a long journey',
              'Heard rumors of treasure in the old ruins',
            ],
          },
          'core:closeness': { relationships: {} },
          'companionship:following': { following: null, followers: [] },
          'core:movement': { locked: false },
          'core:perception_log': {
            logEntries: [
              {
                descriptionText: 'The tavern is warm and inviting.',
                timestamp: new Date().toISOString(),
                perceptionType: 'observation',
                actorId: 'test-ai-actor',
              },
              {
                descriptionText:
                  'The innkeeper says, "Welcome to the Rusty Tankard!"',
                timestamp: new Date().toISOString(),
                perceptionType: 'speech',
                actorId: 'test-innkeeper',
              },
              {
                descriptionText: 'A patron raises their mug in greeting.',
                timestamp: new Date().toISOString(),
                perceptionType: 'action',
                actorId: 'test-patron',
              },
            ],
            maxEntries: 50,
          },
          'core:short_term_memory': {
            thoughts: [
              { text: 'I feel welcomed in this friendly tavern.' },
              { text: 'The innkeeper seems trustworthy.' },
            ],
            maxEntries: 4,
          },
          'core:notes': {
            notes: [
              {
                text: 'The innkeeper mentioned something about troubles in the market.',
                subject: 'Market troubles',
              },
              {
                text: 'I should perform a song to lighten the mood.',
                subject: 'Performance plan',
              },
            ],
          },
        },
      },
      player: {
        id: 'test-player',
        components: {
          'core:name': { text: 'Test Player' },
          'core:position': { locationId: 'test-tavern' },
          'core:actor': { isPlayer: true, isAI: false },
          'core:mood': {
            valence: 0,
            arousal: 0,
            agency_control: 0,
            threat: 0,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
          },
          'core:sexual_state': {
            sex_excitation: 0,
            sex_inhibition: 0,
            baseline_libido: 0,
          },
          'core:closeness': { relationships: {} },
          'companionship:following': { following: null, followers: [] },
          'core:movement': { locked: false },
        },
      },
      npc: {
        id: 'test-innkeeper',
        components: {
          'core:name': { text: 'Gareth the Innkeeper' },
          'core:position': { locationId: 'test-tavern' },
          'core:actor': { isPlayer: false, isAI: false },
          'core:mood': {
            valence: 0,
            arousal: 0,
            agency_control: 0,
            threat: 0,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
          },
          'core:sexual_state': {
            sex_excitation: 0,
            sex_inhibition: 0,
            baseline_libido: 0,
          },
          'core:closeness': { relationships: {} },
          'companionship:following': { following: null, followers: [] },
          'core:movement': { locked: false },
        },
      },
    };

    for (const actor of Object.values(actors)) {
      const definition = createEntityDefinition(actor.id, actor.components);
      this.registry.store('entityDefinitions', actor.id, definition);
      await this.entityManager.createEntityInstance(actor.id, {
        instanceId: actor.id,
        definitionId: actor.id,
      });
    }

    this.testActors = actors;
    return actors;
  }

  /**
   * Register test actions
   */
  async registerTestActions() {
    const actions = [
      {
        id: 'core:wait',
        name: 'Wait',
        description: 'Wait and observe your surroundings',
        scope: 'none',
        template: 'wait',
        prerequisites: [],
        required_components: { actor: [] },
      },
      {
        id: 'movement:go',
        name: 'Go',
        description: 'Move to another location',
        scope: 'movement:clear_directions',
        template: 'go to {target}',
        prerequisites: [],
        required_components: { actor: ['core:position'] },
      },
      {
        id: 'core:say',
        name: 'Say',
        description: 'Say something out loud',
        scope: 'none',
        template: 'say "{message}"',
        prerequisites: [],
        required_components: { actor: [] },
      },
      {
        id: 'companionship:follow',
        name: 'Follow',
        description: 'Follow another character',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: [],
        required_components: { actor: ['companionship:following'] },
      },
      {
        id: 'test:perform',
        name: 'Perform',
        description: 'Perform a song or story',
        scope: 'none',
        template: 'perform',
        prerequisites: [],
        required_components: { actor: [] },
      },
    ];

    for (const action of actions) {
      this.registry.store('actions', action.id, action);
    }

    // Build the action index
    const actionIndex = this.container.resolve(tokens.ActionIndex);
    actionIndex.buildIndex(actions);

    this.testActions = actions;
    return actions;
  }

  /**
   * Create test action composites as they would appear to the AI
   */
  createTestActionComposites() {
    return [
      {
        index: 1,
        actionDefinitionId: 'core:wait',
        displayName: 'Wait',
        commandString: 'wait',
        description: 'Wait and observe your surroundings',
        scopedTargets: [],
        actionDefinition: this.testActions.find((a) => a.id === 'core:wait'),
      },
      {
        index: 2,
        actionDefinitionId: 'movement:go',
        displayName: 'Go North',
        commandString: 'go north',
        description: 'Move to Market Square',
        scopedTargets: [
          { id: 'test-market', display: 'Market Square', type: 'location' },
        ],
        actionDefinition: this.testActions.find((a) => a.id === 'movement:go'),
      },
      {
        index: 3,
        actionDefinitionId: 'movement:go',
        displayName: 'Go East',
        commandString: 'go east',
        description: 'Move to Dark Alley',
        scopedTargets: [
          { id: 'test-alley', display: 'Dark Alley', type: 'location' },
        ],
        actionDefinition: this.testActions.find((a) => a.id === 'movement:go'),
      },
      {
        index: 4,
        actionDefinitionId: 'core:say',
        displayName: 'Say something',
        commandString: 'say',
        description: 'Say something out loud',
        scopedTargets: [],
        actionDefinition: this.testActions.find((a) => a.id === 'core:say'),
      },
      {
        index: 5,
        actionDefinitionId: 'test:perform',
        displayName: 'Perform',
        commandString: 'perform',
        description: 'Perform a song or story',
        scopedTargets: [],
        actionDefinition: this.testActions.find((a) => a.id === 'test:perform'),
      },
    ];
  }

  /**
   * Create a test turn context
   */
  createTestTurnContext() {
    return {
      turnNumber: 1,
      timestamp: Date.now(),
      actorId: this.testActors.aiActor?.id || 'test-ai-actor',
      phase: 'action',
    };
  }

  /**
   * Generate a prompt through the complete pipeline
   *
   * @param {string} actorId - ID of the actor to generate prompt for
   * @param {object} turnContext - Turn context
   * @param {Array} availableActions - Available action composites
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(actorId, turnContext, availableActions) {
    const actor = await this.entityManager.getEntityInstance(actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    return await this.aiPromptPipeline.generatePrompt(
      actor,
      turnContext || this.createTestTurnContext(),
      availableActions || this.createTestActionComposites()
    );
  }

  /**
   * Switch to a different LLM configuration
   *
   * @param {string} configId - LLM configuration ID
   */
  async switchLLMConfig(configId) {
    await this.llmAdapter.setActiveLlm(configId);
  }

  /**
   * Get the current active LLM configuration
   */
  async getCurrentLLMConfig() {
    const configId = await this.llmAdapter.getCurrentActiveLlmId();
    const config = await this.llmAdapter.getCurrentActiveLlmConfig();
    return { configId, config };
  }

  /**
   * Update actor perception log
   *
   * @param {string} actorId - Actor ID
   * @param {Array} logEntries - New perception log entries
   */
  async updateActorPerception(actorId, logEntries) {
    const actor = await this.entityManager.getEntityInstance(actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    // Remove existing perception component if it exists as an override
    if (actor.hasComponentOverride('core:perception_log')) {
      await this.entityManager.removeComponent(actorId, 'core:perception_log');
    }

    // Add the perception component with new log entries
    await this.entityManager.addComponent(actorId, 'core:perception_log', {
      logEntries: logEntries,
      maxEntries: 50,
    });
  }

  /**
   * Update actor notes
   *
   * @param {string} actorId - Actor ID
   * @param {Array} notes - New notes
   */
  async updateActorNotes(actorId, notes) {
    const actor = await this.entityManager.getEntityInstance(actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    // Always add/update the notes component with the new data
    // This will override any existing notes from the definition
    await this.entityManager.addComponent(actorId, 'core:notes', {
      notes: notes,
    });
  }

  /**
   * Get all events of a specific type
   *
   * @param {string} eventType
   */
  getEventsByType(eventType) {
    return this.events.filter((e) => e.type === eventType);
  }

  /**
   * Clear recorded events
   */
  clearRecordedEvents() {
    this.events = [];
  }

  /**
   * Stub fetch for config files to avoid jsdom network calls.
   *
   * @private
   */
  _installConfigFetchStub() {
    if (this._originalFetch) {
      return;
    }

    const configResponses = new Map([
      ['config/trace-config.json', {}],
      ['config/emotion-display-config.json', {}],
    ]);

    this._originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const urlString = rawUrl ? String(rawUrl) : '';
      const path = (() => {
        try {
          const parsed = new URL(urlString, 'http://localhost');
          return parsed.pathname.replace(/^\//, '');
        } catch (error) {
          return urlString.replace(/^\//, '');
        }
      })();

      if (configResponses.has(path)) {
        const payload = configResponses.get(path);
        return {
          ok: true,
          status: 200,
          json: async () => payload,
        };
      }

      if (typeof this._originalFetch === 'function') {
        return this._originalFetch(input);
      }

      throw new Error(`Mock fetch: no handler for ${urlString}`);
    };
  }

  /**
   * Restore the original fetch implementation.
   *
   * @private
   */
  _restoreConfigFetchStub() {
    if (this._originalFetch) {
      globalThis.fetch = this._originalFetch;
      this._originalFetch = null;
    }
  }

  /**
   * Get entity by ID
   *
   * @param {string} entityId
   */
  async getEntity(entityId) {
    return await this.entityManager.getEntityInstance(entityId);
  }

  /**
   * Parse a generated prompt into sections
   *
   * @param {string} prompt - Generated prompt
   * @returns {object} Parsed sections
   */
  parsePromptSections(prompt) {
    const sections = {};

    // Common XML-style tags
    const tagPatterns = [
      'system_constraints',
      'task_definition',
      'character_persona',
      'portrayal_guidelines',
      'content_policy',
      'world_context',
      'perception_log',
      'thoughts',
      'notes',
      'goals',
      'indexed_choices',
      'available_actions_info',
      'user_input',
      'final_instructions', // Backward compatibility
    ];

    for (const tag of tagPatterns) {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = prompt.match(regex);
      if (match) {
        sections[tag] = match[1].trim();
      }
    }

    // Also check for markdown-style headers
    const markdownPatterns = [
      { pattern: /## Task\n([\s\S]*?)(?=\n##|$)/, key: 'task_definition' },
      {
        pattern: /## Character\n([\s\S]*?)(?=\n##|$)/,
        key: 'character_persona',
      },
      {
        pattern: /## Available Actions\n([\s\S]*?)(?=\n##|$)/,
        key: 'indexed_choices',
      },
      {
        pattern: /## Instructions\n([\s\S]*?)(?=\n##|$)/,
        key: 'final_instructions',
      },
    ];

    for (const { pattern, key } of markdownPatterns) {
      const match = prompt.match(pattern);
      if (match && !sections[key]) {
        sections[key] = match[1].trim();
      }
    }

    return sections;
  }

  /**
   * Extract indexed actions from prompt
   *
   * @param {string} prompt - Generated prompt
   * @returns {Array} Indexed actions
   */
  extractIndexedActions(prompt) {
    const actions = [];
    const sections = this.parsePromptSections(prompt);
    const choicesSection =
      sections.indexed_choices ||
      sections.available_actions ||
      sections.available_actions_info ||
      '';

    // Match patterns like [1], [2], [Index: 1], and "index: 1 --> Action (description)"
    const actionRegex =
      /(?:\[(?:Index:\s*)?(\d+)\]\s*([^\n\[]+)|index:\s*(\d+)\s*-->\s*([^\n(]+)(?:\s*\(([^)]+)\))?)/gi;
    let match;

    while ((match = actionRegex.exec(choicesSection)) !== null) {
      if (match[1] && match[2]) {
        // Old format: [1] Action
        actions.push({
          index: parseInt(match[1]),
          description: match[2].trim(),
        });
      } else if (match[3]) {
        // New format: index: 1 --> Action (description)
        const command = match[4] ? match[4].trim() : '';
        const description = match[5] ? match[5].trim() : command;
        actions.push({
          index: parseInt(match[3]),
          description: description,
        });
      }
    }

    return actions;
  }

  /**
   * Count tokens in a prompt (simplified estimation)
   *
   * @param {string} prompt - Generated prompt
   * @returns {number} Estimated token count
   */
  estimateTokenCount(prompt) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Create a mock data fetcher that returns test data instead of loading from files
   * Performance optimized to minimize file system calls
   *
   * @returns {object} Mock data fetcher
   */
  createMockDataFetcher() {
    const fileCache = this._fileCache; // Reference to instance cache

    // Cache mock data to avoid recreating strings on each call
    if (!this._mockDataCache) {
      this._mockDataCache = {
        promptText: {
          coreTaskDescriptionText:
            "Your sole focus is to BE the character detailed below. Live as them, think as them.\nYour task is to:\n1.  Decide on one action for your character to perform this turn.\n2.  Determine what, if anything, your character will say in conjunction with that action.\nBase your decisions on your character's complete persona (including their deepest traits and flaws), the current situation, recent events, and the specific actions available to you.",
          characterPortrayalGuidelinesTemplate:
            "BEING {{name}}:\n-   Full Embodiment: You are {{name}}. All responses MUST come from a first-person perspective, fully embodying their personality, memories, emotions, desires, motivations, and mannerisms as described in their profile.\n-   Embrace All Traits: Authentically portray all facets of {{name}}'s persona, including virtues, vices, strengths, weaknesses, fears, biases, and any morally ambiguous or challenging aspects (e.g., tendencies towards violence, deception, cruelty, prejudice, selfishness, etc., if part of their defined character). Do not shy away from portraying these traits if the situation calls for it. Your portrayal should be deep, consistent, and unflinching.\n-   Speech Style: If {{name}} speaks, their dialogue should be vivid and distinctive. Capture their unique speech patterns and tone. Dialogue should feel natural and impactful, not generic.\n-   Action Tag Rules **(CRITICAL)**:\n    • Wrap only *visible, externally observable actions* in single asterisks – e.g., *crosses arms*, *narrows her eyes*.\n    • The asterisk block must contain **no internal thoughts, emotions, private reasoning, or hidden information**. If it can't be seen or heard by other characters, it does **not** belong between asterisks.\n    • Use third-person present tense inside the asterisks.\n-   No AI Persona: CRITICAL: You are NOT an AI assistant. Stay in character. No meta-commentary, apologies for controversial content, or references to being a language model. You are {{name}}.",
          nc21ContentPolicyText:
            "CONTENT GUIDELINES:\nRATING: NC-21 (ADULTS ONLY)\nNO RESTRICTIONS: This is a mature application. All topics, themes, and content are permissible if they serve the character's authentic portrayal and the unfolding narrative, however dark, explicit, or controversial.\nThis includes, but is not limited to:\n-   Explicit language and profanity.\n-   Graphic violence and gore (physical and psychological).\n-   Sexual themes, including explicit descriptions and non-consensual scenarios (if consistent with character/plot).\n-   Substance use and abuse.\n-   Challenging moral and ethical dilemmas.\n-   Prejudice, discrimination, and other 'isms' if they are part of the character or world.\nYour primary directive is authentic character portrayal and storytelling within this mature context. Do not self-censor or inject conventional AI safety moralizing.",
          finalLlmInstructionText:
            '<inner_state_integration>\n\nINNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)\n\nYour character\'s <inner_state> is a PRIMARY DRIVER.\nYou MUST route it through the character\'s unique persona (voice, defenses, worldview, habits of attention).\nDo NOT output generic emotion prose. Make it sound like THIS character.\n\nFail condition: any turn where thoughts/action/speech could be swapped to a different inner_state with minimal edits.\n\nSTATE INTEGRATION PROTOCOL (do this BEFORE writing; do not print this protocol):\n1) Choose DRIVERS from <inner_state>:\n   - Primary: strongest intensity emotion (dominates)\n   - Secondary: second-strongest (shapes tone)\n   - Modifier: one additional listed emotion OR sexual_state effect (adds distortion/avoidance)\n2) Translate those drivers through persona:\n   - Use the character\'s typical metaphors, vocabulary, and defense style.\n   - Let persona determine HOW the emotion shows (e.g., sarcasm, precision, withdrawal, aggression, ritual, avoidance).\n3) Let the drivers decide:\n   - Attention (what details are noticed first)\n   - Action impulse (what feels "right")\n   - Speech texture (pace, sharpness, warmth/harshness)\n   - What counts as "critical" for Notes (still facts-only).\n\nPER-FIELD STATE SIGNAL MINIMUMS (must satisfy all):\n- thoughts: MUST clearly reflect Primary + Secondary AND at least one concrete effect (attention bias, threat scanning, bodily aversion, compulsive counting, etc.). No generic "I\'m sad" narration.\n- action: MUST be plausible under Primary emotion. If you pick an action that contradicts Primary, you MUST justify the contradiction inside thoughts as resistance/denial/refusal (in persona voice).\n- speech: If non-empty, it MUST be colored by Primary/Secondary (rhythm + word choice). If speech is empty, thoughts + action MUST carry stronger state signal.\n- notes: Still facts-only, but state can affect which facts are prioritized as survival/prosperity relevant. Never write feelings in notes unless recording a genuine, new, critical state shift.\n\nSEXUAL STATE RULE (applies even if no sexual content is present):\nSexual state changes comfort distance, gaze, bodily awareness, and avoidance. High repulsion/inhibition should suppress flirtation/intimacy and bias toward withdrawal, irritation, or physical self-protection.\n\nCONFLICT RULE (persona vs state):\nIf persona would hide vulnerability, show that as deflection (brittle humor, contempt, procedural thinking, silence, refusal), not as neat self-awareness. The emotion still leaks; it just leaks in-character.\n\n</inner_state_integration>\n\nSPEECH CONTENT RULE (CRITICAL):\n- Do NOT recap or summarize prior dialogue. Your speech should advance the scene with a new contribution.\n- Only restate prior dialogue if absolutely necessary for in-character clarification or if another character explicitly requests a recap.\n- If a recap is unavoidable, keep it to one short clause and move on.\n\nTHOUGHTS COLORING:\n- The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning.\n\nACTION SELECTION:\n- Let emotions guide which action "feels right" in character:\n  • High threat/fear → Defensive, cautious, or escape-oriented actions\n  • High agency/confidence → Bold, assertive, confrontational actions\n  • Low engagement/boredom → Actions to change situation or withdraw\n  • High sexual arousal + low inhibition → May favor intimate or flirtatious actions\n  • High sexual inhibition → Avoid intimate actions even if attracted\n\nINTENSITY SCALING (use emotional intensity labels as guides):\n- "faint/slight" → Subtle undertone, barely perceptible in outputs\n- "mild/noticeable" → Clearly present but not dominant\n- "moderate/strong" → Central influence on speech, thoughts, and choices\n- "intense/powerful/overwhelming" → DOMINANT influence, hard to act against\n\nACTION VARIETY GUIDANCE:\n- Review the perception log to see your recent actions\n- Avoid repeating the same action unless there\'s a compelling in-character reason (explain in thoughts if necessary)\n- Repetitive behavior suggests being stuck - act with intentionality and variety\n\nNOTES RULES\n- Only record brand-new, critical facts (locations, allies, threats, etc.) that may determine your survival, well-being, or prosperity.\n- No internal musings, only hard data.\n- Each note MUST identify its subject (who/what the note is about)\n- Each note MUST include a subjectType from: entity, event, plan, knowledge, state, other\n- Include context when relevant (where/when observed)\n- Format: 1-3 sentences, max 60 words, in character voice.\n\nNOTE SUBJECT TYPES (Select ONE per note):\n\n1. entity - Describing who/what/where\n   Use when: Recording information about people, places, things, creatures, organizations\n   Examples: "Registrar Copperplate", "The Crown and Quill tavern", "enchanted lute"\n\n2. event - Describing past occurrences\n   Use when: Recording things that already happened\n   Examples: "Bertram offered job posting", "Fight broke out at bar"\n\n3. plan - Describing future intentions\n   Use when: Recording what you intend to do (not yet executed)\n   Examples: "Will investigate the sewers tomorrow", "Planning to perform at festival"\n\n4. knowledge - Information, theories, observations\n   Use when: Recording what you know, noticed, or theorize\n   Examples: "Copperplate keeps secrets", "Town guard changes at midnight"\n\n5. state - Mental/emotional/psychological conditions\n   Use when: Describing feelings or complex mental states\n   Examples: "Feeling increasingly feral", "Conflicted about artistic integrity"\n\n6. other - Anything not clearly fitting above\n   Use when: Uncertain or abstract concepts\n\nPRIORITY GUIDELINES:\n- HIGH: Character secrets, survival plans, critical deadlines → Always record\n- MEDIUM: Behavioral patterns, theories, relationships → Record if significant\n- LOW: Routine events, common knowledge → OMIT unless exceptional\n\nCRITICAL DISTINCTION - THOUGHTS vs SPEECH:\n\n\'thoughts\': Your character\'s INTERNAL mental process - what they think privately, reasoning they DON\'T voice aloud, unexpressed reactions, hidden motivations, silent observations, or mental commentary. This is ONLY for you (the character) - other characters CANNOT hear this.\n\n\'speech\': What your character SAYS OUT LOUD - dialogue that other characters can actually hear. This becomes visible and audible to everyone present.\n\nMANDATORY RULE: The \'thoughts\' and \'speech\' fields MUST contain meaningfully different content. You are STRICTLY PROHIBITED from copying, paraphrasing, or barely rewording the same content between these two fields.\n\nVALID PATTERNS:\n[GOOD] thoughts: "This fool has no idea I\'m lying. Keep the facade calm."\n       speech: "Of course I\'ll help you with that."\n\n[GOOD] thoughts: "Why does everyone assume I\'m incompetent? I\'ve trained for this."\n       speech: *says nothing* (empty string is valid)\n\n[GOOD] thoughts: "No time to waste overthinking this."\n       speech: "We need to move. Now."\n\nINVALID PATTERNS (NEVER DO THIS):\n[BAD] thoughts: "I don\'t trust him at all"\n      speech: "I don\'t trust you at all"\n\n[BAD] thoughts: "We should leave immediately before it\'s too late"\n      speech: "We should leave immediately before it\'s too late"\n\n[BAD] thoughts: "This seems like a bad idea to me"\n      speech: "This seems like a bad idea"\n\nNow, based on all the information provided, decide on your character\'s action and what they will say. Remember: *only visible actions go inside asterisks - never internal thoughts.* Fully BE the character.',
          actionTagRulesContent:
            'ACTION TAG RULES:\n- Wrap only *visible, externally observable actions* in single asterisks.\n- The asterisk block must contain NO internal thoughts, emotions, private reasoning, or hidden information.\n- Use third-person present tense inside asterisks (e.g., *crosses arms*, *narrows her eyes*).\n- If it cannot be seen or heard by other characters, it does NOT belong between asterisks.',
          moodUpdateOnlyInstructionText:
            'MOOD UPDATE ONLY:\n- Update the character\'s emotional state based on recent events and current context.\n- Focus on how the moment changes feelings, not on action selection.\n- Keep the update concise and grounded in observable circumstances.',
          moodUpdateTaskDefinitionText:
            'MOOD UPDATE TASK:\n1. Update the character\'s emotional state based on recent events.\n2. Keep the update concise and focused on observable circumstances.',
          moodUpdatePortrayalGuidelinesTemplate:
            'BEING {{name}} (MOOD UPDATE):\n- Stay in first-person.\n- Describe feelings in a grounded, specific way.\n- Avoid action selection or dialogue.',
        },
      };
    }

    // Use centralized test configuration factory instead of inline configs
    const mockLlmConfig = {
      defaultConfigId: 'test-llm-toolcalling',
      configs: {
        'test-llm-toolcalling': TestConfigurationFactory.createLLMConfig(
          'tool-calling',
          {
            // Override API type and JSON output strategy for this test bed
            apiType: 'openai',
            jsonOutputStrategy: {
              method: 'native_json',
            },
            // Override with custom prompt elements specific to this test bed
            promptElements: [
              {
                key: 'task_definition',
                prefix: '<task_definition>\n',
                suffix: '\n</task_definition>\n',
              },
              {
                key: 'character_persona',
                prefix: '<character_persona>\n',
                suffix: '\n</character_persona>\n',
              },
              {
                key: 'world_context',
                prefix: '<world_context>\n',
                suffix: '\n</world_context>\n',
              },
              {
                key: 'perception_log_wrapper',
                prefix: '<perception_log>\n',
                suffix: '\n</perception_log>\n',
              },
              {
                key: 'thoughts_wrapper',
                prefix: '<thoughts>\n',
                suffix: '\n</thoughts>\n',
              },
              {
                key: 'indexed_choices',
                prefix: '<indexed_choices>\n',
                suffix: '\n</indexed_choices>\n',
              },
              {
                key: 'final_instructions',
                prefix: '<final_instructions>\n',
                suffix: '\n</final_instructions>\n',
              },
            ],
            promptAssemblyOrder: [
              'task_definition',
              'character_persona',
              'world_context',
              'perception_log_wrapper',
              'thoughts_wrapper',
              'indexed_choices',
              'final_instructions',
            ],
          }
        ),
        'test-llm-jsonschema': TestConfigurationFactory.createLLMConfig(
          'json-schema',
          {
            // Override API type and JSON output strategy for this test bed
            apiType: 'openai',
            jsonOutputStrategy: {
              method: 'native_json',
            },
            // Override with simplified prompt elements for JSON schema strategy
            promptElements: [
              { key: 'task_definition', prefix: '## Task\n', suffix: '\n\n' },
              {
                key: 'character_persona',
                prefix: '## Character\n',
                suffix: '\n\n',
              },
              {
                key: 'indexed_choices',
                prefix: '## Available Actions\n',
                suffix: '\n\n',
              },
              {
                key: 'final_instructions',
                prefix: '## Instructions\n',
                suffix: '\n\n',
              },
            ],
            promptAssemblyOrder: [
              'task_definition',
              'character_persona',
              'indexed_choices',
              'final_instructions',
            ],
          }
        ),
      },
    };

    const mockDataCache = this._mockDataCache;

    // Create mock data fetcher
    return {
      async fetch(identifier) {
        // Check cache first for performance
        if (fileCache.has(identifier)) {
          return fileCache.get(identifier);
        }

        // Return appropriate test data based on the file path
        if (identifier.includes('corePromptText.json')) {
          return mockDataCache.promptText; // Return cached prompt text
        } else if (identifier.includes('llm-configs.json')) {
          return mockLlmConfig; // Return the object directly, not JSON string
        } else if (identifier.includes('test_api_key.txt')) {
          return 'test-api-key-12345';
        } else if (identifier.includes('game.json')) {
          return { mods: ['core'] }; // Minimal game config for testing
        } else if (identifier.includes('mod-manifest.json')) {
          // Return the core mod manifest
          const fs = require('fs');
          const path = require('path');
          const manifestPath = path.join(
            process.cwd(),
            'data',
            'mods',
            'core',
            'mod-manifest.json'
          );
          try {
            const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            fileCache.set(identifier, data); // Cache the result
            return data;
          } catch (error) {
            // Return minimal manifest if file doesn't exist
            const fallback = {
              id: 'core',
              version: '1.0.0',
              name: 'Core Mod',
              description: 'Core game content',
              author: 'Test',
              dependencies: [],
            };
            fileCache.set(identifier, fallback); // Cache the fallback
            return fallback;
          }
        } else if (identifier.includes('.schema.json')) {
          // For schema files, load the actual schema from the file system
          // This is safe because schemas are not dynamically generated
          const fs = require('fs');
          const path = require('path');

          // Extract schema filename from the path
          const schemaName = path.basename(identifier);
          const schemaPath = path.join(
            process.cwd(),
            'data',
            'schemas',
            schemaName
          );

          try {
            const data = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
            fileCache.set(identifier, data); // Cache the result
            return data;
          } catch (error) {
            // If schema file doesn't exist, return a minimal valid schema
            const fallback = {
              $schema: 'http://json-schema.org/draft-07/schema#',
              $id: `schema://living-narrative-engine/${schemaName}`,
              type: 'object',
              additionalProperties: true,
            };
            fileCache.set(identifier, fallback); // Cache the fallback
            return fallback;
          }
        } else if (
          identifier.includes('components/') &&
          identifier.includes('.component.json')
        ) {
          // Handle component files from mod directories
          const fs = require('fs');
          const path = require('path');

          // Parse the mod path to get the actual file location
          // Example: data/mods/core/components/notes.component.json
          const pathMatch = identifier.match(
            /data\/mods\/([^\/]+)\/components\/(.+\.component\.json)$/
          );
          if (pathMatch) {
            const modId = pathMatch[1];
            const componentFile = pathMatch[2];
            const componentPath = path.join(
              process.cwd(),
              'data',
              'mods',
              modId,
              'components',
              componentFile
            );

            try {
              const data = JSON.parse(fs.readFileSync(componentPath, 'utf8'));
              fileCache.set(identifier, data); // Cache the result
              return data;
            } catch (error) {
              // Return a minimal component schema if file doesn't exist
              const componentName = componentFile.replace(
                '.component.json',
                ''
              );
              const fallback = {
                $schema:
                  'schema://living-narrative-engine/component.schema.json',
                id: `${modId}:${componentName}`,
                description: `Test component ${componentName}`,
                dataSchema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  type: 'object',
                  additionalProperties: true,
                },
              };
              fileCache.set(identifier, fallback); // Cache the fallback
              return fallback;
            }
          }
        } else if (
          identifier.includes('data/mods/') &&
          !identifier.includes('.schema.json')
        ) {
          // Handle other mod files (actions, entities, rules, etc.)
          const fs = require('fs');
          const path = require('path');

          // For now, just try to read the actual file
          const filePath = path.join(process.cwd(), identifier);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            fileCache.set(identifier, data); // Cache the result
            return data;
          } catch (error) {
            // Return empty array for directories that might not have content
            if (
              identifier.includes('/actions/') ||
              identifier.includes('/entities/') ||
              identifier.includes('/rules/')
            ) {
              const fallback = [];
              fileCache.set(identifier, fallback); // Cache the fallback
              return fallback;
            }
            // For other files, throw the error
            throw error;
          }
        }

        // Default fallback
        throw new Error(`Mock data fetcher: Unknown identifier ${identifier}`);
      },
    };
  }
}

export default PromptGenerationTestBed;
