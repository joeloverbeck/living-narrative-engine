import { DescriptorFormatter } from './descriptorFormatter.js';

/**
 * Service for building descriptions of individual body parts from their components
 */
export class BodyPartDescriptionBuilder {
  constructor({ descriptorFormatter, anatomyFormattingService } = {}) {
    this.descriptorFormatter = descriptorFormatter;
    this.anatomyFormattingService = anatomyFormattingService;

    // Default values for backward compatibility
    this._defaultPairedParts = new Set([
      'eye',
      'ear',
      'arm',
      'leg',
      'hand',
      'foot',
      'breast',
      'wing',
    ]);

    this._defaultIrregularPlurals = {
      foot: 'feet',
      tooth: 'teeth',
    };

    this._defaultNoArticleParts = new Set(['hair']);
  }

  /**
   * Build a description for a single body part
   *
   * @param {object} entity - The body part entity
   * @returns {string} The generated description
   */
  buildDescription(entity) {
    if (!entity) {
      return '';
    }

    // Handle both direct components property and getComponentData method
    let components = entity.components;
    if (!components && entity.getComponentData) {
      // Build components object from getComponentData calls
      components = {};
      // Get all possible component types that might be present
      const componentTypes = [
        'anatomy:part',
        'descriptors:build',
        'descriptors:color_basic',
        'descriptors:color_extended',
        'descriptors:firmness',
        'descriptors:hair_style',
        'descriptors:length_category',
        'descriptors:length_hair',
        'descriptors:shape_eye',
        'descriptors:shape_general',
        'descriptors:size_category',
        'descriptors:size_specific',
        'descriptors:texture',
        'descriptors:weight_feel',
      ];

      for (const compType of componentTypes) {
        try {
          const data = entity.getComponentData(compType);
          if (data) {
            components[compType] = data;
          }
        } catch (e) {
          // Component doesn't exist on entity
        }
      }
    }

    if (!components) {
      return '';
    }

    const anatomyPart =
      components['anatomy:part'] ||
      (entity.getComponentData
        ? entity.getComponentData('anatomy:part')
        : null);
    if (!anatomyPart || !anatomyPart.subType) {
      return '';
    }

    const subType = anatomyPart.subType;
    const descriptors = this.descriptorFormatter.extractDescriptors(components);
    const formattedDescriptors =
      this.descriptorFormatter.formatDescriptors(descriptors);

    return this.constructDescription(subType, formattedDescriptors);
  }

  /**
   * Build descriptions for multiple body parts of the same type
   *
   * @param {Array<object>} entities - Array of body part entities
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
      if (!entity) {
        return '';
      }
      // Handle both direct components property and getComponentData method
      let components = entity.components;
      if (!components && entity.getComponentData) {
        // Build components object from getComponentData calls
        components = {};
        // Get all possible component types that might be present
        const componentTypes = [
          'anatomy:part',
          'descriptors:build',
          'descriptors:color_basic',
          'descriptors:color_extended',
          'descriptors:firmness',
          'descriptors:hair_style',
          'descriptors:length_category',
          'descriptors:length_hair',
          'descriptors:shape_eye',
          'descriptors:shape_general',
          'descriptors:size_category',
          'descriptors:size_specific',
          'descriptors:texture',
          'descriptors:weight_feel',
        ];

        for (const compType of componentTypes) {
          try {
            const data = entity.getComponentData(compType);
            if (data) {
              components[compType] = data;
            }
          } catch (e) {
            // Component doesn't exist on entity
          }
        }
      }
      const descriptors = this.descriptorFormatter.extractDescriptors(
        components || {}
      );
      return this.descriptorFormatter.formatDescriptors(descriptors);
    });

    const allSame = allDescriptors.every((desc) => desc === allDescriptors[0]);
    const pairedParts = this.anatomyFormattingService?.getPairedParts
      ? this.anatomyFormattingService.getPairedParts()
      : this._defaultPairedParts;

    if (allSame && pairedParts.has(subType)) {
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
   *
   * @param {string} subType
   * @param {string} formattedDescriptors
   * @returns {string}
   */
  constructDescription(subType, formattedDescriptors) {
    const article = this.getArticle(subType, formattedDescriptors);
    const descriptorPart = formattedDescriptors
      ? `${formattedDescriptors} `
      : '';

    const noArticleParts = this.anatomyFormattingService?.getNoArticleParts
      ? this.anatomyFormattingService.getNoArticleParts()
      : this._defaultNoArticleParts;
    if (noArticleParts.has(subType)) {
      // No article for parts like "hair"
      return `${descriptorPart}${subType}`;
    }

    return `${article} ${descriptorPart}${subType}`;
  }

  /**
   * Construct a paired description (e.g., "a pair of blue eyes")
   *
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
   *
   * @param {string} subType
   * @param {string} descriptors
   * @returns {string}
   */
  getArticle(subType, descriptors) {
    const noArticleParts = this.anatomyFormattingService?.getNoArticleParts
      ? this.anatomyFormattingService.getNoArticleParts()
      : this._defaultNoArticleParts;
    if (noArticleParts.has(subType)) {
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
   *
   * @param {string} subType
   * @returns {string}
   */
  getPlural(subType) {
    const irregularPlurals = this.anatomyFormattingService?.getIrregularPlurals
      ? this.anatomyFormattingService.getIrregularPlurals()
      : this._defaultIrregularPlurals;
    if (irregularPlurals[subType]) {
      return irregularPlurals[subType];
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
