import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * Service for generating and managing descriptions for anatomy parts and bodies
 * This service now delegates to specialized services following SOLID principles
 */
export class AnatomyDescriptionService {
  constructor({
    bodyPartDescriptionBuilder,
    bodyDescriptionComposer,
    bodyGraphService,
    entityFinder,
    componentManager,
    eventDispatchService,
    partDescriptionGenerator,
    bodyDescriptionOrchestrator,
    descriptionPersistenceService,
  }) {
    // Keep original dependencies for backward compatibility
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyDescriptionComposer = bodyDescriptionComposer;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
    this.componentManager = componentManager;
    this.eventDispatchService = eventDispatchService;

    // New specialized services
    this.partDescriptionGenerator = partDescriptionGenerator;
    this.bodyDescriptionOrchestrator = bodyDescriptionOrchestrator;
    this.descriptionPersistenceService = descriptionPersistenceService;
  }

  /**
   * Generate descriptions for all parts of a body and the body itself
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   */
  async generateAllDescriptions(bodyEntity) {
    // Delegate to the orchestrator if available
    if (this.bodyDescriptionOrchestrator) {
      const { bodyDescription, partDescriptions } =
        await this.bodyDescriptionOrchestrator.generateAllDescriptions(
          bodyEntity
        );

      // Persist the descriptions
      if (this.descriptionPersistenceService) {
        this.descriptionPersistenceService.updateDescription(
          bodyEntity.id,
          bodyDescription
        );
        await this.descriptionPersistenceService.updateMultipleDescriptions(
          partDescriptions
        );
      }
      return;
    }

    // Fallback to original implementation for backward compatibility
    if (!bodyEntity || !bodyEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      throw new Error('Entity must have an anatomy:body component');
    }

    const bodyComponent = bodyEntity.getComponentData(
      ANATOMY_BODY_COMPONENT_ID
    );
    if (!bodyComponent.body || !bodyComponent.body.root) {
      throw new Error('Body component must have a body.root property');
    }

    // Generate descriptions for all body parts
    const allPartIds = this.bodyGraphService.getAllParts(bodyComponent.body);
    for (const partId of allPartIds) {
      this.generatePartDescription(partId);
    }

    // Generate the full body description
    await this.generateBodyDescription(bodyEntity);
  }

  /**
   * Generate description for a single body part
   *
   * @param {string} partId - The entity ID of the body part
   */
  generatePartDescription(partId) {
    // Delegate to the part generator if available
    if (this.partDescriptionGenerator) {
      const description =
        this.partDescriptionGenerator.generatePartDescription(partId);
      if (description && this.descriptionPersistenceService) {
        this.descriptionPersistenceService.updateDescription(
          partId,
          description
        );
      }
      return;
    }

    // Fallback to original implementation
    const entity = this.entityFinder.getEntityInstance(partId);
    if (!entity || !entity.hasComponent(ANATOMY_PART_COMPONENT_ID)) {
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
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   */
  async generateBodyDescription(bodyEntity) {
    // Delegate to the orchestrator if available
    if (this.bodyDescriptionOrchestrator) {
      const description =
        await this.bodyDescriptionOrchestrator.generateBodyDescription(
          bodyEntity
        );
      if (this.descriptionPersistenceService) {
        this.descriptionPersistenceService.updateDescription(
          bodyEntity.id,
          description
        );
      }
      return;
    }

    // Fallback to original implementation
    const description =
      await this.bodyDescriptionComposer.composeDescription(bodyEntity);

    // Check if description is empty and dispatch error if so
    if (!description || description.trim() === '') {
      const entityName = bodyEntity.getComponentData('core:name');
      const nameText = entityName ? entityName.text : bodyEntity.id;

      if (this.eventDispatchService) {
        this.eventDispatchService.safeDispatchEvent(SYSTEM_ERROR_OCCURRED_ID, {
          message: `Failed to generate body description for entity "${nameText}": Description is empty`,
          details: {
            raw: `Entity ID: ${bodyEntity.id}, Recipe ID: ${bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID)?.recipeId || 'unknown'}`,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Always update or create the core:description component, even if empty
    this.updateDescription(bodyEntity.id, description);
  }

  /**
   * Get or generate body description for an entity
   *
   * @param {object} entity - The entity to get description for
   * @returns {Promise<string|null>} The description text or null
   */
  async getOrGenerateBodyDescription(entity) {
    // Delegate to the orchestrator if available
    if (this.bodyDescriptionOrchestrator) {
      const description =
        await this.bodyDescriptionOrchestrator.getOrGenerateBodyDescription(
          entity
        );
      if (
        description &&
        entity.hasComponent(ANATOMY_BODY_COMPONENT_ID) &&
        this.descriptionPersistenceService
      ) {
        this.descriptionPersistenceService.updateDescription(
          entity.id,
          description
        );
      }
      return description;
    }

    // Fallback to original implementation
    if (!entity) {
      return null;
    }

    // Check if entity has anatomy:body component
    if (!entity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      // Not an anatomy entity, return existing description if any
      const descComponent = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
      return descComponent ? descComponent.text : null;
    }

    // Check if description already exists and is current
    const existingDesc = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
    if (
      existingDesc &&
      existingDesc.text &&
      this.isDescriptionCurrent(entity)
    ) {
      return existingDesc.text;
    }

    // Generate new description
    const composedDescription =
      await this.bodyDescriptionComposer.composeDescription(entity);
    if (composedDescription) {
      this.updateDescription(entity.id, composedDescription);
      return composedDescription;
    }

    return null;
  }

  /**
   * Update the description component for an entity
   *
   * @param {string} entityId - The entity to update
   * @param {string} description - The new description text
   */
  updateDescription(entityId, description) {
    // Delegate to the persistence service if available
    if (this.descriptionPersistenceService) {
      this.descriptionPersistenceService.updateDescription(
        entityId,
        description
      );
      return;
    }

    // Fallback to original implementation
    const entity = this.entityFinder.getEntityInstance(entityId);
    if (!entity) {
      return;
    }

    // EntityManager's addComponent handles both adding and updating
    this.componentManager.addComponent(entityId, DESCRIPTION_COMPONENT_ID, {
      text: description,
    });
  }

  /**
   * Check if the current description is up to date
   *
   * @param {object} _entity - The entity to check (unused for now)
   * @returns {boolean} Always returns false to force regeneration
   */
  isDescriptionCurrent(_entity) {
    // For now, we'll always regenerate to ensure accuracy
    // In the future, we could add timestamp tracking or checksums
    return false;
  }

  /**
   * Regenerate descriptions for all body parts of an entity
   *
   * @param {string} entityId - The entity ID
   */
  regenerateDescriptions(entityId) {
    const entity = this.entityFinder.getEntityInstance(entityId);
    if (!entity || !entity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      return;
    }

    this.generateAllDescriptions(entity);
  }
}
