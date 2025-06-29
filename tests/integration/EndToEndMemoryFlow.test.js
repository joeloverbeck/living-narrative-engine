/**
 * @file Tests the end to end flow of memory for an AI.
 * @see tests/integration/EndToEndMemoryFlow.test.js
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolverUtils.js';
import { PromptStaticContentService } from '../../src/prompting/promptStaticContentService.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';
import { LLMResponseProcessor } from '../../src/turns/services/LLMResponseProcessor.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../../src/constants/componentIds.js';
import {
  LLM_TURN_ACTION_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
} from '../../src/turns/schemas/llmOutputSchemas.js';

// New imports for builder adjustments
import { AssemblerRegistry } from '../../src/prompting/assemblerRegistry.js';
import * as ConditionEvaluator from '../../src/prompting/elementConditionEvaluator.js';
import ThoughtsSectionAssembler, {
  THOUGHTS_WRAPPER_KEY,
} from '../../src/prompting/assembling/thoughtsSectionAssembler.js';

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createNewCharacter = (id) => ({
  id,
  components: {
    [SHORT_TERM_MEMORY_COMPONENT_ID]: {
      thoughts: [],
      maxEntries: 10,
      entityId: id,
    },
    'core:name': { name: 'Test' },
  },
});

const buildPromptForCharacter = async (
  provider,
  builder,
  character,
  logger
) => {
  const gameStateDto = {
    actorState: character,
    currentUserInput: '',
    perceptionLog: [],
    currentLocation: { name: 'Nowhere' },
    availableActions: [],
  };

  const promptData = await provider.getPromptData(gameStateDto, logger);
  return builder.build('thoughts_only', promptData);
};

describe('End-to-End Short-Term Memory Flow', () => {
  let logger;
  let provider;
  let promptBuilder;
  let schemaValidator;
  let responseProcessor;
  let character;

  const testConfig = {
    configId: 'thoughts_only',
    modelIdentifier: 'test/model',
    promptElements: [
      {
        key: 'thoughts_wrapper',
        elementType: 'thoughts_section',
        prefix: '\nYour most recent thoughts (oldest first):\n\n',
        suffix: '\n',
      },
    ],
    promptAssemblyOrder: ['thoughts_wrapper'],
  };

  beforeEach(async () => {
    logger = mockLogger();
    character = createNewCharacter('char1');

    const promptService = new PromptStaticContentService({
      logger,
      promptTextLoader: {
        loadPromptText: jest.fn().mockResolvedValue({
          coreTaskDescriptionText: 'c',
          characterPortrayalGuidelinesTemplate: 'g {{name}}',
          nc21ContentPolicyText: 'p',
          finalLlmInstructionText: 'f',
        }),
      },
    });
    await promptService.initialize();

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: promptService,
      perceptionLogFormatter: { format: jest.fn().mockReturnValue([]) },
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
    });

    const llmConfigService = {
      getConfig: jest.fn().mockResolvedValue(testConfig),
    };
    const placeholderResolver = new PlaceholderResolver(logger);

    // Build and register only the thoughts_wrapper assembler
    const assemblerRegistry = new AssemblerRegistry();
    assemblerRegistry.register(
      THOUGHTS_WRAPPER_KEY,
      new ThoughtsSectionAssembler({ logger })
    );

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      placeholderResolver,
      assemblerRegistry,
      conditionEvaluator: ConditionEvaluator,
    });

    schemaValidator = new AjvSchemaValidator({
      logger: logger,
      preloadSchemas: [
        {
          schema: LLM_TURN_ACTION_RESPONSE_SCHEMA,
          id: LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
        },
      ],
    });
    const safeEventDispatcher = { dispatch: jest.fn() };
    responseProcessor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
  });

  test('thought persists and appears in next prompt', async () => {
    const prompt1 = await buildPromptForCharacter(
      provider,
      promptBuilder,
      character,
      logger
    );
    expect(prompt1.includes('Your most recent thoughts')).toBe(false);

    const mockResponse = {
      chosenIndex: 1,
      speech: 'Hello',
      thoughts: 'FirstThought',
    };

    const processingResult = await responseProcessor.processResponse(
      JSON.stringify(mockResponse),
      character.id
    );

    expect(processingResult.success).toBe(true);
    expect(processingResult.extractedData.thoughts).toBe('FirstThought');

    if (processingResult.success && processingResult.extractedData.thoughts) {
      const mem = character.components[SHORT_TERM_MEMORY_COMPONENT_ID];
      mem.thoughts.push({
        text: processingResult.extractedData.thoughts,
        timestamp: new Date().toISOString(),
      });
    }

    const mem = character.components[SHORT_TERM_MEMORY_COMPONENT_ID];
    expect(mem.thoughts.length).toBe(1);
    expect(mem.thoughts[0].text).toBe('FirstThought');

    const prompt2 = await buildPromptForCharacter(
      provider,
      promptBuilder,
      character,
      logger
    );

    const expected =
      '\nYour most recent thoughts (oldest first):\n\n- FirstThought\n';

    expect(prompt2).toBe(expected);
  });
});
