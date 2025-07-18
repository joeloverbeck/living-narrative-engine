/* eslint-env node */
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { PromptTemplateService } from '../../../src/prompting/promptTemplateService.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';

/* ------------------------------------------------------------------------- */
/* Shared test data                                                          */
/* ------------------------------------------------------------------------- */

const TEST_LLM_ID = 'unit-llm';

const BASIC_LLM_CONFIG = {
  configId: 'config-1',
  displayName: 'Test LLM',
  modelIdentifier: 'test-model',
  endpointUrl: 'https://test.api',
  apiType: 'test',
  jsonOutputStrategy: { method: 'test' },
};

const SAMPLE_PROMPT_DATA = {
  taskDefinitionContent: 'Test task definition',
  characterPersonaContent: 'Test character persona',
  portrayalGuidelinesContent: 'Test portrayal guidelines',
  contentPolicyContent: 'Test content policy',
  worldContextContent: 'Test world context',
  availableActionsInfoContent: 'Test available actions',
  userInputContent: 'Test user input',
  finalInstructionsContent: 'Test final instructions',
  assistantResponsePrefix: '\n',
  perceptionLogArray: [
    { type: 'visual', content: 'Test perception 1' },
    { type: 'audio', content: 'Test perception 2' },
  ],
  thoughtsArray: [
    { text: 'Test thought 1', timestamp: '2024-01-01' },
    { text: 'Test thought 2', timestamp: '2024-01-02' },
  ],
  notesArray: [
    { text: 'Test note 1', timestamp: '2024-01-01' },
    { text: 'Test note 2', timestamp: '2024-01-02' },
  ],
  goalsArray: [
    { text: 'Test goal 1', timestamp: '2024-01-01' },
    { text: 'Test goal 2', timestamp: '2024-01-02' },
  ],
  indexedChoicesArray: [
    { index: 1, commandString: 'action1', description: 'Do action 1' },
    { index: 2, commandString: 'action2', description: 'Do action 2' },
  ],
};

/* ------------------------------------------------------------------------- */
/* Test suite                                                                */
/* ------------------------------------------------------------------------- */

