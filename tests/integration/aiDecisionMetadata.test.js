/*
 * aiDecisionMetadata.test.js
 * ---------------------------------------------------------------------------
 * Jest‑only regression tests that guarantee the LLM metadata (speech, thoughts,
 * optional notes) is propagated intact from the LLM layer up to
 * AIPlayerStrategy consumers.
 *
 * IMPORTANT – Adjust the import paths (⚠️ PATH‑TO …) so they match your repo.
 * ---------------------------------------------------------------------------
 */

// --- Jest globals -----------------------------------------------------------
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// --- System Under Test imports ---------------------------------------------
// ⚠️ PATH‑TO – please fix to real locations in your project
import { LLMChooser } from '../../src/turns/adapters/llmChooser.js';
import {
  createMockLogger,
  createMockAIPromptPipeline,
} from '../common/mockFactories.js';

// ---------------------------------------------------------------------------
// Lightweight helpers (no behaviour)
// ---------------------------------------------------------------------------
const fakeActor = (id = 'ai‑1') => ({ id });
const fakeContext = () => ({ getPromptSignal: () => undefined });
const fakeComposite = (idx = 1) => ({ index: idx, command: `CMD_${idx}` });

// ---------------------------------------------------------------------------
// 1. UNIT – LLMChooser.choose ------------------------------------------------
// ---------------------------------------------------------------------------
describe('LLMChooser.choose – metadata propagation', () => {
  let promptPipeline;
  let llmAdapter;
  let responseProcessor;
  let logger;
  /** @type {LLMChooser} */
  let chooser;

  beforeEach(() => {
    jest.clearAllMocks();

    promptPipeline = createMockAIPromptPipeline();
    promptPipeline.generatePrompt.mockResolvedValue('PROMPT');
    llmAdapter = { getAIDecision: jest.fn().mockResolvedValue('{"ok":1}') };
    responseProcessor = {
      processResponse: jest.fn().mockResolvedValue({
        success: true,
        action: { chosenIndex: 3, speech: 'hello' },
        extractedData: { thoughts: 'thinking', notes: ['n1', 'n2'] },
      }),
    };
    logger = createMockLogger();

    chooser = new LLMChooser({
      promptPipeline,
      llmAdapter,
      responseProcessor,
      logger,
    });
  });

  it('returns speech + thoughts + notes when present', async () => {
    const out = await chooser.choose({
      actor: fakeActor('joe'),
      context: fakeContext(),
      actions: [fakeComposite(1), fakeComposite(2), fakeComposite(3)],
    });

    expect(out).toEqual({
      index: 3,
      speech: 'hello',
      thoughts: 'thinking',
      notes: ['n1', 'n2'],
    });
  });

  it('returns notes:null when they are omitted', async () => {
    responseProcessor.processResponse.mockResolvedValueOnce({
      success: true,
      action: { chosenIndex: 2, speech: 'hi' },
      extractedData: { thoughts: 'pondering' },
    });

    const out = await chooser.choose({
      actor: fakeActor('jane'),
      context: fakeContext(),
      actions: [fakeComposite(1), fakeComposite(2)],
    });

    expect(out).toEqual({
      index: 2,
      speech: 'hi',
      thoughts: 'pondering',
      notes: null,
    });
  });
});
