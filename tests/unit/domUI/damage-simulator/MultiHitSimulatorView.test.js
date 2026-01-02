/**
 * @file MultiHitSimulatorView.test.js
 * @description Unit tests for MultiHitSimulatorView component
 */

import MultiHitSimulatorView from '../../../../src/domUI/damage-simulator/MultiHitSimulatorView.js';

describe('MultiHitSimulatorView', () => {
  const defaults = {
    HIT_COUNT: 10,
    DELAY_MS: 100,
    TARGET_MODE: 'random',
    MIN_HITS: 1,
    MAX_HITS: 100,
    MIN_DELAY: 0,
    MAX_DELAY: 1000,
  };

  const createView = (container) => {
    const logger = {
      error: jest.fn(),
    };
    return { view: new MultiHitSimulatorView(container, logger), logger };
  };

  it('should accept a container element', () => {
    const container = document.createElement('div');
    const { view } = createView(container);
    expect(view).toBeInstanceOf(MultiHitSimulatorView);
  });

  it('should handle null container gracefully', () => {
    const { view } = createView(null);
    expect(() => view.render(defaults)).not.toThrow();
    expect(() => view.bindEventListeners()).not.toThrow();
    expect(() => view.updateProgress({})).not.toThrow();
    expect(() => view.updateResults({})).not.toThrow();
    expect(() => view.updateControlsState(false)).not.toThrow();
    expect(() => view.updateFocusPartOptions([])).not.toThrow();
  });

  describe('render', () => {
    it('should create progress bar, results panel, controls, and inputs', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);

      expect(container.querySelector('.ds-sim-progress')).not.toBeNull();
      expect(container.querySelector('.ds-sim-results')).not.toBeNull();
      expect(container.querySelector('#ds-sim-run-btn')).not.toBeNull();
      expect(container.querySelector('#ds-sim-stop-btn')).not.toBeNull();
      expect(container.querySelector('#ds-hit-count')).not.toBeNull();
      expect(container.querySelector('#ds-hit-delay-slider')).not.toBeNull();
    });
  });

  describe('bindEventListeners', () => {
    it('should bind run and stop button handlers', async () => {
      const container = document.createElement('div');
      const { view } = createView(container);
      const onRun = jest.fn().mockResolvedValue(undefined);
      const onStop = jest.fn();

      view.render(defaults);
      view.bindEventListeners({ onRun, onStop });

      container.querySelector('#ds-hit-count').value = '3';
      container.querySelector('#ds-hit-delay-slider').value = '0';
      container.querySelector('#ds-sim-run-btn').click();

      await Promise.resolve();
      expect(onRun).toHaveBeenCalledWith({
        hitCount: 3,
        delayMs: 0,
        targetMode: 'random',
        focusPartId: null,
      });

      const stopBtn = container.querySelector('#ds-sim-stop-btn');
      stopBtn.disabled = false;
      stopBtn.click();
      expect(onStop).toHaveBeenCalled();
    });

    it('should update delay text on slider input', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      view.bindEventListeners({ onRun: jest.fn(), onStop: jest.fn() });

      const slider = container.querySelector('#ds-hit-delay-slider');
      const delayValue = container.querySelector('#ds-hit-delay-value');

      slider.value = '250';
      slider.dispatchEvent(new Event('input'));

      expect(delayValue.textContent).toBe('250ms');
    });

    it('should toggle focus select when target mode changes', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      view.bindEventListeners({ onRun: jest.fn(), onStop: jest.fn() });

      const focusSelect = container.querySelector('#ds-sim-focus-part');
      const focusRadio = container.querySelector(
        'input[name="ds-sim-target-mode"][value="focus"]'
      );
      const randomRadio = container.querySelector(
        'input[name="ds-sim-target-mode"][value="random"]'
      );

      focusRadio.dispatchEvent(new Event('change'));
      expect(focusSelect.disabled).toBe(false);

      randomRadio.dispatchEvent(new Event('change'));
      expect(focusSelect.disabled).toBe(true);
    });

    it('should not throw when focus select is missing on mode change', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      container.querySelector('#ds-sim-focus-part').remove();
      view.bindEventListeners({ onRun: jest.fn(), onStop: jest.fn() });

      const focusRadio = container.querySelector(
        'input[name="ds-sim-target-mode"][value="focus"]'
      );

      expect(() => {
        focusRadio.dispatchEvent(new Event('change'));
      }).not.toThrow();
    });

    it('should log and skip run when required elements are missing', () => {
      const container = document.createElement('div');
      const { view, logger } = createView(container);
      const onRun = jest.fn();

      view.render(defaults);
      container.querySelector('#ds-hit-count').remove();

      view.bindEventListeners({ onRun });
      container.querySelector('#ds-sim-run-btn').click();

      expect(logger.error).toHaveBeenCalledWith(
        '[MultiHitSimulator] Missing UI elements'
      );
      expect(onRun).not.toHaveBeenCalled();
    });

    it('should not throw when progress or results elements are missing', () => {
      const container = document.createElement('div');
      const { view } = createView(container);
      const onRun = jest.fn();

      view.render(defaults);
      container.querySelector('.ds-sim-progress').remove();
      container.querySelector('.ds-sim-results').remove();

      view.bindEventListeners({ onRun, onStop: jest.fn() });
      container.querySelector('#ds-hit-count').value = '1';
      container.querySelector('#ds-hit-delay-slider').value = '0';

      expect(() => {
        container.querySelector('#ds-sim-run-btn').click();
      }).not.toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should update progress bar width and text', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      view.updateProgress({
        currentHit: 4,
        totalHits: 4,
        percentComplete: 100,
        status: 'running',
      });

      expect(
        container.querySelector('.ds-progress-fill').style.width
      ).toBe('100%');
      expect(container.querySelector('.ds-progress-text').textContent).toBe(
        '4 / 4 hits'
      );
    });

    it('should handle missing progress elements', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      container.querySelector('.ds-progress-fill').remove();
      container.querySelector('.ds-progress-text').remove();

      expect(() => {
        view.updateProgress({
          currentHit: 1,
          totalHits: 2,
          percentComplete: 50,
          status: 'running',
        });
      }).not.toThrow();
    });
  });

  describe('updateResults', () => {
    it('should display hits, damage, duration, and average', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      view.updateResults({
        hitsExecuted: 3,
        totalDamage: 30,
        durationMs: 125,
      });

      expect(container.querySelector('.ds-sim-results').hidden).toBe(false);
      expect(container.querySelector('#ds-result-hits').textContent).toBe('3');
      expect(container.querySelector('#ds-result-damage').textContent).toBe(
        '30.0'
      );
      expect(container.querySelector('#ds-result-duration').textContent).toBe(
        '125ms'
      );
      expect(container.querySelector('#ds-result-avg').textContent).toBe(
        '10.00'
      );
    });

    it('should handle missing result elements', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      container.querySelector('#ds-result-damage').remove();
      container.querySelector('#ds-result-avg').remove();

      expect(() => {
        view.updateResults({
          hitsExecuted: 2,
          totalDamage: 0,
          durationMs: 10,
        });
      }).not.toThrow();
    });
  });

  describe('updateControlsState', () => {
    it('should toggle run/stop disabled states', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      view.updateControlsState(true);

      expect(container.querySelector('#ds-sim-run-btn').disabled).toBe(true);
      expect(container.querySelector('#ds-sim-stop-btn').disabled).toBe(false);

      view.updateControlsState(false);
      expect(container.querySelector('#ds-sim-run-btn').disabled).toBe(false);
      expect(container.querySelector('#ds-sim-stop-btn').disabled).toBe(true);
    });
  });

  describe('updateFocusPartOptions', () => {
    it('should populate dropdown with parts', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      view.updateFocusPartOptions([
        { id: 'part-head', name: 'Head' },
        { id: 'part-arm', name: 'Arm' },
      ]);

      const options = container.querySelectorAll('#ds-sim-focus-part option');
      expect(options.length).toBe(3);
      expect(options[1].value).toBe('part-head');
      expect(options[1].textContent).toBe('Head');
    });

    it('should handle empty parts or missing select', () => {
      const container = document.createElement('div');
      const { view } = createView(container);

      view.render(defaults);
      container.querySelector('#ds-sim-focus-part').remove();

      expect(() => view.updateFocusPartOptions([])).not.toThrow();
    });
  });
});
