import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../constants/componentIds.js';

/**
 * Service for generating and managing descriptions for anatomy parts and bodies
 */
export class AnatomyDescriptionService {
  constructor({
    bodyPartDescriptionBuilder,
    bodyDescriptionComposer,
    bodyGraphService,
    entityFinder,
    componentManager,
  }) {
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyDescriptionComposer = bodyDescriptionComposer;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
    this.componentManager = componentManager;
  }

  /**
   * Generate descriptions for all parts of a body and the body itself
   * @param {Object} bodyEntity - The entity with anatomy:body component
   */
  generateAllDescriptions(bodyEntity) {
    if (!bodyEntity || !bodyEntity.components[ANATOMY_BODY_COMPONENT_ID]) {
      throw new Error('Entity must have an anatomy:body component');
    }

    const bodyComponent = bodyEntity.components[ANATOMY_BODY_COMPONENT_ID];
    if (!bodyComponent.rootPartId) {
      throw new Error('Body component must have a rootPartId');
    }

    // Generate descriptions for all body parts
    const allPartIds = this.bodyGraphService.getAllParts(bodyComponent);
    for (const partId of allPartIds) {
      this.generatePartDescription(partId);
    }

    // Generate the full body description
    this.generateBodyDescription(bodyEntity);
  }

  /**
   * Generate description for a single body part
   * @param {string} partId - The entity ID of the body part
   */
  generatePartDescription(partId) {
    const entity = this.entityFinder.getEntity(partId);
    if (!entity || !entity.components[ANATOMY_PART_COMPONENT_ID]) {
      return;
    }

    // Build the description
    const description =
      this.bodyPartDescriptionBuilder.buildDescription(entity);
    if (!description) {
      return;
    }

    // Update or create the core:description component
    this.updateDescription(partId, description);
  }

  /**
   * Generate the full body description
   * @param {Object} bodyEntity - The entity with anatomy:body component
   */
  generateBodyDescription(bodyEntity) {
    const description =
      this.bodyDescriptionComposer.composeDescription(bodyEntity);
    if (!description) {
      return;
    }

    // Update or create the core:description component
    this.updateDescription(bodyEntity.id, description);
  }

  /**
   * Get or generate body description for an entity
   * @param {Object} entity - The entity to get description for
   * @returns {string|null} The description text or null
   */
  getOrGenerateBodyDescription(entity) {
    if (!entity) {
      return null;
    }

    // Check if entity has anatomy:body component
    if (!entity.components[ANATOMY_BODY_COMPONENT_ID]) {
      // Not an anatomy entity, return existing description if any
      const descComponent = entity.components[DESCRIPTION_COMPONENT_ID];
      return descComponent ? descComponent.text : null;
    }

    // Check if description already exists and is current
    const existingDesc = entity.components[DESCRIPTION_COMPONENT_ID];
    if (
      existingDesc &&
      existingDesc.text &&
      this.isDescriptionCurrent(entity)
    ) {
      return existingDesc.text;
    }

    // Generate new description
    const composedDescription =
      this.bodyDescriptionComposer.composeDescription(entity);
    if (composedDescription) {
      this.updateDescription(entity.id, composedDescription);
      return composedDescription;
    }

    return null;
  }

  /**
   * Update the description component for an entity
   * @param {string} entityId - The entity to update
   * @param {string} description - The new description text
   */
  updateDescription(entityId, description) {
    const entity = this.entityFinder.getEntity(entityId);
    if (!entity) {
      return;
    }

    // Check if description component exists
    if (entity.components[DESCRIPTION_COMPONENT_ID]) {
      // Update existing component
      this.componentManager.updateComponent(
        entityId,
        DESCRIPTION_COMPONENT_ID,
        {
          text: description,
        }
      );
    } else {
      // Add new component
      this.componentManager.addComponent(entityId, DESCRIPTION_COMPONENT_ID, {
        text: description,
      });
    }
  }

  /**
   * Check if the current description is up to date
   * @param {Object} entity - The entity to check
   * @returns {boolean}
   */
  isDescriptionCurrent(entity) {
    // For now, we'll always regenerate to ensure accuracy
    // In the future, we could add timestamp tracking or checksums
    return false;
  }

  /**
   * Regenerate descriptions for all body parts of an entity
   * @param {string} entityId - The entity ID
   */
  regenerateDescriptions(entityId) {
    const entity = this.entityFinder.getEntity(entityId);
    if (!entity || !entity.components[ANATOMY_BODY_COMPONENT_ID]) {
      return;
    }

    this.generateAllDescriptions(entity);
  }
}
