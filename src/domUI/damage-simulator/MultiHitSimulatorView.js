/**
 * @file MultiHitSimulatorView.js
 * @description Handles DOM rendering and event binding for multi-hit simulation.
 */

class MultiHitSimulatorView {
  /** @type {HTMLElement|null} */
  #containerElement;

  /** @type {Object} */
  #eventHandlers;

  /** @type {Object} */
  #logger;

  /**
   * @param {HTMLElement|null} containerElement - DOM container
   * @param {Object} logger - Logger instance
   */
  constructor(containerElement, logger = console) {
    this.#containerElement = containerElement;
    this.#logger = logger;
    this.#eventHandlers = {};
  }

  /**
   * Renders the simulation UI.
   * @param {Object} defaults - Simulation defaults
   */
  render(defaults) {
    if (!this.#containerElement) return;

    this.#containerElement.innerHTML = `
      <div class="ds-multi-hit-simulator">
        <h4>Multi-Hit Simulation</h4>

        <!-- Configuration -->
        <div class="ds-sim-config">
          <div class="ds-form-group">
            <label for="ds-hit-count">Number of Hits</label>
            <input type="number" id="ds-hit-count"
                   min="${defaults.MIN_HITS}"
                   max="${defaults.MAX_HITS}"
                   value="${defaults.HIT_COUNT}">
          </div>

          <div class="ds-form-group">
            <label for="ds-hit-delay">Delay Between Hits</label>
            <input type="range" id="ds-hit-delay-slider"
                   min="${defaults.MIN_DELAY}"
                   max="${defaults.MAX_DELAY}"
                   value="${defaults.DELAY_MS}">
            <span id="ds-hit-delay-value">${defaults.DELAY_MS}ms</span>
          </div>

          <fieldset class="ds-target-mode-fieldset">
            <legend>Target Mode</legend>
            <label>
              <input type="radio" name="ds-sim-target-mode" value="random" checked>
              Random (weighted)
            </label>
            <label>
              <input type="radio" name="ds-sim-target-mode" value="round-robin">
              Round-Robin
            </label>
            <label>
              <input type="radio" name="ds-sim-target-mode" value="focus">
              Focus Part:
              <select id="ds-sim-focus-part" disabled>
                <option value="">Select...</option>
              </select>
            </label>
          </fieldset>
        </div>

        <!-- Controls -->
        <div class="ds-sim-controls">
          <button id="ds-sim-run-btn" class="ds-button ds-button--primary">&#9658; Run Simulation</button>
          <button id="ds-sim-stop-btn" class="ds-button ds-button--danger" disabled>&#9632; Stop</button>
        </div>

        <!-- Progress -->
        <div class="ds-sim-progress" hidden>
          <div class="ds-progress-bar">
            <div class="ds-progress-fill" style="width: 0%"></div>
          </div>
          <span class="ds-progress-text">0 / ${defaults.HIT_COUNT} hits</span>
        </div>

        <!-- Results -->
        <div class="ds-sim-results" hidden>
          <h5>Simulation Results</h5>
          <div class="ds-results-grid">
            <div class="ds-result-item">
              <span class="ds-result-label">Hits Executed</span>
              <span class="ds-result-value" id="ds-result-hits">--</span>
            </div>
            <div class="ds-result-item">
              <span class="ds-result-label">Total Damage</span>
              <span class="ds-result-value" id="ds-result-damage">--</span>
            </div>
            <div class="ds-result-item">
              <span class="ds-result-label">Duration</span>
              <span class="ds-result-value" id="ds-result-duration">--</span>
            </div>
            <div class="ds-result-item">
              <span class="ds-result-label">Avg Damage/Hit</span>
              <span class="ds-result-value" id="ds-result-avg">--</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Binds event handlers for UI controls.
   * @param {Object} handlers - { onRun, onStop }
   */
  bindEventListeners(handlers = {}) {
    this.#eventHandlers = handlers;
    const container = this.#containerElement;

    if (!container || !container.querySelector) return;

    // Delay slider value display
    const delaySlider = container.querySelector('#ds-hit-delay-slider');
    const delayValue = container.querySelector('#ds-hit-delay-value');
    if (delaySlider && delayValue) {
      delaySlider.addEventListener('input', (e) => {
        delayValue.textContent = `${e.target.value}ms`;
      });
    }

    // Target mode radio buttons
    const targetModeRadios = container.querySelectorAll(
      'input[name="ds-sim-target-mode"]'
    );
    const focusPartSelect = container.querySelector('#ds-sim-focus-part');

    targetModeRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (focusPartSelect) {
          focusPartSelect.disabled = e.target.value !== 'focus';
        }
      });
    });

    // Run button
    const runBtn = container.querySelector('#ds-sim-run-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.#handleRunClick());
    }

    // Stop button
    const stopBtn = container.querySelector('#ds-sim-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (this.#eventHandlers.onStop) {
          this.#eventHandlers.onStop();
        }
      });
    }
  }

  /**
   * Updates progress display.
   * @param {Object} progress - Simulation progress
   */
  updateProgress(progress) {
    const container = this.#containerElement;
    if (!container || !container.querySelector) return;

    const progressFill = container.querySelector('.ds-progress-fill');
    const progressText = container.querySelector('.ds-progress-text');

    if (progressFill) {
      progressFill.style.width = `${progress.percentComplete}%`;
    }

    if (progressText) {
      progressText.textContent = `${progress.currentHit} / ${progress.totalHits} hits`;
    }
  }

  /**
   * Updates results display.
   * @param {Object} results - Simulation results
   */
  updateResults(results) {
    const container = this.#containerElement;
    if (!container || !container.querySelector) return;

    const resultsEl = container.querySelector('.ds-sim-results');

    if (resultsEl) {
      resultsEl.hidden = false;

      const hitsEl = container.querySelector('#ds-result-hits');
      const damageEl = container.querySelector('#ds-result-damage');
      const durationEl = container.querySelector('#ds-result-duration');
      const avgEl = container.querySelector('#ds-result-avg');

      if (hitsEl) hitsEl.textContent = results.hitsExecuted.toString();
      if (damageEl) damageEl.textContent = results.totalDamage.toFixed(1);
      if (durationEl) durationEl.textContent = `${results.durationMs}ms`;
      if (avgEl) {
        const avg = results.totalDamage / results.hitsExecuted;
        avgEl.textContent = avg.toFixed(2);
      }
    }
  }

  /**
   * Updates control states (enabled/disabled).
   * @param {boolean} isRunning
   */
  updateControlsState(isRunning) {
    const container = this.#containerElement;
    if (!container || !container.querySelector) return;

    const runBtn = container.querySelector('#ds-sim-run-btn');
    const stopBtn = container.querySelector('#ds-sim-stop-btn');

    if (runBtn) {
      runBtn.disabled = isRunning;
    }

    if (stopBtn) {
      stopBtn.disabled = !isRunning;
    }
  }

  /**
   * Updates focus part dropdown options.
   * @param {Array<{id: string, name: string}>} parts
   */
  updateFocusPartOptions(parts) {
    const container = this.#containerElement;
    if (!container || !container.querySelector) return;

    const focusPartSelect = container.querySelector('#ds-sim-focus-part');

    if (!focusPartSelect) return;

    // Clear existing options
    focusPartSelect.innerHTML = '<option value="">Select...</option>';

    if (!parts) return;

    // Add options for each targetable part
    for (const part of parts) {
      const option = document.createElement('option');
      option.value = part.id;
      option.textContent = part.name;
      focusPartSelect.appendChild(option);
    }
  }

  /**
   * Handle run button click.
   * @private
   */
  async #handleRunClick() {
    const container = this.#containerElement;
    if (!container || !container.querySelector) return;

    // Get configuration from UI
    const hitCountInput = container.querySelector('#ds-hit-count');
    const delaySlider = container.querySelector('#ds-hit-delay-slider');
    const targetModeRadio = container.querySelector(
      'input[name="ds-sim-target-mode"]:checked'
    );
    const focusPartSelect = container.querySelector('#ds-sim-focus-part');

    if (!hitCountInput || !delaySlider || !targetModeRadio) {
      if (this.#logger && typeof this.#logger.error === 'function') {
        this.#logger.error('[MultiHitSimulator] Missing UI elements');
      }
      return;
    }

    // Show progress, hide results
    const progressEl = container.querySelector('.ds-sim-progress');
    const resultsEl = container.querySelector('.ds-sim-results');
    if (progressEl) progressEl.hidden = false;
    if (resultsEl) resultsEl.hidden = true;

    const config = {
      hitCount: parseInt(hitCountInput.value, 10),
      delayMs: parseInt(delaySlider.value, 10),
      targetMode: targetModeRadio.value,
      focusPartId: focusPartSelect?.value || null,
    };

    if (this.#eventHandlers.onRun) {
      await this.#eventHandlers.onRun(config);
    }
  }
}

export default MultiHitSimulatorView;
