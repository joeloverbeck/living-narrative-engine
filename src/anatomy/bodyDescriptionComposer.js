import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';
import { DescriptionConfiguration } from './configuration/descriptionConfiguration.js';
import { DescriptionTemplate } from './templates/descriptionTemplate.js';
import { TextFormatter } from './templates/textFormatter.js';

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

    // Initialize configuration and template services
    this.config = new DescriptionConfiguration(anatomyFormattingService);
    this.descriptionTemplate = new DescriptionTemplate({
      config: this.config,
      textFormatter: new TextFormatter(),
    });
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
    const descriptionOrder = this.config.getDescriptionOrder();
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
        const structuredLine = this.descriptionTemplate.createStructuredLine(partType, parts);
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
