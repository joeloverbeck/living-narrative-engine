import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { PromptTemplateService } from '../../../src/prompting/promptTemplateService.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('Prompt Assembly with template-based system', () => {
  /** @type {AIPromptContentProvider} */
  let provider;
  /** @type {PromptBuilder} */
  let promptBuilder;
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {jest.Mocked<any>} */
  let llmConfigService;
  /** @type {PromptTemplateService} */
  let templateService;
  /** @type {PromptDataFormatter} */
  let dataFormatter;

  const testConfig = {
    configId: 'test-config',
    displayName: 'Test Config',
    modelIdentifier: 'test-model',
    endpointUrl: 'https://test.api',
    apiType: 'test',
    jsonOutputStrategy: { method: 'test' },
  };

  beforeEach(() => {
    logger = mockLogger();

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: {
        getCoreTaskDescriptionText: jest.fn().mockReturnValue('TASK'),
        getCharacterPortrayalGuidelines: jest.fn().mockReturnValue('GUIDE'),
        getNc21ContentPolicyText: jest.fn().mockReturnValue('POLICY'),
        getFinalLlmInstructionText: jest.fn().mockReturnValue('FINAL'),
      },
      perceptionLogFormatter: { format: jest.fn().mockReturnValue([]) },
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
    });

    llmConfigService = { getConfig: jest.fn().mockResolvedValue(testConfig) };
    templateService = new PromptTemplateService({ logger });
    dataFormatter = new PromptDataFormatter({ logger });

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService,
      dataFormatter,
    });
  });

  const createTestDto = (thoughts = []) => ({
    actorName: 'Test Actor',
    actorId: 'test-actor',
    userInputContent: '',
    currentLocation: {
      locationId: 'test-location',
      name: 'Test Location',
      description: 'A test location',
    },
    availableActions: [],
    perceptionLog: [],
    actorState: {
      components: {
        'core:short_term_memory': {
          thoughts: thoughts.map((text) => ({ text, timestamp: '2024-01-01' })),
        },
        'core:notes': {
          notes: [],
        },
        'core:goals': {
          goals: [],
        },
      },
    },
  });

  const buildPrompt = async (thoughts = []) => {
    const testDto = createTestDto(thoughts);
    const promptData = await provider.getPromptData(testDto, logger);
    return await promptBuilder.build('test-llm', promptData);
  };

  test('Entity with zero thoughts includes empty thoughts section', async () => {
    const prompt = await buildPrompt([]);

    // Should include the thoughts section but it should be empty
    expect(prompt).toContain('<thoughts>\n\n</thoughts>');
    expect(prompt).not.toContain('Your most recent thoughts');
  });

  test('Entity with one thought includes the formatted section', async () => {
    const prompt = await buildPrompt(['OnlyThought']);

    // Should include the thoughts section with the thought
    expect(prompt).toContain('<thoughts>\n- OnlyThought\n</thoughts>');
    expect(prompt).toContain('OnlyThought');
  });

  test('Entity with multiple thoughts formats them correctly', async () => {
    const prompt = await buildPrompt(['First thought', 'Second thought']);

    // Should include both thoughts formatted correctly
    expect(prompt).toContain(
      '<thoughts>\n- First thought\n- Second thought\n</thoughts>'
    );
    expect(prompt).toContain('First thought');
    expect(prompt).toContain('Second thought');
  });

  test('Prompt includes all required sections', async () => {
    const prompt = await buildPrompt(['Test thought']);

    // Should contain all major sections
    expect(prompt).toContain('<task_definition>');
    expect(prompt).toContain('<character_persona>');
    expect(prompt).toContain('<portrayal_guidelines>');
    expect(prompt).toContain('<content_policy>');
    expect(prompt).toContain('<world_context>');
    expect(prompt).toContain('<perception_log>');
    expect(prompt).toContain('<thoughts>');
    expect(prompt).toContain('<notes>');
    expect(prompt).toContain('<goals>');
    expect(prompt).toContain('<available_actions_info>');
    expect(prompt).toContain('<indexed_choices>');
    expect(prompt).toContain('<user_input>');
    expect(prompt).toContain('<final_instructions>');
  });

  test('Prompt sections are in the correct order', async () => {
    const prompt = await buildPrompt(['Test thought']);

    // Test that sections appear in the expected order
    const taskDefIndex = prompt.indexOf('<task_definition>');
    const personaIndex = prompt.indexOf('<character_persona>');
    const guidelinesIndex = prompt.indexOf('<portrayal_guidelines>');
    const thoughtsIndex = prompt.indexOf('<thoughts>');
    const finalIndex = prompt.indexOf('<final_instructions>');

    expect(taskDefIndex).toBeLessThan(personaIndex);
    expect(personaIndex).toBeLessThan(guidelinesIndex);
    expect(guidelinesIndex).toBeLessThan(thoughtsIndex);
    expect(thoughtsIndex).toBeLessThan(finalIndex);
  });
});
