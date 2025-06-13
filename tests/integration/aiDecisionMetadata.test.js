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
import { AIDecisionOrchestrator } from '../../src/turns/orchestration/aiDecisionOrchestrator.js';

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

    promptPipeline = { generatePrompt: jest.fn().mockResolvedValue('PROMPT') };
    llmAdapter = { getAIDecision: jest.fn().mockResolvedValue('{"ok":1}') };
    responseProcessor = {
      processResponse: jest.fn().mockResolvedValue({
        success: true,
        action: { chosenIndex: 3, speech: 'hello' },
        extractedData: { thoughts: 'thinking', notes: ['n1', 'n2'] },
      }),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

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

// ---------------------------------------------------------------------------
// 2. INTEGRATION – AIDecisionOrchestrator.decide ----------------------------
// ---------------------------------------------------------------------------

describe('AIDecisionOrchestrator.decide – metadata bubbles up', () => {
  let discoverySvc;
  let indexer;
  let llmChooser;
  let turnActionFactory;
  let fallbackFactory;
  let logger;
  /** @type {AIDecisionOrchestrator} */
  let orchestrator;

  beforeEach(() => {
    jest.clearAllMocks();

    discoverySvc = {
      getValidActions: jest
        .fn()
        .mockResolvedValue([{ id: 'DEF', command: 'CMD', params: {} }]),
    };

    indexer = { index: jest.fn().mockReturnValue([fakeComposite(1)]) };

    llmChooser = {
      choose: jest.fn().mockResolvedValue({
        index: 1,
        speech: 'spoken',
        thoughts: 'deep thoughts',
        notes: ['note‑a'],
      }),
    };

    turnActionFactory = {
      create: jest.fn().mockReturnValue({ type: 'ACTION' }),
    };
    fallbackFactory = {
      create: jest.fn().mockReturnValue({ type: 'FALLBACK' }),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    orchestrator = new AIDecisionOrchestrator({
      discoverySvc,
      indexer,
      llmChooser,
      turnActionFactory,
      fallbackFactory,
      logger,
    });
  });

  it('produces extractedData with speech, thoughts, notes', async () => {
    const res = await orchestrator.decide({
      actor: fakeActor('ai‑2'),
      context: fakeContext(),
    });

    expect(res).toEqual({
      kind: 'success',
      action: { type: 'ACTION' },
      extractedData: {
        speech: 'spoken',
        thoughts: 'deep thoughts',
        notes: ['note‑a'],
      },
    });
  });
});
