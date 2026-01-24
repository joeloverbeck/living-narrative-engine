/**
 * @file Integration tests for cognitive ledger prompt generation.
 * Verifies that cognitive ledger content flows through the prompt pipeline
 * and appears in the correct position relative to perception log and thoughts.
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

const buildGameStateDto = (includeLedger = true) => ({
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
  perceptionLog: [
    { type: 'visual', content: 'A detail in the room.' },
    { type: 'audio', content: 'A faint hum.' },
  ],
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
        thoughts: [{ text: 'Stay focused.', timestamp: '2024-01-01' }],
      },
      'core:notes': {
        notes: [],
      },
      'core:goals': {
        goals: [],
      },
      ...(includeLedger
        ? {
            'core:cognitive_ledger': {
              settled_conclusions: ['The room is empty.'],
              open_questions: ['What powers the hum?'],
            },
          }
        : {}),
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

describe('Cognitive ledger prompt generation', () => {
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

  test('prompt includes cognitive_ledger section when component present', async () => {
    const dto = buildGameStateDto(true);
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).toContain('<cognitive_ledger>');
    expect(prompt).toContain('</cognitive_ledger>');
  });

  test('prompt omits cognitive_ledger section when component absent', async () => {
    const dto = buildGameStateDto(false);
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    expect(prompt).not.toContain('<cognitive_ledger>');
  });

  test('cognitive_ledger section appears between perception log and thoughts', async () => {
    const dto = buildGameStateDto(true);
    const promptData = await provider.getPromptData(dto, logger);
    const prompt = await promptBuilder.build('test-config', promptData);

    const perceptionCloseIndex = prompt.indexOf('</perception_log>');
    const ledgerOpenIndex = prompt.indexOf('<cognitive_ledger>');
    const thoughtsOpenIndex = prompt.indexOf('<thoughts>');

    expect(perceptionCloseIndex).toBeGreaterThan(-1);
    expect(ledgerOpenIndex).toBeGreaterThan(perceptionCloseIndex);
    expect(thoughtsOpenIndex).toBeGreaterThan(ledgerOpenIndex);
  });
});
