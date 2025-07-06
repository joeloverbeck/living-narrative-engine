/**
 * @file Pure text formatting utilities for body descriptions
 */

/**
 * Service for text formatting operations
 * Contains only pure string manipulation logic with no business dependencies
 */
export class TextFormatter {
  /**
   * Capitalize the first letter of a string and replace underscores with spaces
   *
   * @param {string} str - The string to capitalize
   * @returns {string} The capitalized string with underscores replaced by spaces
   */
  capitalize(str) {
    if (!str) return '';
    // Replace underscores with spaces
    const withSpaces = str.replace(/_/g, ' ');
    // Capitalize first letter
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }

  /**
   * Get the appropriate label for a body part with proper capitalization
   *
   * @param {string} partType - The type of body part
   * @param {number} count - The number of parts
   * @param {Function} pluralizer - Function to get plural form of part type
   * @param {Set<string>} pairedParts - Set of parts that are typically paired
   * @returns {string} The formatted label
   */
  getPartLabel(partType, count, pluralizer, pairedParts) {
    // Capitalize first letter
    const capitalizedType = this.capitalize(partType);

    // Handle pluralization for multiple parts
    if (count > 1 && pairedParts.has(partType)) {
      const plural = pluralizer(partType);
      return this.capitalize(plural);
    }

    return capitalizedType;
  }

  /**
   * Join descriptor values with appropriate punctuation
   *
   * @param {Array<string>} values - Array of descriptor values
   * @returns {string} Joined string
   */
  joinDescriptors(values) {
    if (!values || values.length === 0) return '';
    return values.filter((v) => v).join(', ');
  }

  /**
   * Format a simple label-value pair
   *
   * @param {string} label - The label
   * @param {string} value - The value
   * @returns {string} Formatted string
   */
  formatLabelValue(label, value) {
    return `${label}: ${value}`;
  }

  /**
   * Format an indexed item (e.g., "Arm 1", "Arm 2")
   *
   * @param {string} type - The item type
   * @param {number} index - The 1-based index
   * @param {string} description - The description
   * @returns {string} Formatted string
   */
  formatIndexedItem(type, index, description) {
    return `${this.capitalize(type)} ${index}: ${description}`;
  }

  /**
   * Format a left/right labeled item
   *
   * @param {string} side - 'Left' or 'Right'
   * @param {string} type - The part type
   * @param {string} description - The description
   * @returns {string} Formatted string
   */
  formatSidedItem(side, type, description) {
    return `${side} ${type}: ${description}`;
  }

  /**
   * Join multiple lines with newlines
   *
   * @param {Array<string>} lines - Array of lines to join
   * @returns {string} Joined string
   */
  joinLines(lines) {
    return lines.filter((line) => line).join('\n');
  }
}
