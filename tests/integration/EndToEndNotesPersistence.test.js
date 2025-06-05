import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolver.js';
import { StandardElementAssembler } from '../../src/prompting/assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from '../../src/prompting/assembling/perceptionLogAssembler.js';
import { ThoughtsSectionAssembler } from '../../src/prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler from '../../src/prompting/assembling/notesSectionAssembler.js';
import { PromptStaticContentService } from '../../src/prompting/promptStaticContentService.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../../src/turns/schemas/llmOutputSchemas.js';
import { LLMResponseProcessor } from '../../src/turns/services/LLMResponseProcessor.js';
import Entity from '../../src/entities/entity.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createActor = (id) => {
  const e = new Entity(id, 'test:actor');
  e.addComponent(ACTOR_COMPONENT_ID, {});
  e.addComponent(SHORT_TERM_MEMORY_COMPONENT_ID, {
    thoughts: [],
    maxEntries: 10,
  });
  e.addComponent(NOTES_COMPONENT_ID, { notes: [] });
  return e;
};

const buildPrompt = async (provider, builder, actor, logger) => {
  const dto = {
    actorState: {
      id: actor.id,
      components: {
        [NOTES_COMPONENT_ID]: actor.getComponentData(NOTES_COMPONENT_ID),
        [SHORT_TERM_MEMORY_COMPONENT_ID]: actor.getComponentData(
          SHORT_TERM_MEMORY_COMPONENT_ID
        ),
      },
    },
    actorPromptData: { name: 'Tester' },
    currentUserInput: '',
    perceptionLog: [],
    currentLocation: {
      name: 'Nowhere',
      description: 'Empty',
      exits: [],
      characters: [],
    },
    availableActions: [],
  };
  const promptData = await provider.getPromptData(dto, logger);
  return builder.build('notes_only', promptData);
};

describe('End-to-End Notes Persistence Flow', () => {
  let logger;
  let provider;
  let promptBuilder;
  let schemaValidator;
  let actor;
  let entityManager;
  let processor;

  const testConfig = {
    configId: 'notes_only',
    modelIdentifier: 'test/model',
    promptElements: [
      {
        key: 'notes_wrapper',
        prefix: '\nImportant Things to Remember:\n',
        suffix: '\n',
      },
    ],
    promptAssemblyOrder: ['notes_wrapper'],
  };

  beforeEach(() => {
    logger = makeLogger();
    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: new PromptStaticContentService({ logger }),
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
    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler: new StandardElementAssembler({ logger }),
      perceptionLogAssembler: new PerceptionLogAssembler({ logger }),
      thoughtsSectionAssembler: new ThoughtsSectionAssembler({ logger }),
      notesSectionAssembler: new NotesSectionAssembler({ logger }),
    });

    schemaValidator = new AjvSchemaValidator(logger);
    actor = createActor('actor1');
    entityManager = {
      getEntityInstance: jest.fn().mockReturnValue(actor),
      addComponent: jest.fn((id, compId, data) => {
        if (id === actor.id) actor.addComponent(compId, data);
      }),
      saveEntity: jest.fn().mockResolvedValue(undefined),
    };
    processor = new LLMResponseProcessor({ schemaValidator, entityManager });
  });

  test('notes persist and appear in subsequent prompt', async () => {
    const prompt1 = await buildPrompt(provider, promptBuilder, actor, logger);
    expect(prompt1).not.toContain('Important Things to Remember');

    const response = {
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: '',
      thoughts: 'thinking',
      notes: ['Remember the password'],
    };

    const validation = schemaValidator.validate(
      LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
      response
    );
    expect(validation.isValid).toBe(true);

    await processor.processResponse(JSON.stringify(response), actor.id, logger);

    const notesComp = actor.getComponentData(NOTES_COMPONENT_ID);
    expect(notesComp.notes).toHaveLength(1);

    const prompt2 = await buildPrompt(provider, promptBuilder, actor, logger);
    expect(prompt2).toContain('Important Things to Remember');
    expect(prompt2).toContain('- Remember the password');
  });
});
