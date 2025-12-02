/**
 * @file Strategies for grouping and formatting body part descriptions
 */

import { createPluralizer } from './descriptionConfiguration.js';

/**
 * Base interface for part grouping strategies
 */
export class PartGroupingStrategy {
  /**
   * Check if this strategy can handle the given part configuration
   *
   * @param {string} partType - The type of body part
   * @param {Array<object>} parts - Array of part entities
   * @param {Array<string>} descriptions - Array of descriptions
   * @param {object} config - Configuration object
   * @returns {boolean} True if this strategy can handle the configuration
   */
  canHandle(partType, parts, descriptions, config) {
    throw new Error('canHandle must be implemented by subclass');
  }

  /**
   * Format the part descriptions according to this strategy
   *
   * @param {string} partType - The type of body part
   * @param {Array<object>} parts - Array of part entities
   * @param {Array<string>} descriptions - Array of descriptions
   * @param {object} textFormatter - Text formatter instance
   * @param {object} config - Configuration object
   * @returns {string} Formatted description
   */
  format(partType, parts, descriptions, textFormatter, config) {
    throw new Error('format must be implemented by subclass');
  }
}

/**
 * Strategy for handling single body parts
 */
export class SinglePartStrategy extends PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    return descriptions.length === 1;
  }

  format(partType, parts, descriptions, textFormatter, config) {
    const label = textFormatter.getPartLabel(
      partType,
      1,
      () => partType,
      new Set()
    );
    return textFormatter.formatLabelValue(label, descriptions[0]);
  }
}

/**
 * Strategy for handling paired body parts (e.g., eyes, ears, hands)
 */
export class PairedPartsStrategy extends PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    const pairedParts = config.getPairedParts();
    return pairedParts.has(partType) && descriptions.length === 2;
  }

  format(partType, parts, descriptions, textFormatter, config) {
    // Check if all descriptions are the same
    const allSame = descriptions.every((desc) => desc === descriptions[0]);

    if (allSame) {
      // Same description for both parts
      const irregularPlurals = config.getIrregularPlurals();
      const pluralizer = createPluralizer(irregularPlurals);
      const pairedParts = config.getPairedParts();
      const label = textFormatter.getPartLabel(
        partType,
        2,
        pluralizer,
        pairedParts
      );
      return textFormatter.formatLabelValue(label, descriptions[0]);
    } else {
      // Different descriptions for left/right
      const lines = [];
      const names = parts.map((part) => {
        const nameComp = part.getComponentData('core:name');
        return nameComp ? nameComp.text.toLowerCase() : '';
      });

      // Try to determine left/right based on name
      for (let i = 0; i < descriptions.length && i < 2; i++) {
        const name = names[i] || '';
        if (name.includes('left')) {
          lines.push(
            textFormatter.formatSidedItem('Left', partType, descriptions[i])
          );
        } else if (name.includes('right')) {
          lines.push(
            textFormatter.formatSidedItem('Right', partType, descriptions[i])
          );
        } else {
          // Fallback if no left/right in name
          lines.push(
            textFormatter.formatIndexedItem(partType, i + 1, descriptions[i])
          );
        }
      }
      return textFormatter.joinLines(lines);
    }
  }
}

/**
 * Strategy for handling multiple parts with same or different descriptions
 */
export class MultiplePartsStrategy extends PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    // This is the fallback strategy for any configuration not handled by others
    return descriptions.length > 0;
  }

  format(partType, parts, descriptions, textFormatter, config) {
    // Check if all descriptions are the same
    const allSame = descriptions.every((desc) => desc === descriptions[0]);

    if (allSame) {
      const irregularPlurals = config.getIrregularPlurals();
      const pluralizer = createPluralizer(irregularPlurals);
      const pairedParts = config.getPairedParts();
      const label = textFormatter.getPartLabel(
        partType,
        descriptions.length,
        pluralizer,
        pairedParts
      );
      return textFormatter.formatLabelValue(label, descriptions[0]);
    } else {
      // Multiple different descriptions
      const lines = descriptions.map((desc, index) =>
        textFormatter.formatIndexedItem(partType, index + 1, desc)
      );
      return textFormatter.joinLines(lines);
    }
  }
}

/**
 * Factory for creating and managing part grouping strategies
 */
export class PartGroupingStrategyFactory {
  constructor() {
    this.strategies = [
      new SinglePartStrategy(),
      new PairedPartsStrategy(),
      new MultiplePartsStrategy(), // Must be last as it's the fallback
    ];
  }

  /**
   * Get the appropriate strategy for the given configuration
   *
   * @param {string} partType - The type of body part
   * @param {Array<object>} parts - Array of part entities
   * @param {Array<string>} descriptions - Array of descriptions
   * @param {object} config - Configuration object
   * @returns {PartGroupingStrategy} The appropriate strategy
   */
  getStrategy(partType, parts, descriptions, config) {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(partType, parts, descriptions, config)) {
        return strategy;
      }
    }
    // This should never happen as MultiplePartsStrategy is a catch-all
    throw new Error(`No strategy found for part type: ${partType}`);
  }
}
