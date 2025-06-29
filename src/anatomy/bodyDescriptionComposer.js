import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Service for composing full body descriptions from all body parts
 */
export class BodyDescriptionComposer {
  constructor({ bodyPartDescriptionBuilder, bodyGraphService, entityFinder }) {
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
  }

  /**
   * Part types in the order they should appear in descriptions
   */
  static DESCRIPTION_ORDER = [
    'build', // Overall build first
    'hair', // Head features
    'eye',
    'face',
    'ear',
    'nose',
    'mouth',
    'neck', // Torso
    'breast',
    'torso',
    'arm', // Limbs
    'hand',
    'leg',
    'foot',
    'tail', // Special appendages
    'wing',
  ];

  /**
   * Part types that should be grouped together in description
   */
  static GROUPED_PARTS = new Set([
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
   * Compose a full body description from all body parts
   * @param {Object} bodyEntity - The entity with anatomy:body component
   * @returns {string} The composed description
   */
  composeDescription(bodyEntity) {
    if (!bodyEntity || !bodyEntity.components[ANATOMY_BODY_COMPONENT_ID]) {
      return '';
    }

    const bodyComponent = bodyEntity.components[ANATOMY_BODY_COMPONENT_ID];
    if (!bodyComponent.rootPartId) {
      return '';
    }

    // Get all body parts
    const allParts = this.bodyGraphService.getAllParts(bodyComponent);
    if (!allParts || allParts.length === 0) {
      return '';
    }

    // Group parts by subtype
    const partsByType = this.groupPartsByType(allParts);

    // Build description sections
    const sections = [];

    // Add overall build if available
    const buildDescription = this.extractBuildDescription(bodyEntity);
    if (buildDescription) {
      sections.push(buildDescription);
    }

    // Add head features
    const headDescription = this.composeHeadDescription(partsByType);
    if (headDescription) {
      sections.push(headDescription);
    }

    // Add torso features
    const torsoDescription = this.composeTorsoDescription(partsByType);
    if (torsoDescription) {
      sections.push(torsoDescription);
    }

    // Add limb features
    const limbDescription = this.composeLimbDescription(partsByType);
    if (limbDescription) {
      sections.push(limbDescription);
    }

    // Add special features
    const specialDescription = this.composeSpecialDescription(partsByType);
    if (specialDescription) {
      sections.push(specialDescription);
    }

    // Join all sections
    return sections.join(' ');
  }

  /**
   * Group body parts by their subtype
   * @param {Array<string>} partIds
   * @returns {Map<string, Array<Object>>}
   */
  groupPartsByType(partIds) {
    const partsByType = new Map();

    for (const partId of partIds) {
      const entity = this.entityFinder.getEntity(partId);
      if (!entity || !entity.components['anatomy:part']) {
        continue;
      }

      const subType = entity.components['anatomy:part'].subType;
      if (!subType) {
        continue;
      }

      if (!partsByType.has(subType)) {
        partsByType.set(subType, []);
      }
      partsByType.get(subType).push(entity);
    }

    return partsByType;
  }

  /**
   * Extract overall build description from body entity
   * @param {Object} bodyEntity
   * @returns {string}
   */
  extractBuildDescription(bodyEntity) {
    const buildComponent = bodyEntity.components['descriptors:build'];
    if (!buildComponent || !buildComponent.build) {
      return '';
    }

    return `A ${buildComponent.build} figure`;
  }

  /**
   * Compose description of head features
   * @param {Map<string, Array<Object>>} partsByType
   * @returns {string}
   */
  composeHeadDescription(partsByType) {
    const parts = [];

    // Hair
    if (partsByType.has('hair')) {
      const hairDesc = this.bodyPartDescriptionBuilder.buildDescription(
        partsByType.get('hair')[0]
      );
      if (hairDesc) {
        parts.push(`with ${hairDesc}`);
      }
    }

    // Eyes
    if (partsByType.has('eye')) {
      const eyes = partsByType.get('eye');
      const eyeDesc = this.bodyPartDescriptionBuilder.buildMultipleDescription(
        eyes,
        'eye'
      );
      if (eyeDesc) {
        const connector = parts.length > 0 ? ' and ' : 'with ';
        parts.push(`${connector}${eyeDesc}`);
      }
    }

    // Face features
    const faceFeatures = this.composeFaceFeatures(partsByType);
    if (faceFeatures) {
      parts.push(faceFeatures);
    }

    return parts.join('');
  }

  /**
   * Compose face feature descriptions
   * @param {Map<string, Array<Object>>} partsByType
   * @returns {string}
   */
  composeFaceFeatures(partsByType) {
    const features = [];

    for (const type of ['nose', 'mouth', 'ear']) {
      if (partsByType.has(type)) {
        const parts = partsByType.get(type);
        const desc =
          type === 'ear'
            ? this.bodyPartDescriptionBuilder.buildMultipleDescription(
                parts,
                type
              )
            : this.bodyPartDescriptionBuilder.buildDescription(parts[0]);

        if (desc) {
          features.push(desc);
        }
      }
    }

    if (features.length === 0) {
      return '';
    }

    return ` that frame ${features.join(', ')}`;
  }

  /**
   * Compose description of torso features
   * @param {Map<string, Array<Object>>} partsByType
   * @returns {string}
   */
  composeTorsoDescription(partsByType) {
    const parts = [];

    // Breasts
    if (partsByType.has('breast')) {
      const breasts = partsByType.get('breast');
      const breastDesc =
        this.bodyPartDescriptionBuilder.buildMultipleDescription(
          breasts,
          'breast'
        );
      if (breastDesc) {
        parts.push(`The torso features ${breastDesc}`);
      }
    }

    // General torso
    if (partsByType.has('torso') && parts.length === 0) {
      const torsoDesc = this.bodyPartDescriptionBuilder.buildDescription(
        partsByType.get('torso')[0]
      );
      if (torsoDesc) {
        parts.push(`The body has ${torsoDesc}`);
      }
    }

    return parts.join('. ');
  }

  /**
   * Compose description of limbs
   * @param {Map<string, Array<Object>>} partsByType
   * @returns {string}
   */
  composeLimbDescription(partsByType) {
    const parts = [];

    // Arms and hands
    const armDesc = this.composeAppendageDescription(
      partsByType,
      'arm',
      'hand'
    );
    if (armDesc) {
      parts.push(armDesc);
    }

    // Legs and feet
    const legDesc = this.composeAppendageDescription(
      partsByType,
      'leg',
      'foot'
    );
    if (legDesc) {
      parts.push(legDesc);
    }

    if (parts.length === 0) {
      return '';
    }

    return parts.join(', ') + ' complete the form.';
  }

  /**
   * Compose description for appendages (arms/legs with hands/feet)
   * @param {Map<string, Array<Object>>} partsByType
   * @param {string} mainType - 'arm' or 'leg'
   * @param {string} endType - 'hand' or 'foot'
   * @returns {string}
   */
  composeAppendageDescription(partsByType, mainType, endType) {
    const mainParts = partsByType.get(mainType);
    const endParts = partsByType.get(endType);

    if (!mainParts && !endParts) {
      return '';
    }

    const descriptions = [];

    if (mainParts) {
      const mainDesc = this.bodyPartDescriptionBuilder.buildMultipleDescription(
        mainParts,
        mainType
      );
      if (mainDesc) {
        descriptions.push(mainDesc);
      }
    }

    if (endParts && endParts.length > 0) {
      const endDesc = this.bodyPartDescriptionBuilder.buildMultipleDescription(
        endParts,
        endType
      );
      if (endDesc) {
        const connector = descriptions.length > 0 ? ' ending in ' : '';
        descriptions.push(`${connector}${endDesc}`);
      }
    }

    return descriptions.join('');
  }

  /**
   * Compose description of special features (wings, tail, etc.)
   * @param {Map<string, Array<Object>>} partsByType
   * @returns {string}
   */
  composeSpecialDescription(partsByType) {
    const features = [];

    for (const type of ['wing', 'tail']) {
      if (partsByType.has(type)) {
        const parts = partsByType.get(type);
        const desc = this.bodyPartDescriptionBuilder.buildMultipleDescription(
          parts,
          type
        );
        if (desc) {
          features.push(desc);
        }
      }
    }

    if (features.length === 0) {
      return '';
    }

    return `Special features include ${features.join(' and ')}.`;
  }
}
