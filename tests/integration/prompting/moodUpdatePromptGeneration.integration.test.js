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

const buildPromptStaticContentService = () => ({
  getCoreTaskDescriptionText: () => corePromptText.coreTaskDescriptionText,
  getCharacterPortrayalGuidelines: (name) =>
    corePromptText.characterPortrayalGuidelinesTemplate.replace(
      /\{\{name\}\}/g,
      name
    ),
  getNc21ContentPolicyText: () => corePromptText.nc21ContentPolicyText,
  getFinalLlmInstructionText: () => corePromptText.finalLlmInstructionText,
  getMoodUpdateInstructionText: () => corePromptText.moodUpdateOnlyInstructionText,
  getMoodUpdateTaskDefinitionText: () => corePromptText.moodUpdateTaskDefinitionText,
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
  actorName: 'Rina Volkov',
  actorId: 'actor-1',
  currentUserInput: '',
  currentLocation: {
    locationId: 'dock-1',
    name: 'Harbor Dock',
    description: 'A wind-cut dock with wet planks and iron cleats.',
    exits: [],
    characters: [],
  },
  availableActions: [],
  perceptionLog: [],
  actorPromptData: {
    name: 'Rina Volkov',
    description: 'A watchful smuggler with a careful cadence.',
    personality: 'Reserved but sharp, keeps notes on threats.',
    emotionalState: {
      emotionalStateText: 'tension: high, vigilance: steady',
      sexualStateText: 'guarded: low',
      moodAxes: {
        valence: -12,
        arousal: 33,
        agency_control: -5,
        threat: 40,
        engagement: 20,
        future_expectancy: -10,
        self_evaluation: -15,
        affiliation: 15,
      },
      sexVariables: {
        sex_excitation: 10,
        sex_inhibition: 70,
      },
    },
  },
  actorState: {
    components: {
      'core:short_term_memory': {
        thoughts: [{ text: 'Keep eyes on the pier.', timestamp: '2024-01-01' }],
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

describe('Mood update prompt generation', () => {
  let logger;
  let provider;
  let promptBuilder;

  beforeEach(() => {
    logger = buildLogger();

    const characterDataXmlBuilder = new CharacterDataXmlBuilder({
      logger,
      xmlElementBuilder: new XmlElementBuilder(),
    });

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: buildPromptStaticContentService(),
      perceptionLogFormatter: new PerceptionLogFormatter({ logger }),
      gameStateValidationService: {
        validate: jest.fn(() => ({ isValid: true, errorContent: null })),
      },
      actionCategorizationService: buildActionCategorizationService(),
      characterDataXmlBuilder,
      modActionMetadataProvider: { getMetadataForMod: jest.fn(() => null) },
      chanceTextTranslator: { translateForLlm: (text) => text },
    });

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService: {
        loadConfiguration: jest.fn(async () => ({
          configId: 'test-config',
          displayName: 'Test LLM',
          modelIdentifier: 'test-model',
          endpointUrl: 'https://test.api',
          apiType: 'test',
          jsonOutputStrategy: { method: 'test' },
        })),
      },
      templateService: new PromptTemplateService({ logger }),
      dataFormatter: new PromptDataFormatter({ logger }),
    });
  });

  test('builds mood update prompt with mood-specific sections and inner_state axes', async () => {
    const promptData = await provider.getMoodUpdatePromptData(
      buildGameStateDto(),
      logger
    );
    const prompt = await promptBuilder.build('test-llm', promptData, {
      isMoodUpdatePrompt: true,
    });

    expect(prompt).toContain('CHARACTER LENS');
    expect(prompt).toContain('Update mood axes and sexual state values');
    expect(prompt).toContain('Rina Volkov');
    expect(prompt).toContain('<mood_axes>');
    expect(prompt).toContain('valence: -12');
    expect(prompt).toContain('<sex_variables>');
    expect(prompt).toContain('sex_excitation: 10');
    expect(prompt).toContain(
      'Every emotion, thought, action, and word stems from this.'
    );
    expect(prompt).toContain('<thoughts>');
    expect(prompt).toContain('- Keep eyes on the pier.');
    expect(prompt).not.toContain('INNER VOICE GUIDANCE');
    expect(prompt).not.toContain('NOTES WRITING GUIDANCE');
    expect(prompt).not.toContain('<available_actions_info>');
  });

  test('action prompts omit mood axes and sex variables', async () => {
    const promptData = await provider.getPromptData(buildGameStateDto(), logger);
    const prompt = await promptBuilder.build('test-llm', promptData);

    expect(prompt).toContain('<character_persona>');
    expect(prompt).not.toContain('<mood_axes>');
    expect(prompt).not.toContain('<sex_variables>');
  });

  test('mood update prompt includes affiliation axis in mood_axes', async () => {
    const promptData = await provider.getMoodUpdatePromptData(
      buildGameStateDto(),
      logger
    );
    const prompt = await promptBuilder.build('test-llm', promptData, {
      isMoodUpdatePrompt: true,
    });

    expect(prompt).toContain('<mood_axes>');
    expect(prompt).toContain('affiliation: 15');
  });

  test('mood update instructions mention affiliation axis', async () => {
    const promptData = await provider.getMoodUpdatePromptData(
      buildGameStateDto(),
      logger
    );
    const prompt = await promptBuilder.build('test-llm', promptData, {
      isMoodUpdatePrompt: true,
    });

    // The prompt should contain the affiliation axis definition from corePromptText
    expect(prompt).toMatch(/affiliation/i);
    expect(prompt).toMatch(/warm.*connected|connected.*warm/i);
  });
});
