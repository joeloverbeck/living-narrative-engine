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
  characterName: 'Test Character',
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
      loadConfiguration: jest.fn(async (id) =>
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
    // user_input section has been removed from AI character templates
    expect(prompt).toContain(
      '<final_instructions>\nTest final instructions\n</final_instructions>'
    );

    // Check complex sections are formatted correctly
    expect(prompt).toContain(
      '<perception_log>\nTest perception 1\nTest perception 2\n</perception_log>'
    );
    expect(prompt).toContain(
      "<thoughts>\nRecent thoughts (avoid repeating or barely rephrasing these):\n- Test thought 1\n- Test thought 2\n\n-----\nGenerate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.\n</thoughts>"
    );
    expect(prompt).toContain(
      "NOTES WRITING GUIDANCE: The notes must be concise, but written in Test Character's own voice. Focus each note on critical facts while preserving Test Character's perspective. Avoid generic or neutral phrasing. Keep any new notes distinct from the existing entries listed below."
    );
    expect(prompt).toContain(
      '<notes>\n## Other\n### General\n- Test note 1\n- Test note 2\n</notes>'
    );
    expect(prompt).toContain('<goals>\n- Test goal 1\n- Test goal 2\n</goals>');

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
    };

    const prompt = await builder.build(TEST_LLM_ID, dataWithEmptyArrays);

    // Empty conditional sections should NOT have wrapper tags (smart template engine)
    expect(prompt).not.toContain('<thoughts>');
    expect(prompt).not.toContain('<notes>');
    expect(prompt).not.toContain('<goals>');

    // Non-conditional sections should still have wrapper tags even when empty
    expect(prompt).toContain('<perception_log>\n\n</perception_log>');
  });

  test('eliminates empty conditional sections to save tokens', async () => {
    const dataWithSomeEmptySections = {
      ...SAMPLE_PROMPT_DATA,
      thoughtsArray: [{ text: 'I have a thought', timestamp: '2024-01-01' }], // Has content
      notesArray: [], // Empty - should be eliminated
      goalsArray: [{ text: 'Complete the quest', timestamp: '2024-01-01' }], // Has content
    };

    const prompt = await builder.build(TEST_LLM_ID, dataWithSomeEmptySections);

    // Should contain sections with content
    expect(prompt).toContain(
      "<thoughts>\nRecent thoughts (avoid repeating or barely rephrasing these):\n- I have a thought\n\n-----\nGenerate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.\n</thoughts>"
    );
    expect(prompt).toContain(
      "NOTES WRITING GUIDANCE: The notes must be concise, but written in Test Character's own voice. Focus each note on critical facts while preserving Test Character's perspective. Avoid generic or neutral phrasing."
    );
    expect(prompt).toContain('<goals>\n- Complete the quest\n</goals>');

    // Should NOT contain empty notes section
    expect(prompt).not.toContain('<notes>');

    // Verify token efficiency: count the sections present
    const thoughtsMatch = prompt.match(/<thoughts>[\s\S]*?<\/thoughts>/);
    const notesMatch = prompt.match(/<notes>[\s\S]*?<\/notes>/);
    const goalsMatch = prompt.match(/<goals>[\s\S]*?<\/goals>/);

    expect(thoughtsMatch).toBeTruthy(); // Should exist
    expect(notesMatch).toBeFalsy(); // Should NOT exist
    expect(goalsMatch).toBeTruthy(); // Should exist
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
    // user_input section has been removed from AI character templates
    expect(prompt).toContain('<final_instructions>\n\n</final_instructions>');
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Guard clauses & edge-cases                                             */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('returns empty string when llmConfigService returns null', async () => {
    llmConfigService.loadConfiguration.mockResolvedValueOnce(null);

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
    expect(perceptionSection).toContain('A bright light');
    expect(perceptionSection).toContain('A loud noise');
    expect(perceptionSection).toContain('A rough surface');
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
