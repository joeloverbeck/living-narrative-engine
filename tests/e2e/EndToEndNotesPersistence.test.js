/**
 * @file This test suite ensures that notes returned by a LLM get persisted properly.
 * @see tests/integration/EndToEndNotesPersistence.test.js
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { PromptStaticContentService } from '../../src/prompting/promptStaticContentService.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';
import { LLMResponseProcessor } from '../../src/turns/services/LLMResponseProcessor.js';
import { LlmJsonService } from '../../src/llms/llmJsonService.js';
import {
  LLM_TURN_ACTION_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
} from '../../src/turns/schemas/llmOutputSchemas.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../src/entities/entityInstanceData.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// Import for current template-based prompt builder
// No additional assembler imports needed

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Standard helper function to create entity instances for testing
const createTestEntity = (
  instanceId,
  definitionId,
  defComponents = {},
  instanceOverrides = {},
  logger = console
) => {
  const definition = new EntityDefinition(definitionId, {
    description: `Test Definition ${definitionId}`,
    components: defComponents,
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    definition,
    instanceOverrides,
    logger
  );
  return new Entity(instanceData);
};

const createActor = (id) => {
  const actorComponents = {
    [ACTOR_COMPONENT_ID]: {},
    [SHORT_TERM_MEMORY_COMPONENT_ID]: {
      thoughts: [],
      maxEntries: 4,
    },
    [NOTES_COMPONENT_ID]: { notes: [] },
  };
  // For this integration test, we create an entity with components directly as overrides,
  // as we're not testing definition inheritance but the actor's immediate state.
  return createTestEntity(id, 'test:actor-def', {}, actorComponents);
};

// Helper to build the final prompt from provider + builder + actor
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
  return builder.build('test-config', promptData);
};

describe('End-to-End Notes Persistence Flow', () => {
  let logger;
  let provider;
  let promptBuilder;
  let schemaValidator;
  let actor;
  let processor;

  // Remove obsolete prompt configuration - new system uses template-based prompts

  beforeEach(async () => {
    logger = makeLogger();
    actor = createActor('actor1');

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
      actionCategorizationService: {
        extractNamespace: jest.fn(),
        shouldUseGrouping: jest.fn().mockReturnValue(false),
        groupActionsByNamespace: jest.fn(),
        getSortedNamespaces: jest.fn(),
        formatNamespaceDisplayName: jest.fn(),
      },
      characterDataXmlBuilder: {
        buildCharacterDataXml: jest
          .fn()
          .mockReturnValue(
            '<character_data><identity><name>Test Character</name></identity></character_data>'
          ),
      },
    });

    const llmConfigService = {
      loadConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        modelIdentifier: 'test/model',
      }),
    };
    // Use current template-based PromptBuilder
    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
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
    processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
      llmJsonService: new LlmJsonService(),
    });
  });

  test('notes persist and appear in subsequent prompt', async () => {
    // first prompt: no notes yet
    const prompt1 = await buildPrompt(provider, promptBuilder, actor, logger);
    // The prompt should NOT contain the <notes> section when there are no notes (conditional formatting)
    expect(prompt1).not.toContain('<notes>');
    // Should not contain any actual notes content
    expect(prompt1).not.toContain('Remember the password');

    // simulate LLM response writing a note
    const response = {
      chosenIndex: 1,
      speech: '',
      thoughts: 'thinking',
      notes: [
        {
          text: 'Remember the password',
          subject: 'Password reminder',
          subjectType: 'concept',
        },
      ],
    };

    const processingResult = await processor.processResponse(
      JSON.stringify(response),
      actor.id
    );

    expect(processingResult.success).toBe(true);
    expect(processingResult.extractedData.notes).toEqual([
      {
        text: 'Remember the password',
        subject: 'Password reminder',
        subjectType: 'concept',
      },
    ]);

    // persist it on the entity
    if (processingResult.success && processingResult.extractedData.notes) {
      const currentNotesData = actor.getComponentData(NOTES_COMPONENT_ID) || {
        notes: [],
      };
      const newNoteObjects = processingResult.extractedData.notes.map(
        (note) => ({
          ...note,
          timestamp: new Date().toISOString(),
        })
      );

      const updatedNotesArray = [...currentNotesData.notes, ...newNoteObjects];
      actor.addComponent(NOTES_COMPONENT_ID, { notes: updatedNotesArray });
    }

    // now the entity has one note component
    const notesComp = actor.getComponentData(NOTES_COMPONENT_ID);
    expect(notesComp.notes).toHaveLength(1);
    expect(notesComp.notes[0].text).toBe('Remember the password');

    // second prompt should include the <notes> section
    const prompt2 = await buildPrompt(provider, promptBuilder, actor, logger);
    expect(prompt2).toContain('<notes>');
    expect(prompt2).toContain('- Remember the password');
  });
});
