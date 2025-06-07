/**
 * @file tests/promptBuilder.test.js
 * @description
 *   Verifies that PromptBuilder.build(...) does not throw and does not insert
 *   notes/goals sections when promptData.notesArray and promptData.goalsArray are missing.
 */

import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { NotesSectionAssembler } from '../../src/prompting/assembling/notesSectionAssembler.js';
import { GoalsSectionAssembler } from '../../src/prompting/assembling/goalsSectionAssembler.js';
import { beforeAll, describe, expect, test } from '@jest/globals';

// ── Dummy No-Op Assemblers ─────────────────────────────────────────────────────────
class DummyStandardElementAssembler {
  assemble(cfg, promptData, placeholderResolver, allPromptElementsMap) {
    // Always return a fixed string so we know it was called
    return '[STANDARD_ELEMENT]\n';
  }
}

class DummyPerceptionLogAssembler {
  assemble(cfg, promptData, placeholderResolver, allPromptElementsMap) {
    return '[PERCEPTION_LOG]\n';
  }
}

class DummyThoughtsSectionAssembler {
  assemble(cfg, promptData, placeholderResolver, allPromptElementsMap) {
    return '[THOUGHTS]\n';
  }
}

// ── Dummy PlaceholderResolver ────────────────────────────────────────────────────
class DummyPlaceholderResolver {
  resolve(templateString, promptData) {
    // For this test, just return the template unchanged
    return templateString;
  }
}

// ── Stub LLMConfigService ────────────────────────────────────────────────────────
class StubLLMConfigService {
  /**
   * Pretend to fetch a configuration that has two elements: notes_wrapper and goals_wrapper
   * and places them in the assembly order (no other elements).
   *
   * @param llmId
   */
  async getConfig(llmId) {
    return {
      configId: 'stubConfig',
      promptElements: [
        {
          key: 'notes_wrapper',
          prefix: '', // no prefix/suffix needed
          suffix: '',
          // No condition object, always “true”
        },
        {
          key: 'goals_wrapper',
          prefix: '',
          suffix: '',
          // Always include (no condition)
        },
      ],
      promptAssemblyOrder: ['notes_wrapper', 'goals_wrapper'],
    };
  }
}

describe('PromptBuilder – missing notesArray/goalsArray', () => {
  const dummyPlaceholderResolver = new DummyPlaceholderResolver();
  const stubLLMConfigService = new StubLLMConfigService();

  const notesAssembler = new NotesSectionAssembler({
    logger: {
      warn: () => {},
      error: () => {},
      info: () => {},
      debug: () => {},
    },
  });
  const goalsAssembler = new GoalsSectionAssembler({
    logger: {
      warn: () => {},
      error: () => {},
      info: () => {},
      debug: () => {},
    },
  });

  // We still need to pass dummy implementations for standard/perception/thoughts,
  // even though our config only references notes_wrapper and goals_wrapper.
  const standardAsm = new DummyStandardElementAssembler();
  const perceptionAsm = new DummyPerceptionLogAssembler();
  const thoughtsAsm = new DummyThoughtsSectionAssembler();

  let builder;

  beforeAll(() => {
    builder = new PromptBuilder({
      logger: {
        warn: () => {},
        error: () => {},
        info: () => {},
        debug: () => {},
      },
      llmConfigService: stubLLMConfigService,
      placeholderResolver: dummyPlaceholderResolver,
      standardElementAssembler: standardAsm,
      perceptionLogAssembler: perceptionAsm,
      thoughtsSectionAssembler: thoughtsAsm,
      notesSectionAssembler: notesAssembler,
      goalsSectionAssembler: goalsAssembler,
    });
  });

  test('build() with empty promptData should not inject notes or goals sections', async () => {
    const promptData = {}; // no notesArray or goalsArray
    let result;
    let threw = false;

    try {
      result = await builder.build('anything', promptData);
    } catch (err) {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(typeof result).toBe('string');

    // Should not contain either section header
    expect(result).not.toContain('<notes>:');
    expect(result).not.toContain('<goals>:');
  });
});
