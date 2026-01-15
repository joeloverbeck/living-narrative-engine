/**
 * @file WitnessFormatter - Formats witness/context state data for Monte Carlo reports
 * @description Stateless service containing formatting functions for witness data
 * extracted from MonteCarloReportGenerator. Formats mood state, sexual state,
 * affect traits, computed emotions, and binding axes.
 * @see MonteCarloReportGenerator.js
 */

class WitnessFormatter {
  #formattingService;

  /**
   * Create a WitnessFormatter instance.
   * @param {object} deps - Dependencies
   * @param {object} deps.formattingService - ReportFormattingService instance
   * @throws {Error} If formattingService is not provided
   */
  constructor({ formattingService }) {
    if (!formattingService) {
      throw new Error('WitnessFormatter requires formattingService');
    }
    this.#formattingService = formattingService;
  }

  // ============================================================================
  // Witness Formatting
  // ============================================================================

  /**
   * Format a complete witness object for report display.
   * @param {object} witness - Witness data from simulation
   * @param {object} witness.current - Current state (mood, sexual)
   * @param {object} witness.previous - Previous state (mood, sexual)
   * @param {object} witness.affectTraits - Affect trait values
   * @param {object} witness.computedEmotions - Current computed emotions
   * @param {object} witness.previousComputedEmotions - Previous computed emotions
   * @param {number} index - Witness index (1-based for display)
   * @returns {string} Formatted markdown string
   */
  formatWitness(witness, index) {
    const {
      current,
      previous,
      affectTraits,
      computedEmotions,
      previousComputedEmotions,
    } = witness;

    // Format mood axes
    const currentMood = this.formatMoodState(current?.mood, 'Current');
    const previousMood = this.formatMoodState(previous?.mood, 'Previous');

    // Format sexual state
    const currentSexual = this.formatSexualState(current?.sexual, 'Current');
    const previousSexual = this.formatSexualState(previous?.sexual, 'Previous');

    // Format affect traits
    const traits = this.formatAffectTraits(affectTraits);

    // Format computed emotions (only referenced ones)
    const currentEmotions = this.formatComputedEmotions(
      computedEmotions,
      'Current'
    );
    const prevEmotions = this.formatComputedEmotions(
      previousComputedEmotions,
      'Previous'
    );

    return `### Witness #${index}

**Computed Emotions (Current)**:
${currentEmotions}

**Computed Emotions (Previous)**:
${prevEmotions}

**Mood State (Current)**:
${currentMood}

**Mood State (Previous)**:
${previousMood}

**Sexual State (Current)**:
${currentSexual}

**Sexual State (Previous)**:
${previousSexual}

**Affect Traits**:
${traits}`;
  }

  // ============================================================================
  // Mood State Formatting
  // ============================================================================

  /**
   * Format mood state for witness display.
   * @param {object|null} mood - Mood state object with axis values
   * @param {string} label - Label for the state ('Current' or 'Previous')
   * @returns {string} Formatted markdown list of mood axes
   */
  formatMoodState(mood, label) {
    if (!mood) {
      return `- No ${label.toLowerCase()} mood data`;
    }

    const axes = [
      'valence',
      'arousal',
      'agency_control',
      'threat',
      'engagement',
      'future_expectancy',
      'self_evaluation',
      'affiliation',
    ];

    return axes
      .filter((axis) => mood[axis] !== undefined)
      .map((axis) => `- ${axis}: ${mood[axis]}`)
      .join('\n');
  }

  // ============================================================================
  // Sexual State Formatting
  // ============================================================================

  /**
   * Format sexual state for witness display.
   * @param {object|null} sexual - Sexual state object
   * @param {string} label - Label for the state ('Current' or 'Previous')
   * @returns {string} Formatted markdown list of sexual state fields
   */
  formatSexualState(sexual, label) {
    if (!sexual) {
      return `- No ${label.toLowerCase()} sexual data`;
    }

    const fields = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];

    return fields
      .filter((field) => sexual[field] !== undefined)
      .map((field) => `- ${field}: ${sexual[field]}`)
      .join('\n');
  }

  // ============================================================================
  // Affect Traits Formatting
  // ============================================================================

  /**
   * Format affect traits for witness display.
   * @param {object|null} traits - Affect traits object
   * @returns {string} Formatted markdown list of affect traits
   */
  formatAffectTraits(traits) {
    if (!traits) {
      return '- No affect trait data';
    }

    const traitFields = ['affective_empathy', 'cognitive_empathy', 'harm_aversion'];

    return traitFields
      .filter((field) => traits[field] !== undefined)
      .map((field) => `- ${field}: ${traits[field]}`)
      .join('\n');
  }

  // ============================================================================
  // Computed Emotions Formatting
  // ============================================================================

  /**
   * Format computed emotions for witness display.
   * @param {object|null} emotions - Computed emotions object (filtered to referenced only)
   * @param {string} label - 'Current' or 'Previous'
   * @returns {string} Formatted markdown list of emotions with 3-decimal precision
   */
  formatComputedEmotions(emotions, label) {
    if (!emotions || Object.keys(emotions).length === 0) {
      return `- No ${label.toLowerCase()} emotion data`;
    }

    return Object.entries(emotions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `- ${name}: ${value.toFixed(3)}`)
      .join('\n');
  }

  // ============================================================================
  // Binding Axes Formatting
  // ============================================================================

  /**
   * Format binding axes summary for prototype analysis.
   * @param {object[]} bindingAxes - Binding axes from analyzer
   * @param {string} bindingAxes[].axis - Axis name
   * @param {number} [bindingAxes[].weight] - Axis weight
   * @param {string} [bindingAxes[].conflictType] - Conflict type if any
   * @param {number} [bindingAxes[].constraintMax] - Max constraint value
   * @param {number} [bindingAxes[].constraintMin] - Min constraint value
   * @returns {string} Formatted markdown section
   *
   * TODO: Consider relocating to PrototypeFormatter during MONCARREPGENREFANA-008
   * as this is called from prototype analysis context, not witness formatting.
   */
  formatBindingAxes(bindingAxes) {
    if (!bindingAxes || bindingAxes.length === 0) {
      return '**Binding Axes**: None (all axes can reach optimal values)';
    }

    const conflicts = bindingAxes.filter((a) => a.conflictType);
    if (conflicts.length === 0) {
      const axesList = bindingAxes.map((a) => a.axis).join(', ');
      return `**Binding Axes**: ${axesList} (constraints limit optimal values)`;
    }

    const conflictLines = conflicts.map((a) => {
      if (a.conflictType === 'positive_weight_low_max') {
        return `- ⚠️ **${a.axis}**: Has positive weight (+${a.weight.toFixed(2)}) but constraint limits max to ${a.constraintMax.toFixed(2)}`;
      } else if (a.conflictType === 'negative_weight_high_min') {
        return `- ⚠️ **${a.axis}**: Has negative weight (${a.weight.toFixed(2)}) but constraint requires min ${a.constraintMin.toFixed(2)}`;
      }
      return `- ⚠️ **${a.axis}**: Binding conflict`;
    });

    return `**Binding Axes (Structural Conflicts)**:\n${conflictLines.join('\n')}`;
  }
}

export default WitnessFormatter;
