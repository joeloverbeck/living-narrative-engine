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

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { aiTokens } from '../../../../src/dependencyInjection/tokens/tokens-ai.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';

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
    
    // Temporary directories
    this.tempDir = null;
    this.configDir = null;
    this.promptsDir = null;
    this.filesToCleanup = [];
  }

  /**
   * Initialize the test bed with all required services
   */
  async initialize() {
    // Create temporary directories
    await this.createTempDirectories();
    
    // Create test configuration files
    await this.createTestConfigFiles();
    
    // Create test prompt files
    await this.createTestPromptFiles();
    
    // Create and configure container with test paths
    this.container = new AppContainer();
    
    // Configure container with test UI elements
    configureContainer(this.container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });
    
    // Copy test config to expected location
    const expectedConfigDir = path.join(process.cwd(), 'config');
    const expectedPromptsDir = path.join(process.cwd(), 'data', 'prompts');
    
    // Ensure directories exist
    await fs.mkdir(expectedConfigDir, { recursive: true });
    await fs.mkdir(expectedPromptsDir, { recursive: true });
    
    // Copy test files to expected locations
    console.log('Copying test config from', path.join(this.configDir, 'llm-configs.json'), 'to', path.join(expectedConfigDir, 'llm-configs.json'));
    await fs.copyFile(
      path.join(this.configDir, 'llm-configs.json'),
      path.join(expectedConfigDir, 'llm-configs.json')
    );
    await fs.copyFile(
      path.join(this.configDir, 'test_api_key.txt'),
      path.join(expectedConfigDir, 'test_api_key.txt')
    );
    await fs.copyFile(
      path.join(this.promptsDir, 'corePromptText.json'),
      path.join(expectedPromptsDir, 'corePromptText.json')
    );
    
    // Track files to clean up later
    this.filesToCleanup = [
      path.join(expectedConfigDir, 'llm-configs.json'),
      path.join(expectedConfigDir, 'test_api_key.txt'),
      path.join(expectedPromptsDir, 'corePromptText.json')
    ];

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

    // Initialize all systems tagged with INITIALIZABLE (includes PromptStaticContentService)
    const systemInitializer = this.container.resolve(tokens.SystemInitializer);
    await systemInitializer.initializeAll();

    // Verify LLM adapter is operational
    const activeLlmId = await this.llmAdapter.getCurrentActiveLlmId();
    if (!activeLlmId) {
      throw new Error('LLM adapter failed to initialize with test configuration - no active LLM ID');
    }
    this.logger.debug(`Test LLM adapter initialized with active LLM: ${activeLlmId}`);

    // Set up event monitoring
    this.setupEventMonitoring();
  }

  /**
   * Clean up resources after tests
   */
  async cleanup() {
    if (this.eventSubscription) {
      this.eventSubscription();
    }
    this.events = [];
    this.testActors = {};
    this.testActions = [];
    this.testWorld = null;
    
    // Clean up environment variables
    delete process.env.TEST_API_KEY;
    
    // Clean up copied files
    if (this.filesToCleanup) {
      for (const file of this.filesToCleanup) {
        await fs.rm(file, { force: true }).catch(() => {});
      }
    }
    
    // Clean up temporary directories
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Create temporary directories for test files
   */
  async createTempDirectories() {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lne-prompt-test-'));
    this.configDir = path.join(this.tempDir, 'config');
    this.promptsDir = path.join(this.tempDir, 'data', 'prompts');
    
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.mkdir(this.promptsDir, { recursive: true });
  }

  /**
   * Create test LLM configuration file
   */
  async createTestConfigFiles() {
    const llmConfig = {
      defaultConfigId: 'test-llm-toolcalling',
      configs: {
        'test-llm-toolcalling': {
          configId: 'test-llm-toolcalling',
          displayName: 'Test LLM (Tool Calling)',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'test_api_key.txt',
          endpointUrl: 'https://test-api.com/v1/chat/completions',
          modelIdentifier: 'test-model-toolcalling',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'openrouter_tool_calling',
            toolName: 'function_call'
          },
          defaultParameters: {
            temperature: 1.0
          },
          contextTokenLimit: 8000,
          promptElements: [
            { key: 'task_definition', prefix: '<task_definition>\n', suffix: '\n</task_definition>\n' },
            { key: 'character_persona', prefix: '<character_persona>\n', suffix: '\n</character_persona>\n' },
            { key: 'perception_log_wrapper', prefix: '<perception_log>\n', suffix: '\n</perception_log>\n' },
            { key: 'thoughts_wrapper', prefix: '<thoughts>\n', suffix: '\n</thoughts>\n' },
            { key: 'notes_wrapper', prefix: '<notes>\n', suffix: '\n</notes>\n' },
            { key: 'indexed_choices', prefix: '<indexed_choices>\n', suffix: '\n</indexed_choices>\n' },
            { key: 'final_instructions', prefix: '<final_instructions>\n', suffix: '\n</final_instructions>\n' }
          ],
          promptAssemblyOrder: [
            'task_definition',
            'character_persona',
            'perception_log_wrapper',
            'thoughts_wrapper',
            'notes_wrapper',
            'indexed_choices',
            'final_instructions'
          ]
        },
        'test-llm-jsonschema': {
          configId: 'test-llm-jsonschema',
          displayName: 'Test LLM (JSON Schema)',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'test_api_key.txt',
          endpointUrl: 'https://test-api.com/v1/chat/completions',
          modelIdentifier: 'test-model-jsonschema',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'openrouter_json_schema'
          },
          defaultParameters: {
            temperature: 0.8
          },
          contextTokenLimit: 4000,
          promptElements: [
            { key: 'task_definition', prefix: '## Task\n', suffix: '\n\n' },
            { key: 'character_persona', prefix: '## Character\n', suffix: '\n\n' },
            { key: 'indexed_choices', prefix: '## Available Actions\n', suffix: '\n\n' },
            { key: 'final_instructions', prefix: '## Instructions\n', suffix: '\n' }
          ],
          promptAssemblyOrder: [
            'task_definition',
            'character_persona',
            'indexed_choices',
            'final_instructions'
          ]
        }
      }
    };
    
    await fs.writeFile(
      path.join(this.configDir, 'llm-configs.json'),
      JSON.stringify(llmConfig, null, 2)
    );
    
    // Create a test API key file
    await fs.writeFile(
      path.join(this.configDir, 'test_api_key.txt'),
      'test-api-key-12345'
    );
  }

  /**
   * Create test prompt template files
   */
  async createTestPromptFiles() {
    // Create the core prompt text JSON file that PromptTextLoader expects
    const corePromptText = {
      coreTaskDescriptionText: `You are playing the role of {actorName} in an interactive story.
Your goal is to choose an action that best fits your character's personality and the current situation.`,
      characterPortrayalGuidelinesTemplate: `Stay in character as {{name}} and make choices that align with your personality and goals.`,
      nc21ContentPolicyText: `Keep content appropriate for all audiences.`,
      finalLlmInstructionText: `Choose one action from the indexed list above by responding with a JSON object containing:
- chosenIndex: The number of your chosen action
- speech: What you say (if anything) 
- thoughts: Your character's private thoughts`
    };
    
    await fs.writeFile(
      path.join(this.promptsDir, 'corePromptText.json'),
      JSON.stringify(corePromptText, null, 2)
    );
    
    // Also create individual text files for backwards compatibility if needed
    // Task definition
    await fs.writeFile(
      path.join(this.promptsDir, 'task-definition.txt'),
      `You are playing the role of {actorName} in an interactive story.
Your goal is to choose an action that best fits your character's personality and the current situation.`
    );
    
    // Character persona
    await fs.writeFile(
      path.join(this.promptsDir, 'character-persona.txt'),
      `Name: {actorName}
Personality: {personality}
Current Location: {locationName}

You should act in character based on the personality and context provided.`
    );
    
    // Final instructions
    await fs.writeFile(
      path.join(this.promptsDir, 'final-instructions.txt'),
      `Choose one action from the indexed list above by responding with a JSON object containing:
- chosenIndex: The number of your chosen action
- speech: What you say (if anything) 
- thoughts: Your character's private thoughts`
    );
    
    // Portrayal guidelines (optional)
    await fs.writeFile(
      path.join(this.promptsDir, 'portrayal-guidelines.txt'),
      `Stay in character and make choices that align with your personality and goals.`
    );
    
    // Content policy (optional)
    await fs.writeFile(
      path.join(this.promptsDir, 'content-policy.txt'),
      `Keep content appropriate for all audiences.`
    );
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
        description: 'A cozy tavern with worn wooden tables and a roaring fireplace.',
        components: {
          'core:name': { name: 'The Rusty Tankard' },
          'core:description': { description: 'A cozy tavern with worn wooden tables and a roaring fireplace.' },
          'core:position': { x: 0, y: 0, z: 0 },
          'core:exits': {
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
          'core:name': { name: 'Market Square' },
          'core:description': { description: 'A bustling marketplace filled with vendors and shoppers.' },
          'core:position': { x: 0, y: 1, z: 0 },
          'core:exits': {
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
        description: 'A narrow alley between buildings, dimly lit and mysterious.',
        components: {
          'core:name': { name: 'Dark Alley' },
          'core:description': { description: 'A narrow alley between buildings, dimly lit and mysterious.' },
          'core:position': { x: 1, y: 0, z: 0 },
          'core:exits': {
            north: { target: null, blocked: false },
            south: { target: null, blocked: false },
            east: { target: null, blocked: false },
            west: { target: 'test-tavern', blocked: false },
          },
        },
      },
    ];

    for (const location of locations) {
      const definition = createEntityDefinition(location.id, location.components);
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
          'core:name': { name: 'Elara the Bard' },
          'core:position': { locationId: 'test-tavern' },
          'core:actor': { isPlayer: false, isAI: true },
          'core:ai': { 
            personality: 'A cheerful bard who loves telling stories and making friends.',
            goals: ['Make people happy', 'Collect interesting stories', 'Find adventure'],
            memories: ['Just arrived in town after a long journey', 'Heard rumors of treasure in the old ruins'],
          },
          'core:closeness': { relationships: {} },
          'core:following': { following: null, followers: [] },
          'core:movement': { locked: false },
          'core:perception': { 
            log: [
              { type: 'observation', content: 'The tavern is warm and inviting.' },
              { type: 'speech', content: 'The innkeeper says, "Welcome to the Rusty Tankard!"' },
              { type: 'action', content: 'A patron raises their mug in greeting.' }
            ]
          },
          'core:thoughts': {
            current: [
              { type: 'feeling', content: 'I feel welcomed in this friendly tavern.' },
              { type: 'observation', content: 'The innkeeper seems trustworthy.' }
            ]
          },
          'core:notes': {
            entries: [
              'The innkeeper mentioned something about troubles in the market.',
              'I should perform a song to lighten the mood.'
            ]
          }
        },
      },
      player: {
        id: 'test-player',
        components: {
          'core:name': { name: 'Test Player' },
          'core:position': { locationId: 'test-tavern' },
          'core:actor': { isPlayer: true, isAI: false },
          'core:closeness': { relationships: {} },
          'core:following': { following: null, followers: [] },
          'core:movement': { locked: false },
        },
      },
      npc: {
        id: 'test-innkeeper',
        components: {
          'core:name': { name: 'Gareth the Innkeeper' },
          'core:position': { locationId: 'test-tavern' },
          'core:actor': { isPlayer: false, isAI: false },
          'core:closeness': { relationships: {} },
          'core:following': { following: null, followers: [] },
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
        id: 'core:go',
        name: 'Go',
        description: 'Move to another location',
        scope: 'core:clear_directions',
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
        id: 'core:follow',
        name: 'Follow',
        description: 'Follow another character',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: [],
        required_components: { actor: ['core:following'] },
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
        actionDefinitionId: 'core:wait',
        displayName: 'Wait',
        description: 'Wait and observe your surroundings',
        scopedTargets: [],
        actionDefinition: this.testActions.find(a => a.id === 'core:wait'),
      },
      {
        actionDefinitionId: 'core:go',
        displayName: 'Go North',
        description: 'Move to Market Square',
        scopedTargets: [{ id: 'test-market', display: 'Market Square', type: 'location' }],
        actionDefinition: this.testActions.find(a => a.id === 'core:go'),
      },
      {
        actionDefinitionId: 'core:go',
        displayName: 'Go East',
        description: 'Move to Dark Alley',
        scopedTargets: [{ id: 'test-alley', display: 'Dark Alley', type: 'location' }],
        actionDefinition: this.testActions.find(a => a.id === 'core:go'),
      },
      {
        actionDefinitionId: 'core:say',
        displayName: 'Say something',
        description: 'Say something out loud',
        scopedTargets: [],
        actionDefinition: this.testActions.find(a => a.id === 'core:say'),
      },
      {
        actionDefinitionId: 'test:perform',
        displayName: 'Perform',
        description: 'Perform a song or story',
        scopedTargets: [],
        actionDefinition: this.testActions.find(a => a.id === 'test:perform'),
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

    // Remove existing perception component if it exists
    if (this.entityManager.hasComponent(actorId, 'core:perception')) {
      await this.entityManager.removeComponent(actorId, 'core:perception');
    }

    // Add the perception component with new log entries
    await this.entityManager.addComponent(actorId, 'core:perception', {
      log: logEntries
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

    await this.entityManager.updateComponent(actorId, 'core:notes', {
      entries: notes
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
      'final_instructions'
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
      { pattern: /## Character\n([\s\S]*?)(?=\n##|$)/, key: 'character_persona' },
      { pattern: /## Available Actions\n([\s\S]*?)(?=\n##|$)/, key: 'indexed_choices' },
      { pattern: /## Instructions\n([\s\S]*?)(?=\n##|$)/, key: 'final_instructions' }
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
    const choicesSection = sections.indexed_choices || sections.available_actions || '';
    
    // Match patterns like [1], [2], etc.
    const actionRegex = /\[(\d+)\]\s*([^\n\[]+)/g;
    let match;
    
    while ((match = actionRegex.exec(choicesSection)) !== null) {
      actions.push({
        index: parseInt(match[1]),
        description: match[2].trim()
      });
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
}

export default PromptGenerationTestBed;