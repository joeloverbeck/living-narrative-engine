/**
 * @file This test suite ensures that notes returned by a LLM get persisted properly.
 * @see tests/integration/EndToEndNotesPersistence.test.js
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolverUtils.js';
import { PromptStaticContentService } from '../../src/prompting/promptStaticContentService.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';
import { LLMResponseProcessor } from '../../src/turns/services/LLMResponseProcessor.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../src/entities/entityInstanceData.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// NEW imports for the refactored PromptBuilder
import { AssemblerRegistry } from '../../src/prompting/assemblerRegistry.js';
import * as ConditionEvaluator from '../../src/prompting/elementConditionEvaluator.js';
import NotesSectionAssembler, {
  NOTES_WRAPPER_KEY,
} from '../../src/prompting/assembling/notesSectionAssembler.js';

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
      maxEntries: 10,
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
  return builder.build('notes_only', promptData);
};

describe('End-to-End Notes Persistence Flow', () => {
  let logger;
  let provider;
  let promptBuilder;
  let schemaValidator;
  let actor;
  let processor;

  const testConfig = {
    configId: 'notes_only',
    modelIdentifier: 'test/model',
    promptElements: [
      {
        key: 'notes_wrapper',
        elementType: 'notes_section',
        prefix: '<notes>\n',
        suffix: '\n',
      },
    ],
    promptAssemblyOrder: ['notes_wrapper'],
  };

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
    });

    const llmConfigService = {
      getConfig: jest.fn().mockResolvedValue(testConfig),
    };
    const placeholderResolver = new PlaceholderResolver(logger);

    // ──────────────────────────────────────────────────────────────────────────
    // Build a minimal AssemblerRegistry for 'notes_wrapper'
    // ──────────────────────────────────────────────────────────────────────────
    const assemblerRegistry = new AssemblerRegistry();
    assemblerRegistry.register(
      NOTES_WRAPPER_KEY,
      new NotesSectionAssembler({ logger })
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Use the new PromptBuilder signature (assemblerRegistry + evaluator)
    // ──────────────────────────────────────────────────────────────────────────
    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      placeholderResolver,
      assemblerRegistry,
      conditionEvaluator: ConditionEvaluator,
    });

    schemaValidator = new AjvSchemaValidator(logger);
    const safeEventDispatcher = { dispatch: jest.fn() };
    processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
  });

  test('notes persist and appear in subsequent prompt', async () => {
    // first prompt: no notes yet
    const prompt1 = await buildPrompt(provider, promptBuilder, actor, logger);
    expect(prompt1).not.toContain('<notes>');

    // simulate LLM response writing a note
    const response = {
      chosenIndex: 1,
      speech: '',
      thoughts: 'thinking',
      notes: ['Remember the password'],
    };

    const processingResult = await processor.processResponse(
      JSON.stringify(response),
      actor.id
    );

    expect(processingResult.success).toBe(true);
    expect(processingResult.extractedData.notes).toEqual([
      'Remember the password',
    ]);

    // persist it on the entity
    if (processingResult.success && processingResult.extractedData.notes) {
      const currentNotesData = actor.getComponentData(NOTES_COMPONENT_ID) || {
        notes: [],
      };
      const newNoteObjects = processingResult.extractedData.notes.map(
        (text) => ({
          text,
          timestamp: new Date().toISOString(), // Consistent with potential schema
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
