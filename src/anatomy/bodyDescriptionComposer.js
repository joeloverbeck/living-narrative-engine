import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Service for composing full body descriptions from all body parts
 */
export class BodyDescriptionComposer {
  constructor({
    bodyPartDescriptionBuilder,
    bodyGraphService,
    entityFinder,
    anatomyFormattingService,
  } = {}) {
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
    this.anatomyFormattingService = anatomyFormattingService;

    // Default values for backward compatibility
    this._defaultDescriptionOrder = [
      'build',
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
    ];

    this._defaultGroupedParts = new Set([
      'eye',
      'ear',
      'arm',
      'leg',
      'hand',
      'foot',
      'breast',
      'wing',
    ]);
  }

  /**
   * Compose a full body description from all body parts
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {string} The composed description
   */
  composeDescription(bodyEntity) {
    if (!bodyEntity || !bodyEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      return '';
    }

    const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
    if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.root) {
      return '';
    }

    // Get all body parts
    const allParts = this.bodyGraphService.getAllParts(bodyComponent.body);
    if (!allParts || allParts.length === 0) {
      return '';
    }

    // Group parts by subtype
    const partsByType = this.groupPartsByType(allParts);

    // Build description sections following configured order
    const sections = [];
    const descriptionOrder = this.anatomyFormattingService?.getDescriptionOrder
      ? this.anatomyFormattingService.getDescriptionOrder()
      : this._defaultDescriptionOrder;
    const processedTypes = new Set();

    // Process parts in configured order
    for (const partType of descriptionOrder) {
      if (processedTypes.has(partType)) {
        continue;
      }

      // Handle overall build separately
      if (partType === 'build') {
        const buildDescription = this.extractBuildDescription(bodyEntity);
        if (buildDescription) {
          sections.push(buildDescription);
        }
        processedTypes.add(partType);
        continue;
      }

      // Check if this is a grouped part type
      const groupedParts = this.anatomyFormattingService?.getGroupedParts
        ? this.anatomyFormattingService.getGroupedParts()
        : this._defaultGroupedParts;
      if (groupedParts.has(partType) && partsByType.has(partType)) {
        // Handle grouped parts (will be processed later in context)
        continue;
      }

      // Skip parts that are handled in section methods
      const sectionHandledParts = [
        'hair',
        'eye',
        'ear',
        'nose',
        'mouth',
        'face',
        'neck',
        'breast',
        'torso',
        'arm',
        'hand',
        'leg',
        'foot',
        'tail',
        'wing',
      ];
      if (sectionHandledParts.includes(partType)) {
        continue;
      }

      // Process individual part types not handled by sections
      if (partsByType.has(partType)) {
        const partDescription = this.composeSinglePartDescription(
          partType,
          partsByType
        );
        if (partDescription) {
          sections.push(partDescription);
        }
        processedTypes.add(partType);
      }
    }

    // Add head features section (handles grouped face parts)
    const headDescription = this.composeHeadDescription(partsByType);
    if (headDescription) {
      sections.push(headDescription);
    }

    // Add torso features section
    const torsoDescription = this.composeTorsoDescription(partsByType);
    if (torsoDescription) {
      sections.push(torsoDescription);
    }

    // Add limb features section
    const limbDescription = this.composeLimbDescription(partsByType);
    if (limbDescription) {
      sections.push(limbDescription);
    }

    // Add special features section
    const specialDescription = this.composeSpecialDescription(partsByType);
    if (specialDescription) {
      sections.push(specialDescription);
    }

    // Join all sections
    return sections.join(' ');
  }

  /**
   * Group body parts by their subtype
   *
   * @param {Array<string>} partIds
   * @returns {Map<string, Array<object>>}
   */
  groupPartsByType(partIds) {
    const partsByType = new Map();

    for (const partId of partIds) {
      const entity = this.entityFinder.getEntityInstance(partId);
      if (!entity) {
        continue;
      }

      // Check if entity has the required methods
      if (!entity || typeof entity.hasComponent !== 'function') {
        continue;
      }
      
      if (!entity.hasComponent('anatomy:part')) {
        continue;
      }

      if (typeof entity.getComponentData !== 'function') {
        continue;
      }

      const anatomyPart = entity.getComponentData('anatomy:part');
      if (!anatomyPart || !anatomyPart.subType) {
        continue;
      }

      const subType = anatomyPart.subType;

      if (!partsByType.has(subType)) {
        partsByType.set(subType, []);
      }
      partsByType.get(subType).push(entity);
    }

    return partsByType;
  }

  /**
   * Compose description for a single part type
   *
   * @param {string} partType
   * @param {Map<string, Array<object>>} partsByType
   * @returns {string}
   */
  composeSinglePartDescription(partType, partsByType) {
    const parts = partsByType.get(partType);
    if (!parts || parts.length === 0) {
      return '';
    }

    const groupedParts = this.anatomyFormattingService?.getGroupedParts
      ? this.anatomyFormattingService.getGroupedParts()
      : this._defaultGroupedParts;
    if (groupedParts.has(partType)) {
      // Use multiple description for grouped parts
      return this.bodyPartDescriptionBuilder.buildMultipleDescription(
        parts,
        partType
      );
    } else {
      // Use single description for non-grouped parts
      return this.bodyPartDescriptionBuilder.buildDescription(parts[0]);
    }
  }

  /**
   * Extract overall build description from body entity
   *
   * @param {object} bodyEntity
   * @returns {string}
   */
  extractBuildDescription(bodyEntity) {
    if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
      return '';
    }
    
    const buildComponent = bodyEntity.getComponentData('descriptors:build');
    if (!buildComponent || !buildComponent.build) {
      return '';
    }

    return `A ${buildComponent.build} figure`;
  }

  /**
   * Compose description of head features
   *
   * @param {Map<string, Array<object>>} partsByType
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
   *
   * @param {Map<string, Array<object>>} partsByType
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
   *
   * @param {Map<string, Array<object>>} partsByType
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
   *
   * @param {Map<string, Array<object>>} partsByType
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
   *
   * @param {Map<string, Array<object>>} partsByType
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
   *
   * @param {Map<string, Array<object>>} partsByType
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
