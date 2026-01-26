/**
 * @file Progress Tracking Service for prototype analysis.
 * Handles progress calculation, stage management, and UI updates during analysis.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} ProgressElements
 * @property {HTMLElement|null} progressPanel - Progress panel container
 * @property {HTMLElement|null} progressBar - Progress bar element
 * @property {HTMLElement|null} progressStatus - Status text element
 * @property {HTMLElement|null} runAnalysisBtn - Run button (for percentage display)
 */

/**
 * @typedef {object} StageWeight
 * @property {number} start - Start percentage for this stage
 * @property {number} weight - Weight (percentage contribution) of this stage
 */

/**
 * @typedef {object} ProgressData
 * @property {number} [totalStages] - Total number of stages
 * @property {number} [stageNumber] - Current stage number
 * @property {string} [phase] - Sub-phase for setup stage
 * @property {number} [poolCurrent] - Current pool item (setup/pool phase)
 * @property {number} [poolTotal] - Total pool items (setup/pool phase)
 * @property {number} [vectorCurrent] - Current vector (setup/vectors phase)
 * @property {number} [vectorTotal] - Total vectors (setup/vectors phase)
 * @property {number} [current] - Current item (filtering, legacy)
 * @property {number} [total] - Total items (filtering, legacy)
 * @property {number} [pairsProcessed] - Processed pairs (filtering, new)
 * @property {number} [totalPairs] - Total pairs (filtering, new)
 * @property {number} [pairIndex] - Current pair index (evaluating)
 * @property {number} [pairTotal] - Total pairs (evaluating)
 * @property {number} [sampleIndex] - Current sample index (evaluating)
 * @property {number} [sampleTotal] - Total samples (evaluating)
 */

/**
 * Service for tracking and displaying analysis progress.
 * Handles stage-based progress calculation and UI updates.
 */
class ProgressTrackingService {
  /** @type {object} */
  #logger;

  /** @type {Object<string, StageWeight>} */
  static V3_STAGE_WEIGHTS = {
    setup: { start: 0, weight: 15 },
    filtering: { start: 15, weight: 5 },
    evaluating: { start: 20, weight: 60 },
    classifying: { start: 80, weight: 10 },
    recommending: { start: 90, weight: 5 },
    axis_gap_analysis: { start: 95, weight: 5 },
  };

  /** @type {Object<string, StageWeight>} */
  static V2_STAGE_WEIGHTS = {
    filtering: { start: 0, weight: 5 },
    evaluating: { start: 5, weight: 80 },
    classifying: { start: 85, weight: 10 },
    recommending: { start: 95, weight: 5 },
  };

  /** @type {Object<string, string>} */
  static STAGE_LABELS = {
    setup: 'Setting up V3 analysis',
    filtering: 'Filtering candidate pairs',
    evaluating: 'Evaluating behavioral overlap',
    classifying: 'Classifying overlap patterns',
    recommending: 'Building recommendations',
    axis_gap_analysis: 'Analyzing axis gaps',
  };

  /**
   * Create a ProgressTrackingService.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[ProgressTrackingService] Initialized.');
  }

  /**
   * Show the progress panel with initial state.
   *
   * @param {ProgressElements} elements - Progress DOM elements
   */
  showPanel(elements) {
    if (elements.progressPanel) {
      elements.progressPanel.hidden = false;
    }
    this.updateProgress(0, 'Initializing...', elements);
  }

  /**
   * Hide the progress panel.
   *
   * @param {ProgressElements} elements - Progress DOM elements
   */
  hidePanel(elements) {
    if (elements.progressPanel) {
      elements.progressPanel.hidden = true;
    }
  }

  /**
   * Update the progress bar and status text.
   *
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} statusText - Status message to display
   * @param {ProgressElements} elements - Progress DOM elements
   */
  updateProgress(percent, statusText, elements) {
    if (elements.progressBar) {
      const clampedPercent = Math.max(0, Math.min(100, percent));
      elements.progressBar.style.width = `${clampedPercent}%`;
      elements.progressBar.setAttribute('aria-valuenow', String(clampedPercent));
    }
    if (elements.progressStatus) {
      elements.progressStatus.textContent = statusText;
    }
  }

  /**
   * Handle progress callback from analyzer.
   * Calculates overall progress based on stage weights and updates UI.
   *
   * @param {string} stage - Current stage name
   * @param {ProgressData} progressData - Progress data object
   * @param {ProgressElements} elements - Progress DOM elements
   */
  handleProgress(stage, progressData, elements) {
    const { totalStages = 4 } = progressData;
    const isV3Mode = totalStages === 5;
    const stageWeights = isV3Mode
      ? ProgressTrackingService.V3_STAGE_WEIGHTS
      : ProgressTrackingService.V2_STAGE_WEIGHTS;

    const stageConfig = stageWeights[stage];
    if (!stageConfig) {
      this.#logger.debug(`[ProgressTrackingService] Unknown stage: ${stage}`);
      return;
    }

    const { stageProgress, statusText } = this.#calculateStageProgress(
      stage,
      progressData,
      totalStages
    );

    const percent = stageConfig.start + stageProgress * stageConfig.weight;
    this.updateProgress(percent, statusText, elements);

