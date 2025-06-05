// tests/LLMResponseProcessor.e2e.test.js
/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../src/prompting/promptBuilder.js';
import { PlaceholderResolver } from '../src/utils/placeholderResolver.js';
import { StandardElementAssembler } from '../src/prompting/assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from '../src/prompting/assembling/perceptionLogAssembler.js';
import { ThoughtsSectionAssembler } from '../src/prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler from '../src/prompting/assembling/notesSectionAssembler.js';
import GoalsSectionAssembler from '../src/prompting/assembling/goalsSectionAssembler.js';
import AjvSchemaValidator from '../src/validation/ajvSchemaValidator.js';
import { LLMResponseProcessor } from '../src/turns/services/LLMResponseProcessor.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('LLMResponseProcessor end-to-end notes flow', () => {
  let provider;
  let promptBuilder;
  let schemaValidator;
  let processor;
  let actorEntity;
  let entityManager;
  let providerLogger;
  beforeEach(() => {
    providerLogger = makeLogger();
    provider = new AIPromptContentProvider({
      logger: providerLogger,
      promptStaticContentService: {
        getCoreTaskDescriptionText: () => 'TASK',
        getCharacterPortrayalGuidelines: () => 'GUIDE',
        getNc21ContentPolicyText: () => 'POLICY',
        getFinalLlmInstructionText: () => 'FINAL',
      },
      perceptionLogFormatter: { format: jest.fn().mockReturnValue([]) },
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
    });

    const llmConfigService = {
      getConfig: jest.fn().mockResolvedValue({
        configId: 'notes_only',
        modelIdentifier: 'test/model',
        promptElements: [{ key: 'notes_wrapper' }],
        promptAssemblyOrder: ['notes_wrapper'],
      }),
    };
    const placeholderResolver = new PlaceholderResolver(providerLogger);
    promptBuilder = new PromptBuilder({
      logger: providerLogger,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler: new StandardElementAssembler({
        logger: providerLogger,
      }),
      perceptionLogAssembler: new PerceptionLogAssembler({
        logger: providerLogger,
      }),
      thoughtsSectionAssembler: new ThoughtsSectionAssembler({
        logger: providerLogger,
      }),
      notesSectionAssembler: new NotesSectionAssembler({
        logger: providerLogger,
      }),
      goalsSectionAssembler: new GoalsSectionAssembler({
        logger: providerLogger,
      }),
    });

    schemaValidator = new AjvSchemaValidator(providerLogger);

    actorEntity = {
      id: 'actor1',
      components: {
        'core:notes': {
          notes: [{ text: 'Old1', timestamp: '2025-01-01T00:00:00Z' }],
        },
        'core:goals': {
          goals: [{ text: 'G_old', timestamp: '2025-01-01T00:00:00Z' }],
        },
        'core:short_term_memory': {
          thoughts: [],
          maxEntries: 10,
          entityId: 'actor1',
        },
      },
    };

    entityManager = {
      getComponentData: jest.fn((id, key) => actorEntity.components[key]),
      getEntityInstance: jest.fn(() => actorEntity),
      addComponent: jest.fn((id, key, payload) => {
        actorEntity.components[key] = payload;
      }),
      saveEntity: jest.fn().mockResolvedValue(),
    };

    processor = new LLMResponseProcessor({ schemaValidator, entityManager });
  });

  test('merges new notes from LLM and skips duplicates and invalid entries', async () => {
    const logger = makeLogger();

    const gameStateDto = {
      actorState: { id: actorEntity.id, components: actorEntity.components },
      actorPromptData: { name: 'Tester' },
      perceptionLog: [],
      currentLocation: {
        name: 'Room',
        description: 'Desc',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };
    const promptData = await provider.getPromptData(gameStateDto, logger);
    const prompt = await promptBuilder.build('notes_only', promptData);
    expect(prompt.includes('Old1')).toBe(true);

    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2025-06-01T12:00:00Z')
      .mockReturnValueOnce('2025-06-01T12:00:00Z');

    const fakeJson = JSON.stringify({
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: '',
      thoughts: 'I need to remember something new.',
      notes: ['New1', 'old1', ' '],
    });

    const result = await processor.processResponse(
      fakeJson,
      actorEntity.id,
      logger
    );

    expect(result).toEqual({
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: '',
    });

    const notes = actorEntity.components['core:notes'].notes;
    expect(notes).toEqual([
      { text: 'Old1', timestamp: '2025-01-01T00:00:00Z' },
      { text: 'New1', timestamp: '2025-06-01T12:00:00Z' },
    ]);
    expect(notes).toHaveLength(2);

    expect(actorEntity.components['core:goals'].goals).toEqual([
      { text: 'G_old', timestamp: '2025-01-01T00:00:00Z' },
    ]);

    const addedLogs = logger.info.mock.calls.filter((c) =>
      String(c[0]).includes('Added note: "New1"')
    );
    expect(addedLogs).toHaveLength(1);
    expect(addedLogs[0][0]).toMatch(
      /Added note: "New1" at 2025-06-01T12:00:00Z/
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toMatch(/Invalid note skipped/);

    expect(entityManager.addComponent).not.toHaveBeenCalledWith(
      actorEntity.id,
      'core:goals',
      expect.anything()
    );
  });
});
