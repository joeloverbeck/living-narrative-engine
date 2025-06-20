/* eslint-env node */
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { AssemblerRegistry } from '../../../src/prompting/assemblerRegistry.js';

/* ------------------------------------------------------------------------- */
/* Helpers & simple fakes                                                    */

/* ------------------------------------------------------------------------- */

class DummyAssembler {
  /**
   * @param {string} output - String returned by assemble()
   * @param {boolean} shouldThrow - If true, assemble() throws
   */
  constructor(output, shouldThrow = false) {
    this.output = output;
    this.shouldThrow = shouldThrow;
    this.assemble = jest.fn(this.assemble.bind(this));
  }

  assemble() {
    if (this.shouldThrow) {
      throw new Error('dummy assembler forced failure');
    }
    return this.output;
  }
}

// A minimal placeholder resolver that is effectively a no-op.
const passthroughPlaceholderResolver = {
  resolve: (s) => s,
};

/* ------------------------------------------------------------------------- */
/* Shared test data                                                          */
/* ------------------------------------------------------------------------- */

const TEST_LLM_ID = 'unit-llm';

const PROMPT_CONFIG = {
  configId: 'config-1',
  promptElements: [
    { key: 'elem1' },
    { key: 'elem2' },
    { key: 'elem3', condition: { promptDataFlag: 'includeElem3' } },
  ],
  promptAssemblyOrder: ['elem1', 'elem2', 'elem3'],
};

/* ------------------------------------------------------------------------- */
/* Test suite                                                                */
/* ------------------------------------------------------------------------- */

describe('PromptBuilder (orchestrator-only)', () => {
  let logger;
  let llmConfigService;
  let assemblerRegistry;
  let conditionEvaluator;
  let builder; // constructed fresh per test

  const makeBuilder = () =>
    new PromptBuilder({
      logger,
      llmConfigService,
      placeholderResolver: passthroughPlaceholderResolver,
      assemblerRegistry,
      conditionEvaluator,
    });

  /**
   * Registers three dummy assemblers (A, B, C) in the shared registry.
   *
   * @param opts
   */
  const registerAssemblersABC = (opts = {}) => {
    assemblerRegistry.register(
      'elem1',
      new DummyAssembler('A', opts.elem1Throws)
    );
    assemblerRegistry.register(
      'elem2',
      new DummyAssembler('B', opts.elem2Throws)
    );
    assemblerRegistry.register(
      'elem3',
      new DummyAssembler('C', opts.elem3Throws)
    );
  };

  beforeEach(() => {
    /* fresh spies each run */
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    llmConfigService = {
      /** @returns {Promise<object|null>} */
      getConfig: jest.fn(async (id) =>
        id === TEST_LLM_ID ? PROMPT_CONFIG : null
      ),
    };

    assemblerRegistry = new AssemblerRegistry();

    /* default: every condition passes */
    conditionEvaluator = {
      isElementConditionMet: jest.fn(() => true),
    };

    builder = makeBuilder();
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Happy-path concatenation                                                */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('concatenates assembler outputs in the declared order', async () => {
    registerAssemblersABC();

    const prompt = await builder.build(TEST_LLM_ID, { includeElem3: true });

    expect(prompt).toBe('ABC');
    expect(assemblerRegistry.resolve('elem1').assemble).toHaveBeenCalledTimes(
      1
    );
    expect(assemblerRegistry.resolve('elem2').assemble).toHaveBeenCalledTimes(
      1
    );
    expect(assemblerRegistry.resolve('elem3').assemble).toHaveBeenCalledTimes(
      1
    );
    expect(conditionEvaluator.isElementConditionMet).toHaveBeenCalledTimes(3);
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Conditional element skipping                                            */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('skips elements whose condition is not met', async () => {
    registerAssemblersABC();

    /* Custom condition logic: respect the includeElem3 flag */
    conditionEvaluator.isElementConditionMet.mockImplementation(
      (cond, data) => {
        if (!cond) return true; // unconditional elements pass
        return Boolean(data[cond.promptDataFlag]);
      }
    );

    const prompt = await builder.build(TEST_LLM_ID, { includeElem3: false });

    expect(prompt).toBe('AB'); // C omitted
    expect(assemblerRegistry.resolve('elem3').assemble).not.toHaveBeenCalled();
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Registry resolution failures                                            */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('throws when an assembler key is missing in the registry', async () => {
    assemblerRegistry.register('elem1', new DummyAssembler('A'));
    // elem2 intentionally *not* registered
    assemblerRegistry.register('elem3', new DummyAssembler('C'));

    await expect(
      builder.build(TEST_LLM_ID, { includeElem3: true })
    ).rejects.toThrow("No assembler registered for 'elem2'");
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Element-level assembler errors are surfaced via logger, prompt builds   */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('continues building when an assembler throws, logs aggregated error', async () => {
    registerAssemblersABC({ elem2Throws: true });

    const prompt = await builder.build(TEST_LLM_ID, { includeElem3: true });

    expect(prompt).toBe('AC'); // B failed but others present
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed during assembly'),
      expect.any(Object)
    );
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Guard clauses & edge-cases                                             */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('returns empty string when llmConfigService returns null', async () => {
    llmConfigService.getConfig.mockResolvedValueOnce(null);

    const prompt = await builder.build('unknown-llm', {});

    expect(prompt).toBe('');
  });

  test('build returns empty string for bad inputs (null promptData)', async () => {
    registerAssemblersABC();

    const prompt = await builder.build(TEST_LLM_ID, null);

    expect(prompt).toBe('');
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Constructor dependency validation                                       */
  /* ──────────────────────────────────────────────────────────────────────── */

  test('constructor throws when a required dependency is missing', () => {
    expect(
      () =>
        new PromptBuilder({
          // llmConfigService omitted on purpose
          logger,
          placeholderResolver: passthroughPlaceholderResolver,
          assemblerRegistry,
          conditionEvaluator,
        })
    ).toThrow(/LLMConfigService/);
  });
});
