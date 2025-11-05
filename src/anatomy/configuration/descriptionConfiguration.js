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
