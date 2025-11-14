import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  VisualizerState,
  VISUALIZER_STATES,
} from '../../../src/domUI/visualizer/VisualizerState.js';

/**
 * These integration tests exercise the VisualizerState in conjunction with its
 * observable workflow to make sure the production implementation behaves the
 * same way a consumer such as VisualizerStateController would expect. The
 * tests intentionally avoid mocks for the state object so that observers and
 * transitions execute exactly as they do in production.
 */
describe('VisualizerState integration behavior', () => {
  let visualizerState;

  beforeEach(() => {
    visualizerState = new VisualizerState();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('orchestrates the full lifecycle and notifies observers with real snapshots', () => {
    const snapshots = [];
    const unsubscribe = visualizerState.subscribe((snapshot) =>
      snapshots.push({ ...snapshot })
    );

    visualizerState.selectEntity('entity-42');
    expect(visualizerState.getSelectedEntity()).toBe('entity-42');
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.LOADING);

    const anatomyData = { recipeId: 'humanoid', body: { root: 'spine' } };
    visualizerState.setAnatomyData(anatomyData);
    expect(visualizerState.getAnatomyData()).toBe(anatomyData);
    expect(visualizerState.getError()).toBeNull();

    visualizerState.startRendering();
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.RENDERING);

    visualizerState.completeRendering();
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.READY);

    const renderFailure = new Error('renderer failed');
    visualizerState.setError(renderFailure);
    expect(visualizerState.getError()).toBe(renderFailure);
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.ERROR);

    visualizerState.retry();
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.LOADING);
    expect(visualizerState.getError()).toBeNull();

    visualizerState.reset();
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.IDLE);
    expect(visualizerState.getSelectedEntity()).toBeNull();
    expect(visualizerState.getAnatomyData()).toBeNull();
    expect(visualizerState.getError()).toBeNull();

    unsubscribe();

    expect(snapshots.map((snapshot) => snapshot.currentState)).toEqual([
      VISUALIZER_STATES.LOADING,
      VISUALIZER_STATES.LOADED,
      VISUALIZER_STATES.RENDERING,
      VISUALIZER_STATES.READY,
      VISUALIZER_STATES.ERROR,
      VISUALIZER_STATES.LOADING,
      VISUALIZER_STATES.IDLE,
    ]);
    expect(snapshots[0].selectedEntity).toBe('entity-42');
    expect(snapshots[1].anatomyData).toBe(anatomyData);
  });

  it('enforces validation rules and prevents invalid transitions', () => {
    expect(() => visualizerState.selectEntity('')).toThrow(
      'Entity ID must be a non-empty string'
    );
    expect(() => visualizerState.setAnatomyData(null)).toThrow(
      'Anatomy data must be a non-null object'
    );
    expect(() => visualizerState.setError('boom')).toThrow(
      'Error must be an Error instance'
    );
    expect(() => visualizerState.subscribe('not-a-function')).toThrow(
      'Observer must be a function'
    );

    expect(() => visualizerState.startRendering()).toThrow(
      'Invalid state transition from IDLE to RENDERING'
    );
    expect(() => visualizerState.completeRendering()).toThrow(
      'Invalid state transition from IDLE to READY'
    );

    visualizerState.selectEntity('entity-validation');
    expect(() => visualizerState.completeRendering()).toThrow(
      'Invalid state transition from LOADING to READY'
    );

    visualizerState.setAnatomyData({ body: { root: 'spine' } });
    expect(() => visualizerState.completeRendering()).toThrow(
      'Invalid state transition from LOADED to READY'
    );

    const bootstrapError = new Error('bootstrap failure');
    visualizerState.reset();
    visualizerState.setError(bootstrapError);
    expect(() => visualizerState.retry()).toThrow(
      'Cannot retry without previous entity selection'
    );

    visualizerState.reset();
    visualizerState.selectEntity('entity-for-retry');
    visualizerState.setError(new Error('needs retry'));
    visualizerState.retry();
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.LOADING);
    expect(visualizerState.getError()).toBeNull();
  });

  it('cleans up observers, logs observer failures, and guards disposed instances', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const stableObserver = jest.fn();
    const unsubscribeStable = visualizerState.subscribe(stableObserver);
    const throwingObserver = jest.fn(() => {
      throw new Error('observer failure');
    });
    const unsubscribeThrowing = visualizerState.subscribe(throwingObserver);

    visualizerState.selectEntity('entity-logs');
    expect(warnSpy).toHaveBeenCalledWith(
      'Observer error in VisualizerState:',
      expect.any(Error)
    );
    expect(stableObserver).toHaveBeenCalledTimes(1);

    unsubscribeStable();
    unsubscribeThrowing();
    warnSpy.mockClear();

    const secondObserver = jest.fn();
    const unsubscribeSecond = visualizerState.subscribe(secondObserver);
    visualizerState.setAnatomyData({ body: { root: 'spine' } });
    expect(secondObserver).toHaveBeenCalled();
    unsubscribeSecond();

    visualizerState.dispose();
    expect(() => visualizerState.getCurrentState()).toThrow(
      'VisualizerState has been disposed'
    );
    expect(() => visualizerState.selectEntity('entity-after-dispose')).toThrow(
      'VisualizerState has been disposed'
    );
    expect(() => visualizerState.subscribe(() => {})).toThrow(
      'VisualizerState has been disposed'
    );

    visualizerState.dispose();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
