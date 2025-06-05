// tests/promptBuilderGoalsSection.test.js

/**
 * Integration tests for PromptBuilder with GoalsSectionAssembler
 */

import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { GoalsSectionAssembler } from '../../src/prompting/assembling/goalsSectionAssembler.js';
import { beforeEach, describe, expect, test } from '@jest/globals';

// Dummy stub for StandardElementAssembler (never used in these tests)
class StubStandardAssembler {
  assemble() {
    return '';
  }
}

// Dummy stub for PerceptionLogAssembler
class StubPerceptionAssembler {
  assemble() {
    return '';
  }
}

// Dummy stub for ThoughtsSectionAssembler
class StubThoughtsAssembler {
  assemble() {
    return '';
  }
}

// Dummy stub for NotesSectionAssembler
class StubNotesAssembler {
  assemble() {
    return '';
  }
}

// Simple placeholder resolver that returns the string unchanged
class IdentityPlaceholderResolver {
  resolve(str) {
    return str;
  }
}

// Minimal “LLMConfigService” stub for getConfig(...)
class DummyLLMConfigService {
  constructor(config) {
    this._config = config;
  }

  async getConfig(_llmId) {
    // Always return the same config, ignoring input llmId
    return this._config;
  }
}

describe('PromptBuilder → GoalsSectionAssembler integration', () => {
  const CONFIG = {
    configId: 'testConfig',
    promptElements: [
      {
        key: 'goals_wrapper',
        prefix: '\nYour Goals:\n',
        suffix: '\n',
      },
    ],
    promptAssemblyOrder: ['goals_wrapper'],
  };

  let promptBuilder;

  beforeEach(() => {
    const llmConfigService = new DummyLLMConfigService(CONFIG);
    const placeholderResolver = new IdentityPlaceholderResolver();
    const standardAssembler = new StubStandardAssembler();
    const perceptionAssembler = new StubPerceptionAssembler();
    const thoughtsAssembler = new StubThoughtsAssembler();
    const notesAssembler = new StubNotesAssembler();
    const goalsAssembler = new GoalsSectionAssembler({
      logger: {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
      },
    });

    promptBuilder = new PromptBuilder({
      logger: console,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler: standardAssembler,
      perceptionLogAssembler: perceptionAssembler,
      thoughtsSectionAssembler: thoughtsAssembler,
      notesSectionAssembler: notesAssembler,
      goalsSectionAssembler: goalsAssembler,
    });
  });

  test('Non‐empty goalsArray should include "Your Goals:" section', async () => {
    const promptData = {
      goalsArray: [
        { text: 'G1', timestamp: '2025-01-01T00:00:00Z' },
        { text: 'G2', timestamp: '2025-02-01T00:00:00Z' },
      ],
    };

    const result = await promptBuilder.build('anyLlmId', promptData);

    const occurrences = result.match(/Your Goals:/g) || [];
    expect(occurrences.length).toBe(1);
    expect(result).toContain('- G1');
    expect(result).toContain('- G2');
    // The result should begin with a newline (from prefix)
    expect(result.startsWith('\n')).toBe(true);
  });

  test('Empty goalsArray should produce an empty string (no "Your Goals:")', async () => {
    const promptData = {
      goalsArray: [],
    };

    const result = await promptBuilder.build('anyLlmId', promptData);

    expect(result).toBe('');
  });

  test('Missing goalsArray yields an empty result', async () => {
    const promptData = {}; // no goalsArray key

    const result = await promptBuilder.build('anyLlmId', promptData);

    expect(result).toBe('');
  });
});
