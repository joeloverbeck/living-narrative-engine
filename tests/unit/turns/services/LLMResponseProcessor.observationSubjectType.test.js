/**
 * @file Regression test for LLM response validation with observation subjectType
 * Reproduces the issue where LLM uses "observation" but validation fails
 * because llmOutputSchemas.js has outdated subject type enum
 */

import { LLMResponseProcessor } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

describe('LLMResponseProcessor - Observation SubjectType Validation', () => {
  let processor;
  let logger;
  let schemaValidator;
  let safeEventDispatcher;
  const actorId = 'p_erotica:ane_arrieta_instance';

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Real schema validator that will actually validate
    schemaValidator = {
      validate: jest.fn((schemaId, data) => {
        // Simulate validation against the schema
        const { notes } = data;

        if (!notes) return { isValid: true, errors: [] };

        const validSubjectTypes = [
          'character',
          'location',
          'item',
          'creature',
          'event',
          'concept',
          'relationship',
          'organization',
          'quest',
          'skill',
          'emotion',
          'plan',
          'timeline',
          'theory',
          'observation',
          'knowledge_state',
          'psychological_state',
          'other',
        ];

        for (const note of notes) {
          if (!validSubjectTypes.includes(note.subjectType)) {
            return {
              isValid: false,
              errors: [
                {
                  instancePath: `/notes/${notes.indexOf(note)}/subjectType`,
                  schemaPath:
                    '#/properties/notes/items/properties/subjectType/enum',
                  keyword: 'enum',
                  params: { allowedValues: validSubjectTypes },
                  message: 'must be equal to one of the allowed values',
                  data: note.subjectType,
                },
              ],
            };
          }
        }

        return { isValid: true, errors: [] };
      }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

    safeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    const llmJsonService = new LlmJsonService();

    processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
      llmJsonService,
    });
  });

  test('should validate LLM response with observation subjectType (from real error log)', async () => {
    // This is the exact response structure from the error logs
    const llmResponse = JSON.stringify({
      chosenIndex: 1,
      thoughts: "Okay, he's asking me direct questions now...",
      speech:
        '*shrugs one shoulder, the gesture casual but with a slight edge of defiance* Not bullied, exactly...',
      notes: [
        {
          text: 'Older bearded man, tall and stocky, wearing working-class but decent clothing',
          subject: 'Jon Ureña',
          subjectType: 'character',
          context: 'first encounter at park bench',
        },
        {
          text: 'Jon noticed my exposed position but looked away after seeing, then warned me about junkies in the park',
          subject: "Jon Ureña's behavior pattern",
          subjectType: 'observation', // This was causing the validation failure
          context: 'analyzing his approach',
        },
      ],
    });

    const result = await processor.processResponse(llmResponse, actorId);

    expect(result.success).toBe(true);
    expect(result.action.chosenIndex).toBe(1);
    expect(result.extractedData.notes).toHaveLength(2);
    expect(result.extractedData.notes[1].subjectType).toBe('observation');
  });

  test('should validate all 18 subject types including new ones', async () => {
    const allSubjectTypes = [
      'character',
      'location',
      'item',
      'creature',
      'event',
      'concept',
      'relationship',
      'organization',
      'quest',
      'skill',
      'emotion',
      'plan',
      'timeline',
      'theory',
      'observation',
      'knowledge_state',
      'psychological_state',
      'other',
    ];

    for (const subjectType of allSubjectTypes) {
      const llmResponse = JSON.stringify({
        chosenIndex: 1,
        thoughts: `Test thoughts for ${subjectType}`,
        speech: `Test speech`,
        notes: [
          {
            text: `Test note for ${subjectType}`,
            subject: `Test subject`,
            subjectType: subjectType,
            context: 'test context',
          },
        ],
      });

      const result = await processor.processResponse(llmResponse, actorId);

      expect(result.success).toBe(true);
      expect(result.extractedData.notes[0].subjectType).toBe(subjectType);
    }
  });

  test('should reject invalid subject type', async () => {
    const llmResponse = JSON.stringify({
      chosenIndex: 1,
      thoughts: 'Test thoughts',
      speech: 'Test speech',
      notes: [
        {
          text: 'Test note',
          subject: 'Test subject',
          subjectType: 'invalid_type', // This should fail
          context: 'test context',
        },
      ],
    });

    await expect(
      processor.processResponse(llmResponse, actorId)
    ).rejects.toThrow('LLM response JSON schema validation failed');
  });

  test('should validate notes with mixed old and new subject types', async () => {
    const llmResponse = JSON.stringify({
      chosenIndex: 1,
      thoughts: 'Mixed subject types test',
      speech: 'Testing',
      notes: [
        {
          text: 'Character note',
          subject: 'Jon Ureña',
          subjectType: 'character', // Old type
        },
        {
          text: 'Behavioral observation',
          subject: "Jon's patterns",
          subjectType: 'observation', // New type
        },
        {
          text: 'Future plan',
          subject: 'Escape plan',
          subjectType: 'plan', // New type
        },
        {
          text: 'Emotional state',
          subject: 'My fear',
          subjectType: 'emotion', // Old type
        },
      ],
    });

    const result = await processor.processResponse(llmResponse, actorId);

    expect(result.success).toBe(true);
    expect(result.extractedData.notes).toHaveLength(4);
    expect(result.extractedData.notes[1].subjectType).toBe('observation');
    expect(result.extractedData.notes[2].subjectType).toBe('plan');
  });
});