describe('PromptBuilder (template-based)', () => {
  let logger;
  let llmConfigService;
  let templateService;
  let dataFormatter;
  let builder;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    llmConfigService = {
      getConfig: jest.fn(async (id) =>
        id === TEST_LLM_ID ? BASIC_LLM_CONFIG : null
      ),
    };

    templateService = new PromptTemplateService({ logger });
    dataFormatter = new PromptDataFormatter({ logger });

    builder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService,
      dataFormatter,
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Happy-path prompt generation                                            */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('generates a complete prompt from template and data', async () => {
    const prompt = await builder.build(TEST_LLM_ID, SAMPLE_PROMPT_DATA);

    // Check that all major sections are present
    expect(prompt).toContain(
      '<task_definition>\nTest task definition\n</task_definition>'
    );
    expect(prompt).toContain(
      '<character_persona>\nTest character persona\n</character_persona>'
    );
    expect(prompt).toContain(
      '<portrayal_guidelines>\nTest portrayal guidelines\n</portrayal_guidelines>'
    );
    expect(prompt).toContain(
      '<content_policy>\nTest content policy\n</content_policy>'
    );
    expect(prompt).toContain(
      '<world_context>\nTest world context\n</world_context>'
    );
    expect(prompt).toContain(
      '<available_actions_info>\nTest available actions\n</available_actions_info>'
    );
    expect(prompt).toContain('<user_input>\nTest user input\n</user_input>');
    expect(prompt).toContain(
      '<final_instructions>\nTest final instructions\n</final_instructions>'
    );

    // Check complex sections are formatted correctly
    expect(prompt).toContain(
      '<perception_log>\n<entry type="visual">\nTest perception 1\n</entry>\n<entry type="audio">\nTest perception 2\n</entry>\n</perception_log>'
    );
    expect(prompt).toContain(
      '<thoughts>\n- Test thought 1\n- Test thought 2\n</thoughts>'
    );
    expect(prompt).toContain('<notes>\n- Test note 1\n- Test note 2\n</notes>');
    expect(prompt).toContain('<goals>\n- Test goal 1\n- Test goal 2\n</goals>');
    expect(prompt).toContain(
      '<indexed_choices>\n[1] action1: Do action 1\n[2] action2: Do action 2\n</indexed_choices>'
    );

    // Check the assistant response prefix
    expect(prompt).toEndWith('\n');
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Empty sections handling                                                 */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('handles empty arrays gracefully', async () => {
    const dataWithEmptyArrays = {
      ...SAMPLE_PROMPT_DATA,
      perceptionLogArray: [],
      thoughtsArray: [],
      notesArray: [],
      goalsArray: [],
      indexedChoicesArray: [],
    };

    const prompt = await builder.build(TEST_LLM_ID, dataWithEmptyArrays);

    // Empty sections should still have wrapper tags but no content
    expect(prompt).toContain('<perception_log>\n\n</perception_log>');
    expect(prompt).toContain('<thoughts>\n\n</thoughts>');
    expect(prompt).toContain('<notes>\n\n</notes>');
    expect(prompt).toContain('<goals>\n\n</goals>');
    expect(prompt).toContain('<indexed_choices>\n\n</indexed_choices>');
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Missing fields handling                                                 */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('handles missing string fields with empty strings', async () => {
    const minimalData = {
      // Only provide arrays, let string fields be undefined
      perceptionLogArray: [],
      thoughtsArray: [],
      notesArray: [],
      goalsArray: [],
      indexedChoicesArray: [],
    };

    const prompt = await builder.build(TEST_LLM_ID, minimalData);

    // All sections should still be present but empty
    expect(prompt).toContain('<task_definition>\n\n</task_definition>');
    expect(prompt).toContain('<character_persona>\n\n</character_persona>');
    expect(prompt).toContain(
      '<portrayal_guidelines>\n\n</portrayal_guidelines>'
    );
    expect(prompt).toContain('<content_policy>\n\n</content_policy>');
    expect(prompt).toContain('<world_context>\n\n</world_context>');
    expect(prompt).toContain(
      '<available_actions_info>\n\n</available_actions_info>'
    );
    expect(prompt).toContain('<user_input>\n\n</user_input>');
    expect(prompt).toContain('<final_instructions>\n\n</final_instructions>');
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Guard clauses & edge-cases                                             */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('returns empty string when llmConfigService returns null', async () => {
    llmConfigService.getConfig.mockResolvedValueOnce(null);

    const prompt = await builder.build('unknown-llm', {});

    expect(prompt).toBe('');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('No configuration found')
    );
  });

  test('returns empty string when llmId is null', async () => {
    const prompt = await builder.build(null, {});

    expect(prompt).toBe('');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('llmId is required')
    );
  });

  test('returns empty string when promptData is null', async () => {
    const prompt = await builder.build(TEST_LLM_ID, null);

    expect(prompt).toBe('');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('promptData is required')
    );
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Complex data formatting                                                 */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('formats perception log entries with proper XML structure', async () => {
    const dataWithComplexPerceptions = {
      ...SAMPLE_PROMPT_DATA,
      perceptionLogArray: [
        { type: 'visual', content: 'A bright light' },
        { type: 'audio', content: 'A loud noise' },
        { type: 'tactile', content: 'A rough surface' },
      ],
    };

    const prompt = await builder.build(TEST_LLM_ID, dataWithComplexPerceptions);

    const perceptionSection = prompt.match(
      /<perception_log>([\s\S]*?)<\/perception_log>/
    )[1];
    expect(perceptionSection).toContain(
      '<entry type="visual">\nA bright light\n</entry>'
    );
    expect(perceptionSection).toContain(
      '<entry type="audio">\nA loud noise\n</entry>'
    );
    expect(perceptionSection).toContain(
      '<entry type="tactile">\nA rough surface\n</entry>'
    );
  });

  test('formats indexed choices with proper numbering and descriptions', async () => {
    const dataWithManyChoices = {
      ...SAMPLE_PROMPT_DATA,
      indexedChoicesArray: [
        {
          index: 1,
          commandString: 'look',
          description: 'Look around the room',
        },
        {
          index: 2,
          commandString: 'talk',
          description: 'Talk to the merchant',
        },
        { index: 3, commandString: 'leave', description: 'Leave the shop' },
        {
          index: 4,
          commandString: 'buy sword',
          description: 'Buy the iron sword (50 gold)',
        },
      ],
    };

    const prompt = await builder.build(TEST_LLM_ID, dataWithManyChoices);

    const choicesSection = prompt.match(
      /<indexed_choices>([\s\S]*?)<\/indexed_choices>/
    )[1];
    expect(choicesSection).toContain('[1] look: Look around the room');
    expect(choicesSection).toContain('[2] talk: Talk to the merchant');
    expect(choicesSection).toContain('[3] leave: Leave the shop');
    expect(choicesSection).toContain(
      '[4] buy sword: Buy the iron sword (50 gold)'
    );
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Integration with custom template service                                */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('uses injected template service and data formatter', async () => {
    const mockTemplateService = {
      processCharacterPrompt: jest.fn().mockReturnValue('MOCK PROMPT OUTPUT'),
    };
    const mockDataFormatter = {
      formatPromptData: jest.fn().mockReturnValue({ mocked: 'data' }),
    };

    const customBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService: mockTemplateService,
      dataFormatter: mockDataFormatter,
    });

    const prompt = await customBuilder.build(TEST_LLM_ID, SAMPLE_PROMPT_DATA);

    expect(prompt).toBe('MOCK PROMPT OUTPUT');
    expect(mockDataFormatter.formatPromptData).toHaveBeenCalledWith(
      SAMPLE_PROMPT_DATA
    );
    expect(mockTemplateService.processCharacterPrompt).toHaveBeenCalledWith({
      mocked: 'data',
    });
  });
});
