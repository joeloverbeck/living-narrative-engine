/**
 * @file End-to-end test for the complete prompt generation pipeline
 * @see reports/llm-prompt-workflow-analysis.md
 *
 * This test suite covers the entire prompt generation pipeline from AI actor
 * decision request through final prompt assembly:
 * - AIPromptPipeline orchestration
 * - LLM configuration loading and switching
 * - Game state building (AIGameStateProvider)
 * - Prompt content gathering (AIPromptContentProvider)
 * - Prompt assembly with element ordering (PromptBuilder)
 * - Placeholder resolution
 * - Action indexing
 * - Token estimation and limits
 * - Conditional element inclusion
 * - Error handling and edge cases
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { PromptGenerationTestBed } from './common/promptGenerationTestBed.js';
import { ENTITY_CREATED } from '../../../src/constants/eventIds.js';

/**
 * E2E test suite for the complete prompt generation pipeline
 * Tests the entire flow from AI actor decision request to final prompt
 */
describe('Complete Prompt Generation Pipeline E2E', () => {
  let testBed;
  let testWorld;
  let testActors;
  let testActions;

  beforeEach(async () => {
    // Initialize test bed
    testBed = new PromptGenerationTestBed();
    await testBed.initialize();

    // Set up test world, actors, and actions
    testWorld = await testBed.createTestWorld();
    testActors = await testBed.createTestActors();
    testActions = await testBed.registerTestActions();

    // Clear any events from initialization
    testBed.clearRecordedEvents();
  });

  afterEach(async () => {
    // Clean up test bed
    await testBed.cleanup();
  });

  /**
   * Test: Basic prompt generation flow
   * Verifies the complete pipeline works end-to-end for AI actors
   */
  test('should generate complete prompt for AI actor decision', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Prompt was generated
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);

    // Assert - Key sections are present
    const sections = testBed.parsePromptSections(prompt);
    expect(sections.task_definition).toBeDefined();
    expect(sections.character_persona).toBeDefined();
    expect(sections.indexed_choices).toBeDefined();
    expect(sections.final_instructions).toBeDefined();

    // Assert - Character name was resolved
    expect(prompt).toContain('Elara the Bard');
    
    // Assert - Location name was resolved
    expect(prompt).toContain('The Rusty Tankard');
  });

  /**
   * Test: Prompt element assembly order
   * Verifies elements appear in the order specified by promptAssemblyOrder
   */
  test('should assemble prompt elements in configured order', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Elements appear in correct order
    const taskIndex = prompt.indexOf('<task_definition>');
    const personaIndex = prompt.indexOf('<character_persona>');
    const perceptionIndex = prompt.indexOf('<perception_log>');
    const thoughtsIndex = prompt.indexOf('<thoughts>');
    const choicesIndex = prompt.indexOf('<indexed_choices>');
    const instructionsIndex = prompt.indexOf('<final_instructions>');

    // All required elements should be present
    expect(taskIndex).toBeGreaterThanOrEqual(0);
    expect(personaIndex).toBeGreaterThanOrEqual(0);
    expect(choicesIndex).toBeGreaterThanOrEqual(0);
    expect(instructionsIndex).toBeGreaterThanOrEqual(0);

    // They should appear in the configured order
    expect(taskIndex).toBeLessThan(personaIndex);
    expect(personaIndex).toBeLessThan(perceptionIndex);
    expect(perceptionIndex).toBeLessThan(thoughtsIndex);
    expect(choicesIndex).toBeLessThan(instructionsIndex);
  });

  /**
   * Test: Action indexing
   * Verifies actions are properly indexed starting from [1]
   */
  test('should properly index available actions', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Extract indexed actions
    const indexedActions = testBed.extractIndexedActions(prompt);
    expect(indexedActions.length).toBe(availableActions.length);

    // Verify indexing starts at 1 and is sequential
    for (let i = 0; i < indexedActions.length; i++) {
      expect(indexedActions[i].index).toBe(i + 1);
    }

    // Verify action descriptions are included
    expect(indexedActions.some(a => a.description.includes('Wait'))).toBe(true);
    expect(indexedActions.some(a => a.description.includes('Market Square'))).toBe(true);
    expect(indexedActions.some(a => a.description.includes('Dark Alley'))).toBe(true);
    expect(indexedActions.some(a => a.description.includes('Perform'))).toBe(true);
  });

  /**
   * Test: Placeholder resolution
   * Verifies placeholders are correctly replaced with actual data
   */
  test('should resolve placeholders in prompt content', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - No unresolved placeholders remain
    expect(prompt).not.toMatch(/\{actorName\}/);
    expect(prompt).not.toMatch(/\{locationName\}/);
    expect(prompt).not.toMatch(/\{[^}]+\}/); // No placeholders at all

    // Assert - Placeholders were replaced with actual values
    const sections = testBed.parsePromptSections(prompt);
    expect(sections.character_persona).toContain('Elara the Bard');
    
    // The world context or perception should reference the location
    const fullPrompt = prompt.toLowerCase();
    expect(fullPrompt).toContain('rusty tankard');
  });

  /**
   * Test: Perception log inclusion
   * Verifies perception log entries are included in the prompt
   */
  test('should include perception log entries in prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Perception log section exists
    const sections = testBed.parsePromptSections(prompt);
    expect(sections.perception_log).toBeDefined();

    // Assert - Log entries are included
    expect(sections.perception_log).toContain('The tavern is warm and inviting');
    expect(sections.perception_log).toContain('Welcome to the Rusty Tankard!');
    expect(sections.perception_log).toContain('A patron raises their mug in greeting');
  });

  /**
   * Test: Conditional element inclusion (notes)
   * Verifies conditional elements are included only when data is present
   */
  test('should conditionally include notes section when notes exist', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act - Generate with notes
    const promptWithNotes = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Notes section is included
    expect(promptWithNotes).toContain('<notes>');
    expect(promptWithNotes).toContain('The innkeeper mentioned something about troubles');
    expect(promptWithNotes).toContain('I should perform a song');

    // Arrange - Remove notes
    await testBed.updateActorNotes(aiActor.id, []);

    // Act - Generate without notes
    const promptWithoutNotes = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Notes section might be excluded or empty based on condition
    const sectionsWithout = testBed.parsePromptSections(promptWithoutNotes);
    if (sectionsWithout.notes) {
      expect(sectionsWithout.notes).toBe('');
    }
  });

  /**
   * Test: Multiple LLM configurations
   * Verifies prompt structure adapts to different LLM configurations
   */
  test('should adapt prompt structure for different LLM configurations', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act - Generate with tool calling config
    const toolCallingPrompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Switch to JSON schema config
    await testBed.switchLLMConfig('test-llm-jsonschema');

    // Act - Generate with JSON schema config
    const jsonSchemaPrompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Different structures
    expect(toolCallingPrompt).toContain('<task_definition>');
    expect(toolCallingPrompt).toContain('<character_persona>');
    
    expect(jsonSchemaPrompt).toContain('## Task');
    expect(jsonSchemaPrompt).toContain('## Character');
    expect(jsonSchemaPrompt).toContain('## Available Actions');

    // Both should have indexed actions
    const toolCallingActions = testBed.extractIndexedActions(toolCallingPrompt);
    const jsonSchemaActions = testBed.extractIndexedActions(jsonSchemaPrompt);
    expect(toolCallingActions.length).toBe(availableActions.length);
    expect(jsonSchemaActions.length).toBe(availableActions.length);
  });

  /**
   * Test: Token estimation and limits
   * Verifies token counting and warnings for large prompts
   */
  test('should estimate tokens and respect context limits', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Create a very long perception log to increase prompt size
    const longPerceptionLog = [];
    for (let i = 0; i < 100; i++) {
      longPerceptionLog.push({
        type: 'observation',
        content: `This is a very long observation entry number ${i} that contains a lot of text to increase the token count of the generated prompt.`
      });
    }
    await testBed.updateActorPerception(aiActor.id, longPerceptionLog);

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Prompt was still generated
    expect(prompt).toBeDefined();
    
    // Estimate tokens
    const estimatedTokens = testBed.estimateTokenCount(prompt);
    expect(estimatedTokens).toBeGreaterThan(1000);

    // Get current config to check limits
    const { config } = await testBed.getCurrentLLMConfig();
    expect(estimatedTokens).toBeLessThan(config.contextTokenLimit);
  });

  /**
   * Test: Thoughts section inclusion
   * Verifies actor thoughts are included in the prompt
   */
  test('should include actor thoughts in prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Thoughts section exists
    const sections = testBed.parsePromptSections(prompt);
    expect(sections.thoughts).toBeDefined();

    // Assert - Thought entries are included
    expect(sections.thoughts).toContain('I feel welcomed in this friendly tavern');
    expect(sections.thoughts).toContain('The innkeeper seems trustworthy');
  });

  /**
   * Test: Empty available actions handling
   * Verifies prompt generation works even with no available actions
   */
  test('should handle empty available actions gracefully', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const emptyActions = [];

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      emptyActions
    );

    // Assert - Prompt was generated
    expect(prompt).toBeDefined();
    
    // Assert - Indexed choices section exists but is empty or has a message
    const sections = testBed.parsePromptSections(prompt);
    expect(sections.indexed_choices).toBeDefined();
    
    const indexedActions = testBed.extractIndexedActions(prompt);
    expect(indexedActions.length).toBe(0);
  });

  /**
   * Test: Actor without AI component
   * Verifies appropriate error handling for non-AI actors
   */
  test('should handle non-AI actors appropriately', async () => {
    // Arrange
    const nonAiActor = testActors.player; // Player is not an AI
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act & Assert - Should still generate a prompt (AI component is optional)
    const prompt = await testBed.generatePrompt(
      nonAiActor.id,
      turnContext,
      availableActions
    );

    expect(prompt).toBeDefined();
    expect(prompt).toContain('Test Player'); // Should use actor name
  });

  /**
   * Test: Complex action parameters
   * Verifies actions with targets are properly formatted
   */
  test('should properly format actions with target parameters', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    
    // Add an action targeting another actor
    const complexActions = [
      ...testBed.createTestActionComposites(),
      {
        actionDefinitionId: 'core:follow',
        displayName: 'Follow Gareth the Innkeeper',
        description: 'Start following Gareth the Innkeeper',
        scopedTargets: [{ 
          id: 'test-innkeeper', 
          display: 'Gareth the Innkeeper', 
          type: 'actor' 
        }],
        actionDefinition: testActions.find(a => a.id === 'core:follow'),
      }
    ];

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      complexActions
    );

    // Assert - Follow action is properly indexed
    const indexedActions = testBed.extractIndexedActions(prompt);
    const followAction = indexedActions.find(a => 
      a.description.includes('Follow') && 
      a.description.includes('Gareth')
    );
    expect(followAction).toBeDefined();
  });

  /**
   * Test: Prompt caching behavior
   * Verifies subsequent calls with same data are efficient
   */
  test('should efficiently generate prompts for repeated calls', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act - Generate prompt multiple times
    const startTime = Date.now();
    const prompt1 = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );
    const time1 = Date.now() - startTime;

    const startTime2 = Date.now();
    const prompt2 = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );
    const time2 = Date.now() - startTime2;

    // Assert - Prompts are consistent
    expect(prompt1).toBe(prompt2);
    
    // Second call might be faster due to caching (but not required)
    expect(time2).toBeLessThanOrEqual(time1 * 1.5);
  });

  /**
   * Test: Integration with static content service
   * Verifies static prompt content is loaded correctly
   */
  test('should include static prompt content from files', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Static content sections are included
    const sections = testBed.parsePromptSections(prompt);
    
    // Task definition should have content
    expect(sections.task_definition).toBeDefined();
    expect(sections.task_definition.length).toBeGreaterThan(50);
    
    // Final instructions should have content
    expect(sections.final_instructions).toBeDefined();
    expect(sections.final_instructions.length).toBeGreaterThan(50);
  });

  /**
   * Test: Performance of prompt generation
   * Verifies generation completes within reasonable time
   */
  test('should generate prompts within performance limits', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act - Measure generation time
    const startTime = Date.now();
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );
    const endTime = Date.now();

    const generationTime = endTime - startTime;

    // Assert
    expect(prompt).toBeDefined();
    expect(generationTime).toBeLessThan(500); // Should complete in under 500ms

    // Test multiple rapid generations
    const rapidStartTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await testBed.generatePrompt(aiActor.id, turnContext, availableActions);
    }
    const rapidEndTime = Date.now();

    const avgTime = (rapidEndTime - rapidStartTime) / 10;
    expect(avgTime).toBeLessThan(200); // Average should be under 200ms
  });
});