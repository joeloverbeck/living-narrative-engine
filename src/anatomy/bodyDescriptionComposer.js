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

    const bodyComponent = bodyEntity.getComponentData(
      ANATOMY_BODY_COMPONENT_ID
    );
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

    // Build structured description following configured order
    const lines = [];
    const descriptionOrder = this.anatomyFormattingService?.getDescriptionOrder
      ? this.anatomyFormattingService.getDescriptionOrder()
      : this._defaultDescriptionOrder;
    const processedTypes = new Set();

    // Process parts in configured order
    for (const partType of descriptionOrder) {
      if (processedTypes.has(partType)) {
        continue;
      }

      // Handle overall build
      if (partType === 'build') {
        const buildDescription = this.extractBuildDescription(bodyEntity);
        if (buildDescription) {
          lines.push(`Build: ${buildDescription}`);
        }
        processedTypes.add(partType);
        continue;
      }

      // Process body parts
      if (partsByType.has(partType)) {
        const parts = partsByType.get(partType);
        const structuredLine = this.createStructuredLine(partType, parts);
        if (structuredLine) {
          lines.push(structuredLine);
        }
        processedTypes.add(partType);
      }
    }

    // Join all lines with newlines
    return lines.join('\n');
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
   * Create a structured line for a body part type
   *
   * @param {string} partType
   * @param {Array<object>} parts
   * @returns {string}
   */
  createStructuredLine(partType, parts) {
    if (!parts || parts.length === 0) {
      return '';
    }

    const pairedParts = this.anatomyFormattingService?.getPairedParts
      ? this.anatomyFormattingService.getPairedParts()
      : this._defaultGroupedParts;

    // Get descriptions from core:description component
    const descriptions = parts.map(part => {
      if (!part) return '';
      
      if (typeof part.getComponentData === 'function') {
        const descComponent = part.getComponentData('core:description');
        return descComponent ? descComponent.text : '';
      }
      return '';
    }).filter(desc => desc); // Remove empty descriptions

    if (descriptions.length === 0) {
      return '';
    }

    // Check if all descriptions are the same
    const allSame = descriptions.every(desc => desc === descriptions[0]);

    // Handle different cases
    if (descriptions.length === 1) {
      // Single part
      const label = this.getPartLabel(partType, 1);
      return `${label}: ${descriptions[0]}`;
    } else if (pairedParts.has(partType) && descriptions.length === 2) {
      // Paired parts (e.g., eyes, ears, hands)
      if (allSame) {
        // Same description for both parts
        const label = this.getPartLabel(partType, 2);
        return `${label}: ${descriptions[0]}`;
      } else {
        // Different descriptions for left/right
        const lines = [];
        const names = parts.map(part => {
          const nameComp = part.getComponentData('core:name');
          return nameComp ? nameComp.text.toLowerCase() : '';
        });
        
        // Try to determine left/right based on name
        for (let i = 0; i < descriptions.length && i < 2; i++) {
          const name = names[i] || '';
          if (name.includes('left')) {
            lines.push(`Left ${partType}: ${descriptions[i]}`);
          } else if (name.includes('right')) {
            lines.push(`Right ${partType}: ${descriptions[i]}`);
          } else {
            // Fallback if no left/right in name
            lines.push(`${this.capitalize(partType)} ${i + 1}: ${descriptions[i]}`);
          }
        }
        return lines.join('\n');
      }
    } else {
      // Multiple parts with potentially different descriptions
      if (allSame) {
        const label = this.getPartLabel(partType, descriptions.length);
        return `${label}: ${descriptions[0]}`;
      } else {
        // Multiple different descriptions
        return descriptions
          .map((desc, index) => `${this.capitalize(partType)} ${index + 1}: ${desc}`)
          .join('\n');
      }
    }
  }

  /**
   * Get the appropriate label for a body part
   *
   * @param {string} partType
   * @param {number} count
   * @returns {string}
   */
  getPartLabel(partType, count) {
    const pairedParts = this.anatomyFormattingService?.getPairedParts
      ? this.anatomyFormattingService.getPairedParts()
      : this._defaultGroupedParts;

    // Capitalize first letter
    const capitalizedType = this.capitalize(partType);

    // Handle pluralization for multiple parts
    if (count > 1 && pairedParts.has(partType)) {
      const plural = this.bodyPartDescriptionBuilder.getPlural(partType);
      return this.capitalize(plural);
    }

    return capitalizedType;
  }

  /**
   * Capitalize the first letter of a string
   *
   * @param {string} str
   * @returns {string}
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
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

    return buildComponent.build;
  }
}
