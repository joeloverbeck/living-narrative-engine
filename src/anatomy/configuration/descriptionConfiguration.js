/**
 * @file Configuration for body description formatting and composition
 */

/**
 * Service for centralizing body description configuration and defaults
 */
export class DescriptionConfiguration {
  constructor(anatomyFormattingService = null) {
    this.anatomyFormattingService = anatomyFormattingService;

    // Default values extracted from BodyDescriptionComposer
    // Body-level descriptors come first, followed by body parts
    this._defaultDescriptionOrder = [
      'height', // Add height as the first body-level descriptor
      'build',
      'body_composition',
      'body_hair',
      'skin_color',
      'smell',
      'hair',
      'eye',
      'face',
      'ear',
      'nose',
      'mouth',
      'neck',
      'breast',
      'torso',
      'arm',
      'hand',
      'leg',
      'foot',
      'tail',
      'wing',
      'activity',
    ];

    this._defaultPairedParts = new Set([
      'eye',
      'ear',
      'arm',
      'leg',
      'hand',
      'foot',
      'breast',
      'wing',
      'testicle',
    ]);

    this._defaultIrregularPlurals = {
      foot: 'feet',
      tooth: 'teeth',
    };
  }

  /**
   * Get the order in which body parts should be described
   *
   * @returns {Array<string>} Ordered array of part types
   */
  getDescriptionOrder() {
    return (
      this.anatomyFormattingService?.getDescriptionOrder?.() || [
        ...this._defaultDescriptionOrder,
      ]
    );
  }

  /**
   * Get the set of parts that are typically paired (left/right)
   *
   * @returns {Set<string>} Set of paired part types
   */
  getPairedParts() {
    return (
      this.anatomyFormattingService?.getPairedParts?.() ||
      new Set(this._defaultPairedParts)
    );
  }

  /**
   * Get irregular plural forms for body parts
   *
   * @returns {Object<string, string>} Map of singular to plural forms
   */
  getIrregularPlurals() {
    return (
      this.anatomyFormattingService?.getIrregularPlurals?.() || {
        ...this._defaultIrregularPlurals,
      }
    );
  }
}

/**
 * Creates a pluralizer function that handles both exact matches and compound words.
 * For compound words like "chicken_foot", it detects the irregular suffix "foot"
 * and transforms it to "chicken_feet".
 *
 * @param {Object<string, string>} irregularPlurals - Map of singular to plural forms
 * @returns {Function} Pluralizer function
 */
export function createPluralizer(irregularPlurals) {
  return (word) => {
    // Check exact match first
    if (irregularPlurals[word]) {
      return irregularPlurals[word];
    }

    // Check if compound word ends with an irregular plural word
    for (const [singular, plural] of Object.entries(irregularPlurals)) {
      if (word.endsWith('_' + singular)) {
        // Replace the ending: "chicken_foot" → "chicken_feet"
        return word.slice(0, -singular.length) + plural;
      }
    }

    // Default: add 's'
    return `${word}s`;
  };
}

/**
 * Export all configuration constants as a single object for convenient access
 */
export const DESCRIPTION_CONFIG_CONSTANTS = {
  DEFAULT_DESCRIPTION_ORDER: [
    'height', // Add height first
    'build',
    'body_composition',
    'body_hair',
    'skin_color',
    'smell',
    'hair',
    'eye',
    'face',
    'ear',
    'nose',
    'mouth',
    'neck',
    'breast',
    'torso',
    'arm',
    'hand',
    'leg',
    'foot',
    'tail',
    'wing',
    'activity',
  ],
  DEFAULT_PAIRED_PARTS: new Set([
    'eye',
    'ear',
    'arm',
    'leg',
    'hand',
    'foot',
    'breast',
    'wing',
    'testicle',
  ]),
  DEFAULT_IRREGULAR_PLURALS: {
    foot: 'feet',
    tooth: 'teeth',
  },
};