    if (elements.runAnalysisBtn) {
      elements.runAnalysisBtn.textContent = `${Math.round(percent)}%`;
    }
  }

  /**
   * Mark progress as complete.
   *
   * @param {ProgressElements} elements - Progress DOM elements
   */
  markComplete(elements) {
    this.updateProgress(100, 'Analysis complete', elements);
    if (elements.runAnalysisBtn) {
      elements.runAnalysisBtn.textContent = '100%';
    }
  }

  /**
   * Calculate stage-specific progress and status text.
   *
   * @param {string} stage - Current stage name
   * @param {ProgressData} progressData - Progress data
   * @param {number} totalStages - Total number of stages
   * @returns {{ stageProgress: number, statusText: string }} Progress and status
   * @private
   */
  #calculateStageProgress(stage, progressData, totalStages) {
    const { stageNumber = 1 } = progressData;
    const stageLabel = ProgressTrackingService.STAGE_LABELS[stage] || stage;

    switch (stage) {
      case 'setup':
        return this.#calculateSetupProgress(progressData, stageNumber, totalStages);

      case 'filtering':
        return this.#calculateFilteringProgress(progressData, stageNumber, totalStages, stageLabel);

      case 'evaluating':
        return this.#calculateEvaluatingProgress(progressData, stageNumber, totalStages);

      case 'classifying':
      case 'recommending':
        return this.#calculateClassifyingProgress(
          progressData,
          stageNumber,
          totalStages,
          stageLabel
        );

      case 'axis_gap_analysis':
        return {
          stageProgress: 0.5,
          statusText: `Stage ${stageNumber}/${totalStages}: ${stageLabel}...`,
        };

      default:
        return {
          stageProgress: 0,
          statusText: `Stage ${stageNumber}/${totalStages}: ${stageLabel}...`,
        };
    }
  }

  /**
   * Calculate setup stage progress.
   *
   * @param {ProgressData} progressData - Progress data
   * @param {number} stageNumber - Current stage number
   * @param {number} totalStages - Total stages
   * @returns {{ stageProgress: number, statusText: string }} Progress and status
   * @private
   */
  #calculateSetupProgress(progressData, stageNumber, totalStages) {
    const { phase, poolCurrent, poolTotal, vectorCurrent, vectorTotal } = progressData;

    if (phase === 'pool' && poolTotal > 0) {
      const stageProgress = (poolCurrent / poolTotal) * 0.7;
      const poolPercent = Math.round((poolCurrent / poolTotal) * 100);
      return {
        stageProgress,
        statusText: `Stage ${stageNumber}/${totalStages}: Generating context pool (${poolPercent}%)...`,
      };
    }

    if (phase === 'vectors') {
      const vectorProgress = vectorTotal > 0 ? vectorCurrent / vectorTotal : 0;
      const stageProgress = 0.7 + vectorProgress * 0.2;
      const vectorPercent = Math.round(vectorProgress * 100);
      return {
        stageProgress,
        statusText: `Stage ${stageNumber}/${totalStages}: Evaluating prototype vectors (${vectorCurrent ?? 0}/${vectorTotal ?? '?'} - ${vectorPercent}%)...`,
      };
    }

    if (phase === 'profiles') {
      return {
        stageProgress: 0.9,
        statusText: `Stage ${stageNumber}/${totalStages}: Computing prototype profiles...`,
      };
    }

    return {
      stageProgress: 0,
      statusText: `Stage ${stageNumber}/${totalStages}: Initializing V3 analysis...`,
    };
  }

  /**
   * Calculate filtering stage progress.
   *
   * @param {ProgressData} progressData - Progress data
   * @param {number} stageNumber - Current stage number
   * @param {number} totalStages - Total stages
   * @param {string} stageLabel - Stage label text
   * @returns {{ stageProgress: number, statusText: string }} Progress and status
   * @private
   */
  #calculateFilteringProgress(progressData, stageNumber, totalStages, stageLabel) {
    const { current, total, pairsProcessed, totalPairs } = progressData;
    const processed = pairsProcessed ?? current ?? 0;
    const totalCount = totalPairs ?? total ?? 1;
    const stageProgress = totalCount > 0 ? processed / totalCount : 0;

    const statusText =
      processed >= totalCount
        ? `Stage ${stageNumber}/${totalStages}: Filtering complete`
        : `Stage ${stageNumber}/${totalStages}: ${stageLabel} (${processed}/${totalCount})...`;

    return { stageProgress, statusText };
  }

  /**
   * Calculate evaluating stage progress.
   *
   * @param {ProgressData} progressData - Progress data
   * @param {number} stageNumber - Current stage number
   * @param {number} totalStages - Total stages
   * @returns {{ stageProgress: number, statusText: string }} Progress and status
   * @private
   */
  #calculateEvaluatingProgress(progressData, stageNumber, totalStages) {
    const { pairIndex, pairTotal, sampleIndex, sampleTotal } = progressData;
    const pairProgress = pairTotal > 0 ? pairIndex / pairTotal : 0;
    const sampleProgress = sampleTotal > 0 ? sampleIndex / sampleTotal : 0;
    const stageProgress = pairProgress + sampleProgress / Math.max(pairTotal, 1);

    return {
      stageProgress,
      statusText: `Stage ${stageNumber}/${totalStages}: Pair ${pairIndex + 1}/${pairTotal} (${Math.round(sampleProgress * 100)}%)...`,
    };
  }

  /**
   * Calculate classifying/recommending stage progress.
   *
   * @param {ProgressData} progressData - Progress data
   * @param {number} stageNumber - Current stage number
   * @param {number} totalStages - Total stages
   * @param {string} stageLabel - Stage label text
   * @returns {{ stageProgress: number, statusText: string }} Progress and status
   * @private
   */
  #calculateClassifyingProgress(progressData, stageNumber, totalStages, stageLabel) {
    const { pairIndex, pairTotal } = progressData;
    const stageProgress = pairTotal > 0 ? pairIndex / pairTotal : 0;

    return {
      stageProgress,
      statusText: `Stage ${stageNumber}/${totalStages}: ${stageLabel} (${pairIndex}/${pairTotal})...`,
    };
  }
}

export default ProgressTrackingService;
