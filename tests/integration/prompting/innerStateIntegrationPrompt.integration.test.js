/**
 * @file Integration tests for inner state integration content in prompt assembly
 * Verifies that the inner state integration protocol flows correctly through
 * the prompt pipeline from corePromptText.json to assembled prompts.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { PromptTemplateService } from '../../../src/prompting/promptTemplateService.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { PerceptionLogFormatter } from '../../../src/formatting/perceptionLogFormatter.js';
import CharacterDataXmlBuilder from '../../../src/prompting/characterDataXmlBuilder.js';
import XmlElementBuilder from '../../../src/prompting/xmlElementBuilder.js';

// Load actual corePromptText.json data
const corePromptTextPath = path.resolve(
  process.cwd(),
  'data/prompts/corePromptText.json'
);
const corePromptText = JSON.parse(fs.readFileSync(corePromptTextPath, 'utf-8'));

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Build mock service using actual data (per project conventions)
const buildPromptStaticContentService = () => ({
  getCoreTaskDescriptionText: () => corePromptText.coreTaskDescriptionText,
  getCharacterPortrayalGuidelines: (name) =>
    corePromptText.characterPortrayalGuidelinesTemplate.replace(
      /\{\{name\}\}/g,
      name
    ),
  getNc21ContentPolicyText: () => corePromptText.nc21ContentPolicyText,
  getFinalLlmInstructionText: () => corePromptText.finalLlmInstructionText,
  getMoodUpdateInstructionText: () =>
    corePromptText.moodUpdateOnlyInstructionText,
  getMoodUpdateTaskDefinitionText: () =>
    corePromptText.moodUpdateTaskDefinitionText,
  getMoodUpdatePortrayalGuidelines: (name) =>
    corePromptText.moodUpdatePortrayalGuidelinesTemplate.replace(
      /\{\{name\}\}/g,
      name
    ),
});

const buildActionCategorizationService = () => ({
  extractNamespace: jest.fn((actionId) => actionId.split(':')[0] || 'unknown'),
  shouldUseGrouping: jest.fn(() => false),
  groupActionsByNamespace: jest.fn(() => new Map()),
  getSortedNamespaces: jest.fn(() => []),
  formatNamespaceDisplayName: jest.fn((namespace) => namespace),
});

const buildGameStateDto = () => ({
  actorName: 'Test Character',
  actorId: 'actor-1',
  currentUserInput: '',
  currentLocation: {
    locationId: 'test-location',
    name: 'Test Location',
    description: 'A test location for integration tests.',
    exits: [],
    characters: [],
  },
  availableActions: [],
  perceptionLog: [],
  actorPromptData: {
    name: 'Test Character',
    description: 'A test character for integration tests.',
    personality: 'Careful and observant.',
    emotionalState: {
      emotionalStateText: 'tension: moderate, focus: high',
      sexualStateText: 'neutral',
      moodAxes: {
        valence: 10,
        arousal: 20,
        agency_control: 15,
        threat: 5,
        engagement: 30,
        future_expectancy: 10,
        self_evaluation: 5,
        affiliation: 20,
      },
      sexVariables: {
        sex_excitation: 5,
        sex_inhibition: 50,
      },
    },
  },
  actorState: {
    components: {
      'core:short_term_memory': {
        thoughts: [{ text: 'Focus on the task.', timestamp: '2024-01-01' }],
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

const testLlmConfig = {
  configId: 'test-config',
  displayName: 'Test Config',
  modelIdentifier: 'test-model',
  endpointUrl: 'https://test.api',
  apiType: 'test',
  jsonOutputStrategy: { method: 'test' },
};

describe('Inner State Integration in Assembled Prompt', () => {
  let logger;
  let provider;
  let promptBuilder;

  beforeEach(() => {
    logger = buildLogger();

    const characterDataXmlBuilder = new CharacterDataXmlBuilder({
      logger,
      xmlElementBuilder: new XmlElementBuilder({ logger }),
    });

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: buildPromptStaticContentService(),
      perceptionLogFormatter: new PerceptionLogFormatter({ logger }),
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
      actionCategorizationService: buildActionCategorizationService(),
      characterDataXmlBuilder,
      modActionMetadataProvider: {
        getMetadataForMod: jest.fn(() => null),
      },
      chanceTextTranslator: { translateForLlm: (text) => text },
    });

    const llmConfigService = {
      loadConfiguration: jest.fn().mockResolvedValue(testLlmConfig),
    };
    const templateService = new PromptTemplateService({ logger });
    const dataFormatter = new PromptDataFormatter({ logger });

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService,
      dataFormatter,
    });
  });

  test('assembled prompt contains inner_state_integration XML tags', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('<inner_state_integration>');
    expect(prompt).toContain('</inner_state_integration>');
  });

  test('assembled prompt contains INNER STATE INTEGRATION header', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain(
      'INNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)'
    );
  });

  test('assembled prompt does NOT contain old INNER STATE EXPRESSION header', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).not.toContain('INNER STATE EXPRESSION (CRITICAL)');
  });

  test('assembled prompt contains STATE INTEGRATION PROTOCOL section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain(
      'STATE INTEGRATION PROTOCOL (do this BEFORE writing; do not print this protocol):'
    );
    expect(prompt).toContain('1) Choose DRIVERS from <inner_state>:');
    expect(prompt).toContain('2) Translate those drivers through persona:');
    expect(prompt).toContain('3) Let the drivers decide:');
  });

  test('assembled prompt contains PER-FIELD STATE SIGNAL MINIMUMS section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain(
      'PER-FIELD STATE SIGNAL MINIMUMS (must satisfy all):'
    );
    expect(prompt).toContain(
      '- thoughts: MUST clearly reflect Primary + Secondary'
    );
    expect(prompt).toContain(
      '- action: MUST be plausible under Primary emotion'
    );
    expect(prompt).toContain(
      '- speech: If non-empty, it MUST be colored by Primary/Secondary'
    );
    expect(prompt).toContain('- notes: Still facts-only');
  });

  test('assembled prompt contains SEXUAL STATE RULE section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain(
      'SEXUAL STATE RULE (applies even if no sexual content is present):'
    );
    expect(prompt).toContain(
      'Sexual state changes comfort distance, gaze, bodily awareness, and avoidance'
    );
  });

  test('assembled prompt contains CONFLICT RULE section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('CONFLICT RULE (persona vs state):');
    expect(prompt).toContain('If persona would hide vulnerability');
  });

  test('assembled prompt contains fail condition statement', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain(
      'Fail condition: any turn where thoughts/action/speech could be swapped to a different inner_state with minimal edits'
    );
  });

  test('XML tags appear exactly once in assembled prompt', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    const openCount = (
      prompt.match(/<inner_state_integration>/g) || []
    ).length;
    const closeCount = (
      prompt.match(/<\/inner_state_integration>/g) || []
    ).length;

    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);
  });
});

describe('Prompt Section Ordering', () => {
  let logger;
  let provider;
  let promptBuilder;

  beforeEach(() => {
    logger = buildLogger();

    const characterDataXmlBuilder = new CharacterDataXmlBuilder({
      logger,
      xmlElementBuilder: new XmlElementBuilder({ logger }),
    });

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: buildPromptStaticContentService(),
      perceptionLogFormatter: new PerceptionLogFormatter({ logger }),
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
      actionCategorizationService: buildActionCategorizationService(),
      characterDataXmlBuilder,
      modActionMetadataProvider: {
        getMetadataForMod: jest.fn(() => null),
      },
      chanceTextTranslator: { translateForLlm: (text) => text },
    });

    const llmConfigService = {
      loadConfiguration: jest.fn().mockResolvedValue(testLlmConfig),
    };
    const templateService = new PromptTemplateService({ logger });
    const dataFormatter = new PromptDataFormatter({ logger });

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService,
      dataFormatter,
    });
  });

  test('inner_state_integration appears before ACTION SELECTION', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    const innerStatePos = prompt.indexOf('<inner_state_integration>');
    const actionSelectionPos = prompt.indexOf('ACTION SELECTION:');

    expect(innerStatePos).toBeGreaterThan(-1);
    expect(actionSelectionPos).toBeGreaterThan(-1);
    expect(innerStatePos).toBeLessThan(actionSelectionPos);
  });

  test('SPEECH CONTENT RULE appears after inner_state_integration close tag', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    const closeTagPos = prompt.indexOf('</inner_state_integration>');
    const speechRulePos = prompt.indexOf('SPEECH CONTENT RULE (CRITICAL):');

    expect(closeTagPos).toBeGreaterThan(-1);
    expect(speechRulePos).toBeGreaterThan(-1);
    expect(closeTagPos).toBeLessThan(speechRulePos);
  });

  test('THOUGHTS COLORING appears after inner_state_integration close tag', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    const closeTagPos = prompt.indexOf('</inner_state_integration>');
    const thoughtsColoringPos = prompt.indexOf('THOUGHTS COLORING:');

    expect(closeTagPos).toBeGreaterThan(-1);
    expect(thoughtsColoringPos).toBeGreaterThan(-1);
    expect(closeTagPos).toBeLessThan(thoughtsColoringPos);
  });
});

describe('Mood Update Prompt Exclusion', () => {
  let logger;
  let provider;
  let promptBuilder;

  beforeEach(() => {
    logger = buildLogger();

    const characterDataXmlBuilder = new CharacterDataXmlBuilder({
      logger,
      xmlElementBuilder: new XmlElementBuilder({ logger }),
    });

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: buildPromptStaticContentService(),
      perceptionLogFormatter: new PerceptionLogFormatter({ logger }),
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
      actionCategorizationService: buildActionCategorizationService(),
      characterDataXmlBuilder,
      modActionMetadataProvider: {
        getMetadataForMod: jest.fn(() => null),
      },
      chanceTextTranslator: { translateForLlm: (text) => text },
    });

    const llmConfigService = {
      loadConfiguration: jest.fn().mockResolvedValue(testLlmConfig),
    };
    const templateService = new PromptTemplateService({ logger });
    const dataFormatter = new PromptDataFormatter({ logger });

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService,
      dataFormatter,
    });
  });

  test('mood update prompt does NOT contain inner_state_integration', async () => {
    const dto = buildGameStateDto();
    const moodPromptData = await provider.getMoodUpdatePromptData(dto, logger);
    const moodPrompt = await promptBuilder.build('test-config', moodPromptData, {
      isMoodUpdatePrompt: true,
    });

    expect(moodPrompt).not.toContain('<inner_state_integration>');
    expect(moodPrompt).not.toContain('</inner_state_integration>');
    expect(moodPrompt).not.toContain(
      'INNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)'
    );
  });

  test('mood update prompt uses moodUpdateOnlyInstructionText content', async () => {
    const dto = buildGameStateDto();
    const moodPromptData = await provider.getMoodUpdatePromptData(dto, logger);
    const moodPrompt = await promptBuilder.build('test-config', moodPromptData, {
      isMoodUpdatePrompt: true,
    });

    // Should contain mood update specific content
    expect(moodPrompt).toContain('EMOTIONAL + SEXUAL STATE UPDATE');
    expect(moodPrompt).toContain('PRIMARY RULE (SUBJECTIVE APPRAISAL)');
  });
});

describe('Backward Compatibility in Assembled Prompt', () => {
  let logger;
  let provider;
  let promptBuilder;

  beforeEach(() => {
    logger = buildLogger();

    const characterDataXmlBuilder = new CharacterDataXmlBuilder({
      logger,
      xmlElementBuilder: new XmlElementBuilder({ logger }),
    });

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: buildPromptStaticContentService(),
      perceptionLogFormatter: new PerceptionLogFormatter({ logger }),
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
      actionCategorizationService: buildActionCategorizationService(),
      characterDataXmlBuilder,
      modActionMetadataProvider: {
        getMetadataForMod: jest.fn(() => null),
      },
      chanceTextTranslator: { translateForLlm: (text) => text },
    });

    const llmConfigService = {
      loadConfiguration: jest.fn().mockResolvedValue(testLlmConfig),
    };
    const templateService = new PromptTemplateService({ logger });
    const dataFormatter = new PromptDataFormatter({ logger });

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      templateService,
      dataFormatter,
    });
  });

  test('assembled prompt contains SPEECH CONTENT RULE section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('SPEECH CONTENT RULE (CRITICAL):');
    expect(prompt).toContain('Do NOT recap or summarize prior dialogue');
  });

  test('assembled prompt contains ACTION SELECTION section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('ACTION SELECTION:');
    expect(prompt).toContain(
      'Let emotions guide which action "feels right" in character'
    );
  });

  test('assembled prompt contains INTENSITY SCALING section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain(
      'INTENSITY SCALING (use emotional intensity labels as guides):'
    );
    expect(prompt).toContain('"faint/slight"');
    expect(prompt).toContain('"intense/powerful/overwhelming"');
  });

  test('assembled prompt contains NOTES RULES section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('NOTES RULES');
    expect(prompt).toContain('Only record brand-new, critical facts');
  });

  test('assembled prompt contains NOTE SUBJECT TYPES section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('NOTE SUBJECT TYPES (Select ONE per note):');
    expect(prompt).toContain('1. entity');
    expect(prompt).toContain('2. event');
    expect(prompt).toContain('3. plan');
    expect(prompt).toContain('4. knowledge');
    expect(prompt).toContain('5. state');
    expect(prompt).toContain('6. other');
  });

  test('assembled prompt contains CRITICAL DISTINCTION section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('CRITICAL DISTINCTION - THOUGHTS vs SPEECH:');
    expect(prompt).toContain(
      "MANDATORY RULE: The 'thoughts' and 'speech' fields MUST contain meaningfully different content"
    );
  });

  test('assembled prompt contains simplified THOUGHTS COLORING section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('THOUGHTS COLORING:');
    expect(prompt).toContain(
      'The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning.'
    );
  });

  test('assembled prompt does NOT contain old THOUGHTS COLORING examples', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).not.toContain(
      'Your internal monologue must REFLECT the listed emotions'
    );
    expect(prompt).not.toContain(
      'If feeling "fear: strong", thoughts should show anxiety, worry, threat assessment'
    );
    expect(prompt).not.toContain(
      'If feeling "curiosity: noticeable", thoughts should show interest, questions, investigation'
    );
  });

  test('assembled prompt does NOT contain old SPEECH COLORING section', async () => {
    const dto = buildGameStateDto();
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).not.toContain('Match emotional intensity to speech patterns:');
    expect(prompt).not.toContain(
      'High arousal emotions (anger, excitement, fear): Urgent, clipped, energetic speech'
    );
    expect(prompt).not.toContain(
      'Low arousal emotions (sadness, melancholy): Slower, quieter, more hesitant speech'
    );
  });
});
