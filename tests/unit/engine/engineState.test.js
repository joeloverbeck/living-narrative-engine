import { describe, it, expect } from '@jest/globals';
import EngineState from '../../../src/engine/engineState.js';

// tests/unit/engine/engineState.test.js

describe('EngineState', () => {
  it('setStarted should initialize and start the engine', () => {
    const state = new EngineState();

    state.setStarted('WorldA');

    expect(state.isInitialized).toBe(true);
    expect(state.isGameLoopRunning).toBe(true);
    expect(state.activeWorld).toBe('WorldA');
  });

  it('reset should clear all state flags', () => {
    const state = new EngineState();
    state.setStarted('WorldB');

    state.reset();

    expect(state.isInitialized).toBe(false);
    expect(state.isGameLoopRunning).toBe(false);
    expect(state.activeWorld).toBeNull();
  });
});
