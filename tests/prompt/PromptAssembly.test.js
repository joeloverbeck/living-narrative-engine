import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../src/services/AIPromptContentProvider.js';
import { PromptBuilder } from '../../src/services/promptBuilder.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolver.js';
import { ThoughtsSectionAssembler } from '../../src/services/promptElementAssemblers/thoughtsSectionAssembler.js';

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('Prompt Assembly with short-term memory', () => {
  /** @type {AIPromptContentProvider} */
  let provider;
  /** @type {PromptBuilder} */
  let promptBuilder;
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {jest.Mocked<any>} */
  let llmConfigService;

  const testConfig = {
    configId: 'thoughts_only',
    modelIdentifier: 'test/model',
    promptElements: [{ key: 'thoughts_wrapper' }],
    promptAssemblyOrder: ['thoughts_wrapper'],
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

    const placeholderResolver = new PlaceholderResolver(logger);

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler: { assemble: jest.fn().mockReturnValue('') },
      perceptionLogAssembler: { assemble: jest.fn().mockReturnValue('') },
      thoughtsSectionAssembler: new ThoughtsSectionAssembler({ logger }),
    });
  });

  const buildPrompt = async (thoughtsArray) => {
    const gameStateDto = {
      actorState: {
        id: 'actor1',
        components: {
          'core:short_term_memory': {
            thoughts: thoughtsArray.map((t) => ({ text: t })),
          },
        },
      },
      actorPromptData: { name: 'Test Actor' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: undefined,
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);
    return promptBuilder.build('thoughts_only', promptData);
  };

  test('Entity with zero thoughts omits the section', async () => {
    const prompt = await buildPrompt([]);
    expect(prompt.includes('Your most recent thoughts')).toBe(false);
    expect(prompt).toBe('');
  });

  test('Entity with one thought includes the formatted section', async () => {
    const prompt = await buildPrompt(['OnlyThought']);
    const expected =
      '\n' +
      'Your most recent thoughts (oldest first):\n' +
      '\n' +
      '- OnlyThought\n' +
      '\n';
    expect(prompt).toBe(expected);
    expect((prompt.match(/Your most recent thoughts/g) || []).length).toBe(1);
  });

  test('Entity with multiple thoughts lists them oldest to newest', async () => {
    const prompt = await buildPrompt(['T1', 'T2', 'T3']);
    const expected =
      '\n' +
      'Your most recent thoughts (oldest first):\n' +
      '\n' +
      '- T1\n' +
      '- T2\n' +
      '- T3\n' +
      '\n';
    expect(prompt).toBe(expected);
    expect(prompt.indexOf('- T1')).toBeLessThan(prompt.indexOf('- T2'));
    expect(prompt.indexOf('- T2')).toBeLessThan(prompt.indexOf('- T3'));
  });
});

// --- FILE END ---
