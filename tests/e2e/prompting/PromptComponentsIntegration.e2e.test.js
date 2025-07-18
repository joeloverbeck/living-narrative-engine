/**
 * @file End-to-end test for prompt generation components integration
 * @see reports/llm-prompt-workflow-analysis.md
 *
 * This test suite covers the integration of prompt generation components
 * without requiring a fully initialized LLM adapter:
 * - PromptBuilder component assembly
 * - Prompt element assemblers (perception log, thoughts, notes, etc.)
 * - Placeholder resolution
 * - Static content loading
 * - Game state building
 * - Action indexing
 * 
 * Note: This is a focused E2E test that validates the core prompt generation
 * components work together correctly, without testing the full LLM pipeline.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { aiTokens } from '../../../src/dependencyInjection/tokens/tokens-ai.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';

describe('Prompt Generation Components Integration E2E', () => {
  let container;
  let promptBuilder;
  let gameStateProvider;
  let promptContentProvider;
  let entityManager;
  let registry;
  let testActor;
  let testLocation;

  beforeEach(async () => {
    // Create and configure container
    container = new AppContainer();
    configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Resolve services we'll test
    promptBuilder = container.resolve(aiTokens.IPromptBuilder);
    gameStateProvider = container.resolve(aiTokens.IAIGameStateProvider);
    promptContentProvider = container.resolve(aiTokens.IAIPromptContentProvider);
    entityManager = container.resolve(tokens.IEntityManager);
    registry = container.resolve(tokens.IDataRegistry);

    // Create test entities
    await createTestEntities();
  });

  afterEach(() => {
    // Cleanup
    testActor = null;
    testLocation = null;
  });

  /**
   *
   */
  async function createTestEntities() {
    // Create test location
    const locationDef = createEntityDefinition('test-location', {
      'core:name': { name: 'Test Tavern' },
      'core:description': { description: 'A cozy tavern.' },
    });
    registry.store('entityDefinitions', 'test-location', locationDef);
    testLocation = await entityManager.createEntityInstance('test-location', {
      instanceId: 'test-location',
      definitionId: 'test-location',
    });

    // Create test actor
    const actorDef = createEntityDefinition('test-actor', {
      'core:name': { name: 'Test Actor' },
      'core:position': { locationId: 'test-location' },
      'core:actor': { isPlayer: false, isAI: true },
      'core:ai': {
        personality: 'A friendly test character.',
        goals: ['Test goals'],
      },
      'core:perception': {
        log: [
          { type: 'observation', content: 'I see a tavern.' },
          { type: 'speech', content: 'Someone says hello.' },
        ],
      },
      'core:thoughts': {
        current: [
          { type: 'feeling', content: 'I feel good.' },
        ],
      },
      'core:notes': {
        entries: ['Remember to test things.'],
      },
    });
    registry.store('entityDefinitions', 'test-actor', actorDef);
    testActor = await entityManager.createEntityInstance('test-actor', {
      instanceId: 'test-actor',
      definitionId: 'test-actor',
    });
  }

  /**
   * Test: Game state building integration
   * Verifies the AIGameStateProvider correctly builds game state from entities
   */
  test('should build game state from actor and context', async () => {
    // Arrange
    const logger = container.resolve(tokens.ILogger);
    const context = { turnNumber: 1, phase: 'action' };

    // Act
    const gameState = await gameStateProvider.buildGameState(
      testActor,
      context,
      logger
    );

    // Assert
    expect(gameState).toBeDefined();
    expect(gameState.actor).toBeDefined();
    expect(gameState.actor.name).toBe('Test Actor');
    expect(gameState.actor.personality).toBe('A friendly test character.');
    expect(gameState.actor.location).toBe('Test Tavern');
    expect(gameState.world).toBeDefined();
    expect(gameState.world.currentLocation).toBeDefined();
  });

  /**
   * Test: Prompt content provider integration
   * Verifies the AIPromptContentProvider gathers all necessary data
   */
  test('should gather prompt content data', async () => {
    // Arrange
    const logger = container.resolve(tokens.ILogger);
    const context = { turnNumber: 1, phase: 'action' };
    const gameState = await gameStateProvider.buildGameState(
      testActor,
      context,
      logger
    );
    const availableActions = [
      {
        actionDefinitionId: 'test:wait',
        displayName: 'Wait',
        description: 'Wait and observe',
        scopedTargets: [],
      },
      {
        actionDefinitionId: 'test:go',
        displayName: 'Go North',
        description: 'Move north',
        scopedTargets: [],
      },
    ];

    // Act
    const promptData = await promptContentProvider.getPromptData(
      testActor,
      context,
      gameState,
      availableActions,
      logger
    );

    // Assert
    expect(promptData).toBeDefined();
    expect(promptData.actorName).toBe('Test Actor');
    expect(promptData.locationName).toBe('Test Tavern');
    expect(promptData.personality).toBe('A friendly test character.');
    expect(promptData.perceptionLog).toBeDefined();
    expect(promptData.perceptionLog.length).toBe(2);
    expect(promptData.thoughts).toBeDefined();
    expect(promptData.notes).toBeDefined();
    expect(promptData.availableActions).toBeDefined();
    expect(promptData.availableActions.length).toBe(2);
  });

  /**
   * Test: Prompt builder with mock LLM config
   * Verifies the PromptBuilder can assemble prompts given a configuration
   */
  test('should build prompt with proper element assembly', async () => {
    // Arrange
    const mockLlmId = 'test-llm';
    const mockLlmConfig = {
      promptElements: [
        { key: 'task_definition', prefix: '<task>\n', suffix: '\n</task>\n' },
        { key: 'character_persona', prefix: '<character>\n', suffix: '\n</character>\n' },
        { key: 'perception_log_wrapper', prefix: '<perception>\n', suffix: '\n</perception>\n' },
        { key: 'indexed_choices', prefix: '<actions>\n', suffix: '\n</actions>\n' },
      ],
      promptAssemblyOrder: [
        'task_definition',
        'character_persona',
        'perception_log_wrapper',
        'indexed_choices',
      ],
    };

    // Mock the LLM config manager to return our test config
    const llmConfigManager = container.resolve(aiTokens.LlmConfigManager);
    jest.spyOn(llmConfigManager, 'getConfig').mockResolvedValue(mockLlmConfig);

    const logger = container.resolve(tokens.ILogger);
    const context = { turnNumber: 1, phase: 'action' };
    const gameState = await gameStateProvider.buildGameState(
      testActor,
      context,
      logger
    );
    const availableActions = [
      {
        actionDefinitionId: 'test:wait',
        displayName: 'Wait',
        description: 'Wait and observe',
        scopedTargets: [],
      },
    ];
    const promptData = await promptContentProvider.getPromptData(
      testActor,
      context,
      gameState,
      availableActions,
      logger
    );

    // Act
    const prompt = await promptBuilder.build(mockLlmId, promptData);

    // Assert
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    
    // Check for expected sections
    expect(prompt).toContain('<task>');
    expect(prompt).toContain('</task>');
    expect(prompt).toContain('<character>');
    expect(prompt).toContain('</character>');
    expect(prompt).toContain('<perception>');
    expect(prompt).toContain('</perception>');
    expect(prompt).toContain('<actions>');
    expect(prompt).toContain('</actions>');

    // Check content
    expect(prompt).toContain('Test Actor'); // Actor name should be resolved
    expect(prompt).toContain('Test Tavern'); // Location name should be resolved
    expect(prompt).toContain('[1]'); // Action should be indexed
  });

  /**
   * Test: Perception log assembly
   * Verifies perception log entries are correctly formatted
   */
  test('should correctly assemble perception log entries', async () => {
    // Arrange
    const perceptionLogAssembler = container.resolve(aiTokens.PerceptionLogAssembler);
    const promptData = {
      perceptionLog: [
        { type: 'observation', content: 'The room is dimly lit.' },
        { type: 'speech', content: 'Guard: "Halt! Who goes there?"' },
        { type: 'action', content: 'The merchant counts his coins.' },
      ],
    };
    const elementDef = {
      key: 'perception_log_entry',
      prefix: '<entry type="{type}">\n',
      suffix: '\n</entry>\n',
    };

    // Act - Call with correct parameters: elementConfig, promptData, placeholderResolver, allPromptElementsMap
    const placeholderResolver = container.resolve(aiTokens.PlaceholderResolver);
    const allPromptElementsMap = new Map([
      ['perception_log_entry', {
        key: 'perception_log_entry',
        prefix: '<entry type="{type}">\n',
        suffix: '\n</entry>\n',
      }]
    ]);
    const assembled = perceptionLogAssembler.assemble(
      { key: 'perception_log_wrapper', prefix: '<perception_log>\n', suffix: '\n</perception_log>' },
      { perceptionLogArray: promptData.perceptionLog },
      placeholderResolver,
      allPromptElementsMap
    );

    // Assert
    expect(assembled).toBeDefined();
    expect(assembled).toContain('<entry type="observation">');
    expect(assembled).toContain('The room is dimly lit.');
    expect(assembled).toContain('<entry type="speech">');
    expect(assembled).toContain('Guard: "Halt! Who goes there?"');
    expect(assembled).toContain('<entry type="action">');
    expect(assembled).toContain('The merchant counts his coins.');
  });

  /**
   * Test: Action indexing
   * Verifies actions are properly indexed in the prompt
   */
  test('should correctly index available actions', async () => {
    // Arrange
    const indexedChoicesAssembler = container.resolve(aiTokens.IndexedChoicesAssembler);
    const promptData = {
      availableActions: [
        { displayName: 'Wait', description: 'Wait and observe' },
        { displayName: 'Go North', description: 'Move to the market' },
        { displayName: 'Talk to Innkeeper', description: 'Start a conversation' },
      ],
    };

    // Act
    const placeholderResolver = container.resolve(aiTokens.PlaceholderResolver);
    const assembled = indexedChoicesAssembler.assemble(
      { key: 'indexed_choices' },
      { indexedChoicesArray: promptData.availableActions.map((action, index) => ({
        index: index + 1,
        commandString: action.displayName,
        description: action.description
      })) },
      placeholderResolver
    );

    // Assert
    expect(assembled).toBeDefined();
    expect(assembled).toContain('[1] Wait');
    expect(assembled).toContain('[2] Go North');
    expect(assembled).toContain('[3] Talk to Innkeeper');
    expect(assembled).toContain('Wait and observe');
    expect(assembled).toContain('Move to the market');
    expect(assembled).toContain('Start a conversation');
  });

  /**
   * Test: Placeholder resolution
   * Verifies placeholders are correctly replaced in content
   */
  test('should resolve placeholders in static content', async () => {
    // Arrange
    const placeholderResolver = container.resolve(aiTokens.PlaceholderResolver);
    const content = 'Hello {actorName}, you are in {locationName}. Your goal is {goal}.';
    const data = {
      actorName: 'Elara',
      locationName: 'The Silver Dragon Inn',
      goal: 'to find the lost artifact',
    };

    // Act
    const resolved = placeholderResolver.resolve(content, data);

    // Assert
    expect(resolved).toBe('Hello Elara, you are in The Silver Dragon Inn. Your goal is to find the lost artifact.');
  });

  /**
   * Test: Notes section conditional inclusion
   * Verifies notes are included when present
   */
  test('should conditionally include notes section', async () => {
    // Arrange
    const notesSectionAssembler = container.resolve(aiTokens.NotesSectionAssembler);
    const promptDataWithNotes = {
      notes: ['Remember the password', 'Check the basement'],
    };
    const promptDataWithoutNotes = {
      notes: [],
    };

    // Act
    const placeholderResolver = container.resolve(aiTokens.PlaceholderResolver);
    const withNotes = notesSectionAssembler.assemble(
      { key: 'notes_wrapper' },
      { notesArray: promptDataWithNotes.notes.map(note => ({ text: note })) },
      placeholderResolver
    );
    const withoutNotes = notesSectionAssembler.assemble(
      { key: 'notes_wrapper' },
      { notesArray: [] },
      placeholderResolver
    );

    // Assert
    expect(withNotes).toContain('Remember the password');
    expect(withNotes).toContain('Check the basement');
    expect(withoutNotes).toBe(''); // Empty when no notes
  });

  /**
   * Test: Thoughts section assembly
   * Verifies thoughts are correctly formatted
   */
  test('should assemble thoughts section with proper formatting', async () => {
    // Arrange
    const thoughtsSectionAssembler = container.resolve(aiTokens.ThoughtsSectionAssembler);
    const promptData = {
      thoughts: [
        { type: 'feeling', content: 'I feel uneasy about this place.' },
        { type: 'observation', content: 'The guard seems distracted.' },
        { type: 'plan', content: 'I should wait for a better opportunity.' },
      ],
    };

    // Act
    const placeholderResolver = container.resolve(aiTokens.PlaceholderResolver);
    const assembled = thoughtsSectionAssembler.assemble(
      { key: 'thoughts_wrapper' },
      { thoughtsArray: promptData.thoughts.map(t => `${t.type}: ${t.content}`) },
      placeholderResolver
    );

    // Assert
    expect(assembled).toBeDefined();
    expect(assembled).toContain('- feeling: I feel uneasy about this place.');
    expect(assembled).toContain('- observation: The guard seems distracted.');
    expect(assembled).toContain('- plan: I should wait for a better opportunity.');
  });

  /**
   * Test: Integration of multiple assemblers
   * Verifies different assemblers work together correctly
   */
  test('should integrate multiple assemblers in building complete prompt', async () => {
    // Arrange
    const mockLlmId = 'test-integrated';
    const mockLlmConfig = {
      promptElements: [
        { key: 'character_persona', prefix: '=== CHARACTER ===\n', suffix: '\n\n' },
        { key: 'perception_log_wrapper', prefix: '=== PERCEPTION ===\n', suffix: '\n\n' },
        { key: 'thoughts_wrapper', prefix: '=== THOUGHTS ===\n', suffix: '\n\n' },
        { key: 'notes_wrapper', prefix: '=== NOTES ===\n', suffix: '\n\n' },
        { key: 'indexed_choices', prefix: '=== ACTIONS ===\n', suffix: '\n\n' },
      ],
      promptAssemblyOrder: [
        'character_persona',
        'perception_log_wrapper',
        'thoughts_wrapper',
        'notes_wrapper',
        'indexed_choices',
      ],
    };

    const llmConfigManager = container.resolve(aiTokens.LlmConfigManager);
    jest.spyOn(llmConfigManager, 'getConfig').mockResolvedValue(mockLlmConfig);

    const logger = container.resolve(tokens.ILogger);
    const context = { turnNumber: 1, phase: 'action' };
    const gameState = await gameStateProvider.buildGameState(
      testActor,
      context,
      logger
    );
    const availableActions = [
      {
        actionDefinitionId: 'test:wait',
        displayName: 'Wait',
        description: 'Wait and observe',
        scopedTargets: [],
      },
      {
        actionDefinitionId: 'test:speak',
        displayName: 'Speak',
        description: 'Say something',
        scopedTargets: [],
      },
    ];
    const promptData = await promptContentProvider.getPromptData(
      testActor,
      context,
      gameState,
      availableActions,
      logger
    );

    // Act
    const prompt = await promptBuilder.build(mockLlmId, promptData);

    // Assert
    expect(prompt).toBeDefined();
    
    // Check all sections are present and in order
    const characterIndex = prompt.indexOf('=== CHARACTER ===');
    const perceptionIndex = prompt.indexOf('=== PERCEPTION ===');
    const thoughtsIndex = prompt.indexOf('=== THOUGHTS ===');
    const notesIndex = prompt.indexOf('=== NOTES ===');
    const actionsIndex = prompt.indexOf('=== ACTIONS ===');

    expect(characterIndex).toBeGreaterThanOrEqual(0);
    expect(perceptionIndex).toBeGreaterThan(characterIndex);
    expect(thoughtsIndex).toBeGreaterThan(perceptionIndex);
    expect(notesIndex).toBeGreaterThan(thoughtsIndex);
    expect(actionsIndex).toBeGreaterThan(notesIndex);

    // Check content is assembled
    expect(prompt).toContain('Test Actor');
    expect(prompt).toContain('A friendly test character');
    expect(prompt).toContain('I see a tavern');
    expect(prompt).toContain('I feel good');
    expect(prompt).toContain('Remember to test things');
    expect(prompt).toContain('[1] Wait');
    expect(prompt).toContain('[2] Speak');
  });
});