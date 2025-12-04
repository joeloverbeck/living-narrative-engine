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

    const characterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn(() => '<character_data>Mock XML</character_data>'),
    };

    const modActionMetadataProvider = {
      getMetadataForMod: jest.fn(() => null),
    };

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
      actionCategorizationService: {
        extractNamespace: jest.fn(
          (actionId) => actionId.split(':')[0] || 'unknown'
        ),
        shouldUseGrouping: jest.fn(() => false),
        groupActionsByNamespace: jest.fn(() => new Map()),
        getSortedNamespaces: jest.fn(() => []),
        formatNamespaceDisplayName: jest.fn((namespace) =>
          namespace.toUpperCase()
        ),
      },
      characterDataXmlBuilder,
      modActionMetadataProvider,
    });

    llmConfigService = {
      loadConfiguration: jest
        .fn()
        .mockImplementation(async (id) =>
          id === 'test-llm' ? testConfig : null
        ),
    };
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
        'movement:goals': {
          goals: [],
        },
      },
    },
  });

  const THOUGHTS_GUIDANCE_TEXT = `INNER VOICE GUIDANCE: Generate thoughts in your character's authentic mental voice (their habits of mind, personality patterns, and inner speech style). Build on your current mental state with a fresh thought that does not repeat or barely rephrase the "Recent thoughts" above.\n\nTIMING: The thought must occur in the instant IMMEDIATELY BEFORE you perform your chosen action.\n\nANTICIPATION (ALLOWED): You may anticipate likely outcomes, risks, fears, hopes, and contingencies as possibilities (this is normal human/character planning).\n\nEPISTEMIC RULE (CRITICAL): You do NOT yet know the result of your action. Do not describe outcomes, reactions, success/failure, or consequences as facts or as already happened.\n\nSTYLE RULE: Use intent- and possibility-language ("I'm going to...", "I want to...", "maybe...", "might...", "if...", "hopefully..."). Avoid past-tense or certainty about effects ("That hurt them." "They fall." "It worked.").`;

  const buildThoughtsSection = (content = '') => {
    const list = content ? `${content}\n\n` : '\n';
    return `<thoughts>\nRecent thoughts (avoid repeating or barely rephrasing these):\n${list}-----\n${THOUGHTS_GUIDANCE_TEXT}\n</thoughts>`;
  };

  const buildPrompt = async (thoughts = []) => {
    const testDto = createTestDto(thoughts);
    const promptData = await provider.getPromptData(testDto, logger);
    return await promptBuilder.build('test-llm', promptData);
  };

  test('Entity with zero thoughts still includes empty thoughts section', async () => {
    const prompt = await buildPrompt([]);

    // Should include the empty thoughts section placeholder for visibility
    expect(prompt).toContain(buildThoughtsSection());
  });

  test('Entity with one thought includes the formatted section', async () => {
    const prompt = await buildPrompt(['OnlyThought']);

    // Should include the thoughts section with the thought and enhanced guidance text
    expect(prompt).toContain(
      buildThoughtsSection('- OnlyThought')
    );
    expect(prompt).toContain('OnlyThought');
  });

  test('Entity with multiple thoughts formats them correctly', async () => {
    const prompt = await buildPrompt(['First thought', 'Second thought']);

    // Should include both thoughts formatted correctly with enhanced formatting
    expect(prompt).toContain(
      buildThoughtsSection('- First thought\n- Second thought')
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
    expect(prompt).toContain('<thoughts>'); // This should exist because we have thoughts
    // Notes and goals sections are conditional - they won't appear if empty
    expect(prompt).toContain('<available_actions_info>');
    // user_input section has been removed from AI character templates
    expect(prompt).toContain('<system_constraints>');

    // Verify conditional sections are not present when empty
    expect(prompt).not.toContain('<notes>'); // Should be empty and therefore not present
    expect(prompt).not.toContain('<goals>'); // Should be empty and therefore not present
  });

  test('Prompt sections are in the correct constraint-first order (v2.0)', async () => {
    const prompt = await buildPrompt(['Test thought']);

    // Test that sections appear in the expected constraint-first order
    const constraintsIndex = prompt.indexOf('<system_constraints>');
    const contentPolicyIndex = prompt.indexOf('<content_policy>');
    const taskDefIndex = prompt.indexOf('<task_definition>');
    const personaIndex = prompt.indexOf('<character_persona>');
    const guidelinesIndex = prompt.indexOf('<portrayal_guidelines>');
    const thoughtsIndex = prompt.indexOf('<thoughts>');

    // PHASE 1: Constraints first (critical change)
    expect(constraintsIndex).toBeLessThan(contentPolicyIndex);
    expect(contentPolicyIndex).toBeLessThan(taskDefIndex);

    // PHASE 2-3: Task and character identity
    expect(taskDefIndex).toBeLessThan(personaIndex);
    expect(personaIndex).toBeLessThan(guidelinesIndex);

    // PHASE 4-5: World state and execution context
    expect(guidelinesIndex).toBeLessThan(thoughtsIndex);
  });
});
