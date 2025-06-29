import { DescriptorFormatter } from './descriptorFormatter.js';

/**
 * Service for building descriptions of individual body parts from their components
 */
export class BodyPartDescriptionBuilder {
  constructor({ descriptorFormatter }) {
    this.descriptorFormatter = descriptorFormatter;
  }

  /**
   * Parts that should use "a pair of" when there are two
   */
  static PAIRED_PARTS = new Set([
    'eye',
    'ear',
    'arm',
    'leg',
    'hand',
    'foot',
    'breast',
    'wing',
  ]);

  /**
   * Parts that have irregular plurals
   */
  static IRREGULAR_PLURALS = {
    foot: 'feet',
    tooth: 'teeth',
  };

  /**
   * Parts that should not have an article
   */
  static NO_ARTICLE_PARTS = new Set(['hair']);

  /**
   * Build a description for a single body part
   * @param {Object} entity - The body part entity
   * @returns {string} The generated description
   */
  buildDescription(entity) {
    if (!entity || !entity.components) {
      return '';
    }

    const anatomyPart = entity.components['anatomy:part'];
    if (!anatomyPart || !anatomyPart.subType) {
      return '';
    }

    const subType = anatomyPart.subType;
    const descriptors = this.descriptorFormatter.extractDescriptors(
      entity.components
    );
    const formattedDescriptors =
      this.descriptorFormatter.formatDescriptors(descriptors);

    return this.constructDescription(subType, formattedDescriptors);
  }

  /**
   * Build descriptions for multiple body parts of the same type
   * @param {Array<Object>} entities - Array of body part entities
   * @param {string} subType - The part subtype
   * @returns {string} The generated description
   */
  buildMultipleDescription(entities, subType) {
    if (!entities || entities.length === 0) {
      return '';
    }

    if (entities.length === 1) {
      return this.buildDescription(entities[0]);
    }

    // Check if all parts have the same descriptors
    const allDescriptors = entities.map((entity) => {
      const descriptors = this.descriptorFormatter.extractDescriptors(
        entity.components
      );
      return this.descriptorFormatter.formatDescriptors(descriptors);
    });

    const allSame = allDescriptors.every((desc) => desc === allDescriptors[0]);

    if (allSame && BodyPartDescriptionBuilder.PAIRED_PARTS.has(subType)) {
      // Use "a pair of" for matching paired parts
      const formattedDescriptors = allDescriptors[0];
      return this.constructPairedDescription(subType, formattedDescriptors);
    } else {
      // List each part separately
      return entities
        .map((entity) => this.buildDescription(entity))
        .join(' and ');
    }
  }

  /**
   * Construct a description string from subtype and descriptors
   * @param {string} subType
   * @param {string} formattedDescriptors
   * @returns {string}
   */
  constructDescription(subType, formattedDescriptors) {
    const article = this.getArticle(subType, formattedDescriptors);
    const descriptorPart = formattedDescriptors
      ? `${formattedDescriptors} `
      : '';

    if (BodyPartDescriptionBuilder.NO_ARTICLE_PARTS.has(subType)) {
      // No article for parts like "hair"
      return `${descriptorPart}${subType}`;
    }

    return `${article} ${descriptorPart}${subType}`;
  }

  /**
   * Construct a paired description (e.g., "a pair of blue eyes")
   * @param {string} subType
   * @param {string} formattedDescriptors
   * @returns {string}
   */
  constructPairedDescription(subType, formattedDescriptors) {
    const plural = this.getPlural(subType);
    const descriptorPart = formattedDescriptors
      ? `${formattedDescriptors} `
      : '';
    return `a pair of ${descriptorPart}${plural}`;
  }

  /**
   * Get the appropriate article for a description
   * @param {string} subType
   * @param {string} descriptors
   * @returns {string}
   */
  getArticle(subType, descriptors) {
    if (BodyPartDescriptionBuilder.NO_ARTICLE_PARTS.has(subType)) {
      return '';
    }

    // Check if descriptors start with a vowel sound
    const firstWord = descriptors ? descriptors.split(/[\s,]/)[0] : subType;
    const vowelStart = /^[aeiou]/i.test(firstWord);

    // Special cases for certain descriptor values
    if (firstWord === 'honest' || firstWord === 'hour') {
      return 'an';
    }

    return vowelStart ? 'an' : 'a';
  }

  /**
   * Get the plural form of a body part
   * @param {string} subType
   * @returns {string}
   */
  getPlural(subType) {
    if (BodyPartDescriptionBuilder.IRREGULAR_PLURALS[subType]) {
      return BodyPartDescriptionBuilder.IRREGULAR_PLURALS[subType];
    }

    // Standard pluralization rules
    if (
      subType.endsWith('s') ||
      subType.endsWith('x') ||
      subType.endsWith('ch') ||
      subType.endsWith('sh')
    ) {
      return `${subType}es`;
    }

    if (subType.endsWith('y') && !/[aeiou]y$/.test(subType)) {
      return `${subType.slice(0, -1)}ies`;
    }

    return `${subType}s`;
  }
}
