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
import { createMockLogger } from '../common/mockFactories.js';

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
  let twoPhaseOrchestrator;
  let logger;
  /** @type {LLMChooser} */
  let chooser;

  beforeEach(() => {
    jest.clearAllMocks();

    twoPhaseOrchestrator = {
      orchestrate: jest.fn().mockResolvedValue({
        index: 3,
        speech: 'hello',
        thoughts: 'thinking',
        notes: ['n1', 'n2'],
        moodUpdate: null,
        sexualUpdate: null,
      }),
    };
    logger = createMockLogger();

    chooser = new LLMChooser({
      twoPhaseOrchestrator,
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
      moodUpdate: null,
      sexualUpdate: null,
    });
  });

  it('returns notes:null when they are omitted', async () => {
    twoPhaseOrchestrator.orchestrate.mockResolvedValueOnce({
      index: 2,
      speech: 'hi',
      thoughts: 'pondering',
      notes: null,
      moodUpdate: null,
      sexualUpdate: null,
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
      moodUpdate: null,
      sexualUpdate: null,
    });
  });
});
