import { DescriptorFormatter } from './descriptorFormatter.js';

/**
 * Service for building descriptions of individual body parts from their components
 */
export class BodyPartDescriptionBuilder {
  // Component types that can be present on body parts
  static COMPONENT_TYPES = [
    'anatomy:part',
    'descriptors:body_composition',
    'descriptors:body_hair',
    'descriptors:build',
    'descriptors:color_basic',
    'descriptors:color_extended',
    'descriptors:facial_hair',
    'descriptors:firmness',
    'descriptors:hair_style',
    'descriptors:length_category',
    'descriptors:length_hair',
    'descriptors:projection',
    'descriptors:shape_eye',
    'descriptors:shape_general',
    'descriptors:size_category',
    'descriptors:size_specific',
    'descriptors:texture',
    'descriptors:weight_feel',
  ];

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
  }

  /**
   * Build a description for a single body part
   *
   * @param {object} entity - The body part entity
   * @returns {string} The generated description (just descriptors)
   */
  buildDescription(entity) {
    if (!entity) {
      return '';
    }

    // Handle both direct components property and getComponentData method
    let components = entity.components;
    if (!components && entity.getComponentData) {
      components = this.#extractEntityComponents(entity);
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

    const descriptors = this.descriptorFormatter.extractDescriptors(components);
    const formattedDescriptors =
      this.descriptorFormatter.formatDescriptors(descriptors);

    // Return just the descriptors, no articles or part names
    return formattedDescriptors;
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
        components = this.#extractEntityComponents(entity);
      }
      const descriptors = this.descriptorFormatter.extractDescriptors(
        components || {}
      );
      return this.descriptorFormatter.formatDescriptors(descriptors);
    });

    // For paired parts, check if all descriptors are the same
    const allSame = allDescriptors.every((desc) => desc === allDescriptors[0]);
    const pairedParts = this.anatomyFormattingService?.getPairedParts
      ? this.anatomyFormattingService.getPairedParts()
      : this._defaultPairedParts;

    if (allSame && pairedParts.has(subType)) {
      // Return same descriptors for paired parts
      return allDescriptors[0];
    } else {
      // Return array of different descriptors (will be handled by composer)
      return allDescriptors.filter((desc) => desc !== '');
    }
  }

  /**
   * Get the plural form of a body part
   * Still needed for the composer to handle plural forms
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

  /**
   * Extract components from an entity using getComponentData method
   *
   * @private
   * @param {object} entity - Entity with getComponentData method
   * @returns {object} Object containing all found components
   */
  #extractEntityComponents(entity) {
    const components = {};

    for (const compType of BodyPartDescriptionBuilder.COMPONENT_TYPES) {
      try {
        const data = entity.getComponentData(compType);
        if (data) {
          components[compType] = data;
        }
      } catch (e) {
        // Component doesn't exist on entity - this is expected
      }
    }

    return components;
  }
}
