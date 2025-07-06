import { TextFormatter } from './textFormatter.js';
import { PartGroupingStrategyFactory } from '../configuration/partGroupingStrategies.js';

/**
 * Template for formatting body part descriptions using strategies and formatters
 */
export class DescriptionTemplate {
  constructor({
    config,
    textFormatter = new TextFormatter(),
    strategyFactory = new PartGroupingStrategyFactory(),
  } = {}) {
    this.config = config;
    this.textFormatter = textFormatter;
    this.strategyFactory = strategyFactory;
  }

  /**
   * Format a description for a given part type and its entities
   *
   * @param {string} partType - The type of body part
   * @param {Array<object>} parts - Array of part entities
   * @returns {string} Formatted description
   */
  formatDescription(partType, parts) {
    if (!parts || parts.length === 0) {
      return '';
    }

    // Get descriptions from core:description component
    const descriptions = this.extractDescriptions(parts);

    if (descriptions.length === 0) {
      return '';
    }

    // Get the appropriate strategy
    const strategy = this.strategyFactory.getStrategy(
      partType,
      parts,
      descriptions,
      this.config
    );

    // Use the strategy to format the description
    return strategy.format(
      partType,
      parts,
      descriptions,
      this.textFormatter,
      this.config
    );
  }

  /**
   * Extract descriptions from part entities
   *
   * @param {Array<object>} parts - Array of part entities
   * @returns {Array<string>} Array of descriptions
   */
  extractDescriptions(parts) {
    return parts
      .map((part) => {
        if (!part) return '';

        if (typeof part.getComponentData === 'function') {
          const descComponent = part.getComponentData('core:description');
          return descComponent ? descComponent.text : '';
        }
        return '';
      })
      .filter((desc) => desc); // Remove empty descriptions
  }

  /**
   * Create a structured line for a body part type
   * This is the main method that replaces the original createStructuredLine
   *
   * @param {string} partType - The type of body part
   * @param {Array<object>} parts - Array of part entities
   * @returns {string} Formatted description line
   */
  createStructuredLine(partType, parts) {
    return this.formatDescription(partType, parts);
  }
}
