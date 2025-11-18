/**
 * @file Execution phase timing for action tracing
 * Tracks timing information for different phases of action execution
 * @see actionExecutionTrace.js
 */

import { highPrecisionTimer } from './highPrecisionTimer.js';
import { validateDependency, assertPresent } from '../../../utils/index.js';
import { InvalidArgumentError } from '../../../errors/invalidArgumentError.js';

/**
 * Execution phase timer for tracking action execution performance
 * Integrates with ActionExecutionTrace to provide timing data
 */
export class ExecutionPhaseTimer {
  #phases;
  #markers;
  #startTime;
  #endTime;
  #activePhase;

  constructor() {
    this.#phases = new Map();
    this.#markers = new Map();
    this.#startTime = null;
    this.#endTime = null;
    this.#activePhase = null;
  }

  /**
   * Start timing the overall execution
   *
   * @param {string} label - Execution label
   */
  startExecution(label = 'execution') {
    if (this.#startTime !== null) {
      throw new Error('Execution timing already started');
    }

    this.#startTime = highPrecisionTimer.now();
    this.#markers.set('execution_start', {
      label: 'execution_start',
      timestamp: this.#startTime,
      phase: label,
    });
  }

  /**
   * Start timing a specific phase
   *
   * @param {string} phaseName - Name of the phase
   * @param {object} [metadata] - Additional phase metadata
   */
  startPhase(phaseName, metadata = {}) {
    if (this.#startTime === null) {
      throw new Error('Must start execution before starting phases');
    }

    // End previous phase if active
    if (this.#activePhase) {
      this.endPhase(this.#activePhase);
    }

    const timestamp = highPrecisionTimer.now();
    const marker = {
      label: `${phaseName}_start`,
      timestamp,
      phase: phaseName,
      metadata,
    };

    this.#markers.set(`${phaseName}_start`, marker);
    this.#activePhase = phaseName;

    // Initialize phase data
    if (!this.#phases.has(phaseName)) {
      this.#phases.set(phaseName, {
        name: phaseName,
        startTime: timestamp,
        endTime: null,
        duration: null,
        metadata,
        markers: [],
      });
    }

    this.#phases.get(phaseName).markers.push(marker);
  }

  /**
   * End timing for a specific phase
   *
   * @param {string} phaseName - Name of the phase to end
   */
  endPhase(phaseName) {
    const phaseData = this.#phases.get(phaseName);
    if (!phaseData) {
      throw new Error(`Phase '${phaseName}' was not started`);
    }

    if (phaseData.endTime !== null) {
      throw new Error(`Phase '${phaseName}' already ended`);
    }

    const timestamp = highPrecisionTimer.now();
    const endMarker = {
      label: `${phaseName}_end`,
      timestamp,
      phase: phaseName,
    };

    this.#markers.set(`${phaseName}_end`, endMarker);

    // Update phase data
    phaseData.endTime = timestamp;
    phaseData.duration = timestamp - phaseData.startTime;
    phaseData.markers.push(endMarker);

    // Clear active phase if this was it
    if (this.#activePhase === phaseName) {
      this.#activePhase = null;
    }
  }

  /**
   * End whichever phase is currently active
   *
   * @returns {string|null} Name of the ended phase if one was active
   */
  endActivePhase() {
    if (!this.#activePhase) {
      return null;
    }

    const phaseToEnd = this.#activePhase;
    this.endPhase(phaseToEnd);
    return phaseToEnd;
  }

  /**
   * Add a timing marker within a phase
   *
   * @param {string} markerName - Name of the marker
   * @param {string} [phaseName] - Phase to associate with (current active phase if not specified)
   * @param {object} [metadata] - Additional marker metadata
   */
  addMarker(markerName, phaseName = null, metadata = {}) {
    const targetPhase = phaseName || this.#activePhase;

    if (!targetPhase) {
      throw new Error('No active phase and no phase specified for marker');
    }

    const timestamp = highPrecisionTimer.now();
    const marker = {
      label: markerName,
      timestamp,
      phase: targetPhase,
      metadata,
    };

    this.#markers.set(markerName, marker);

    // Add marker to phase data
    const phaseData = this.#phases.get(targetPhase);
    if (phaseData) {
      phaseData.markers.push(marker);
    }
  }

  /**
   * End overall execution timing
   *
   * @param {object} [metadata] - Additional execution metadata
   */
  endExecution(metadata = {}) {
    if (this.#startTime === null) {
      throw new Error('Execution timing was not started');
    }

    if (this.#endTime !== null) {
      throw new Error('Execution timing already ended');
    }

    // End any active phase
    if (this.#activePhase) {
      this.endPhase(this.#activePhase);
    }

    this.#endTime = highPrecisionTimer.now();
    this.#markers.set('execution_end', {
      label: 'execution_end',
      timestamp: this.#endTime,
      phase: 'execution',
      metadata,
    });
  }

  /**
   * Get timing data for a specific phase
   *
   * @param {string} phaseName - Name of the phase
   * @returns {object | null} Phase timing data or null if not found
   */
  getPhaseData(phaseName) {
    const phaseData = this.#phases.get(phaseName);
    if (!phaseData) {
      return null;
    }

    return {
      ...phaseData,
      humanReadable: phaseData.duration
        ? highPrecisionTimer.formatDuration(phaseData.duration)
        : null,
    };
  }

  /**
   * Get timing data for all phases
   *
   * @returns {Array<object>} Array of phase timing data
   */
  getAllPhases() {
    return Array.from(this.#phases.values()).map((phase) => ({
      ...phase,
      humanReadable: phase.duration
        ? highPrecisionTimer.formatDuration(phase.duration)
        : null,
    }));
  }

  /**
   * Get total execution duration
   *
   * @returns {number|null} Total duration in milliseconds or null if not complete
   */
  getTotalDuration() {
    if (this.#startTime === null || this.#endTime === null) {
      return null;
    }

    return this.#endTime - this.#startTime;
  }

  /**
   * Get execution timing summary
   *
   * @returns {object} Summary of execution timing
   */
  getSummary() {
    const totalDuration = this.getTotalDuration();
    const phases = this.getAllPhases();

    return {
      totalDuration,
      totalHumanReadable: totalDuration
        ? highPrecisionTimer.formatDuration(totalDuration)
        : null,
      startTime: this.#startTime,
      endTime: this.#endTime,
      phaseCount: phases.length,
      phases: phases.map((phase) => ({
        name: phase.name,
        duration: phase.duration,
        humanReadable: phase.humanReadable,
        percentage: totalDuration
          ? (((phase.duration || 0) / totalDuration) * 100).toFixed(1) + '%'
          : null,
      })),
      markerCount: this.#markers.size,
      isComplete: this.#endTime !== null,
    };
  }

  /**
   * Export timing data for trace serialization
   *
   * @returns {object} Serializable timing data
   */
  exportTimingData() {
    return {
      summary: this.getSummary(),
      phases: Object.fromEntries(
        Array.from(this.#phases.entries()).map(([name, data]) => [
          name,
          {
            name: data.name,
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration,
            metadata: data.metadata,
            markerCount: data.markers.length,
          },
        ])
      ),
      markers: Object.fromEntries(
        Array.from(this.#markers.entries()).map(([name, marker]) => [
          name,
          {
            label: marker.label,
            timestamp: marker.timestamp,
            phase: marker.phase,
            metadata: marker.metadata || {},
          },
        ])
      ),
      precision: highPrecisionTimer.getPrecisionInfo(),
    };
  }

  /**
   * Reset all timing data
   */
  reset() {
    this.#phases.clear();
    this.#markers.clear();
    this.#startTime = null;
    this.#endTime = null;
    this.#activePhase = null;
  }

  /**
   * Check if execution timing is in progress
   *
   * @returns {boolean} True if timing is active
   */
  isActive() {
    return this.#startTime !== null && this.#endTime === null;
  }

  /**
   * Create performance report
   *
   * @returns {string} Human-readable performance report
   */
  createReport() {
    const summary = this.getSummary();

    if (!summary.isComplete) {
      return 'Execution timing not complete';
    }

    const lines = [
      'EXECUTION TIMING REPORT',
      '='.repeat(25),
      `Total Duration: ${summary.totalHumanReadable}`,
      `Phases: ${summary.phaseCount}`,
      `Markers: ${summary.markerCount}`,
      '',
      'Phase Breakdown:',
      '-'.repeat(15),
    ];

    summary.phases.forEach((phase) => {
      lines.push(
        `${phase.name.padEnd(20)} ${phase.humanReadable.padStart(8)} (${phase.percentage})`
      );
    });

    return lines.join('\n');
  }
}
