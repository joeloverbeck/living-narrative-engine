// tests/prompting/promptBuilder.notesSection.test.js

import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import NotesSectionAssembler from '../../src/prompting/assembling/notesSectionAssembler.js';
import ThoughtsSectionAssembler from '../../src/prompting/assembling/thoughtsSectionAssembler.js';
import { PerceptionLogAssembler } from '../../src/prompting/assembling/perceptionLogAssembler.js';
import { StandardElementAssembler } from '../../src/prompting/assembling/standardElementAssembler.js';
import { GoalsSectionAssembler } from '../../src/prompting/assembling/goalsSectionAssembler.js';
import { IndexedChoicesAssembler } from '../../src/prompting/assembling/indexedChoicesAssembler.js';
import { beforeAll, describe, expect, test } from '@jest/globals';

/**
 * Integration tests for PromptBuilder with NotesSectionAssembler
 */
describe('PromptBuilder – NotesSectionAssembler integration', () => {
  // A fake LLMConfigService that returns a minimal config
  class FakeLlmConfigService {
    async getConfig(llmId) {
      if (llmId !== 'test-llm') return null;
      return {
        configId: 'test-llm',
        promptElements: [
          { key: 'intro', prefix: 'Hello:\n', suffix: '\n', condition: null },
          {
            key: 'notes_wrapper',
            prefix: '<notes>:',
            suffix: '\n',
            condition: null,
          },
          { key: 'outro', prefix: '\nGoodbye.', suffix: '', condition: null },
        ],
        promptAssemblyOrder: ['intro', 'notes_wrapper', 'outro'],
      };
    }
  }

  let builder;

  beforeAll(() => {
    const llmConfigService = new FakeLlmConfigService();
    const placeholderResolver = { resolve: (template, _data) => template };
    const standardAssembler = new StandardElementAssembler({ logger: console });
    const perceptionAssembler = new PerceptionLogAssembler({ logger: console });
    const thoughtsAssembler = new ThoughtsSectionAssembler({ logger: console });
    const notesAssembler = new NotesSectionAssembler({ logger: console });
    const goalsAssembler = new GoalsSectionAssembler({ logger: console });
    const indexedChoicesAssembler = new IndexedChoicesAssembler({
      logger: console,
    });

    builder = new PromptBuilder({
      logger: console,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler: standardAssembler,
      perceptionLogAssembler: perceptionAssembler,
      thoughtsSectionAssembler: thoughtsAssembler,
      notesSectionAssembler: notesAssembler,
      goalsSectionAssembler: goalsAssembler,
      indexedChoicesAssembler,
    });
  });

  test('includes "<notes>:" and bullet when notesArray is non-empty', async () => {
    const promptData = {
      notesArray: [
        { text: 'Remember the keycode', timestamp: '2025-06-01T12:00:00Z' },
      ],
    };

    const result = await builder.build('test-llm', promptData);
    const occurrences = result.match(/<notes>:/g) || [];
    expect(occurrences.length).toBe(1);
    expect(result).toContain('- Remember the keycode');
    expect(result.startsWith('Hello:\n')).toBe(true);
    expect(result.trim().endsWith('Goodbye.')).toBe(true);
  });

  test('omits notes section entirely when notesArray is empty', async () => {
    const promptData = { notesArray: [] };
    const result = await builder.build('test-llm', promptData);
    expect(result).not.toContain('<notes>:');
    expect(result).toBe('Hello:\n\n\nGoodbye.');
  });

  test('omits notes section when notesArray is missing', async () => {
    const promptData = {};
    const result = await builder.build('test-llm', promptData);
    expect(result).not.toContain('<notes>:');
    expect(result).toBe('Hello:\n\n\nGoodbye.');
  });
});
