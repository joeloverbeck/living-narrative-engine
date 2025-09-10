/**
 * @file Fluent API for building test entities in mod integration tests
 * @description Provides a convenient builder pattern for creating complex entity structures
 */

import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { string } from '../../../src/utils/validationCore.js';
import { assertPresent } from '../../../src/utils/dependencyUtils.js';

/**
 * Builder class for creating test entities with a fluent API.
 *
 * Eliminates the need for manual entity object construction in mod tests,
 * providing a clear, readable way to build complex entity structures.
 *
 * @example
 * const actor = new ModEntityBuilder('actor1')
 *   .withName('Alice')
 *   .atLocation('room1')
 *   .closeToEntity('target1')
 *   .build();
 */
export class ModEntityBuilder {
  /**
   * Creates a new entity builder.
   *
   * @param {string} id - The entity ID
   */
  constructor(id) {
    string.assertNonBlank(id, 'Entity ID', 'ModEntityBuilder constructor');

    this.entityData = {
      id,
      components: {},
    };
  }

  /**
   * Sets the entity's name component.
   *
   * @param {string} name - The display name for the entity
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withName(name) {
    string.assertNonBlank(name, 'Entity name', 'ModEntityBuilder.withName');

    this.entityData.components[NAME_COMPONENT_ID] = { text: name };
    return this;
  }

  /**
   * Sets the entity's description component.
   *
   * @param {string} description - The description text for the entity
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withDescription(description) {
    string.assertNonBlank(
      description,
      'Entity description',
      'ModEntityBuilder.withDescription'
    );

    this.entityData.components[DESCRIPTION_COMPONENT_ID] = {
      text: description,
    };
    return this;
  }

  /**
   * Sets the entity's location.
   *
   * @param {string} locationId - The location entity ID
   * @returns {ModEntityBuilder} This builder for chaining
   */
  atLocation(locationId) {
    string.assertNonBlank(
      locationId,
      'Location ID',
      'ModEntityBuilder.atLocation'
    );

    this.entityData.components[POSITION_COMPONENT_ID] = { locationId };
    return this;
  }

  /**
   * Sets the entity's location to match another entity's location.
   *
   * @param {object} otherEntity - The entity whose location to match
   * @returns {ModEntityBuilder} This builder for chaining
   */
  inSameLocationAs(otherEntity) {
    assertPresent(otherEntity, 'Other entity is required');

    if (
      !otherEntity.components ||
      !otherEntity.components[POSITION_COMPONENT_ID]
    ) {
      throw new Error(
        'ModEntityBuilder.inSameLocationAs: otherEntity must have a position component'
      );
    }

    const otherLocation =
      otherEntity.components[POSITION_COMPONENT_ID].locationId;
    return this.atLocation(otherLocation);
  }

  /**
   * Adds positioning:closeness component with the specified partners.
   *
   * @param {string|Array<string>} partnerIds - Single partner ID or array of partner IDs
   * @returns {ModEntityBuilder} This builder for chaining
   */
  closeToEntity(partnerIds) {
    const partners = Array.isArray(partnerIds) ? partnerIds : [partnerIds];
    this.entityData.components['positioning:closeness'] = { partners };
    return this;
  }

  /**
   * Adds a custom component to the entity.
   *
   * @param {string} componentId - The component type ID
   * @param {object} componentData - The component data
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withComponent(componentId, componentData) {
    string.assertNonBlank(
      componentId,
      'Component ID',
      'ModEntityBuilder.withComponent'
    );
    assertPresent(componentData, 'Component data is required');

    this.entityData.components[componentId] = componentData;
    return this;
  }

  /**
   * Sets the entity as an actor by adding the core:actor component.
   *
   * @param {object} [actorData] - Optional actor-specific data
   * @returns {ModEntityBuilder} This builder for chaining
   */
  asActor(actorData = {}) {
    this.entityData.components[ACTOR_COMPONENT_ID] = actorData;
    return this;
  }

  /**
   * Sets the entity's location component for close proximity checks.
   *
   * @param {string} locationId - The location ID
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withLocationComponent(locationId) {
    string.assertNonBlank(
      locationId,
      'Location ID',
      'ModEntityBuilder.withLocationComponent'
    );

    this.entityData.components['core:location'] = { location: locationId };
    return this;
  }

  /**
   * Adds anatomy:body component with the specified body structure.
   *
   * @param {string} rootPartId - The root body part entity ID
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withBody(rootPartId) {
    this.entityData.components['anatomy:body'] = {
      body: { root: rootPartId },
    };
    return this;
  }

  /**
   * Adds an anatomy:part component for body parts.
   *
   * @param {object} options - Part configuration
   * @param {string} [options.parent] - Parent part entity ID
   * @param {Array<string>} [options.children] - Child part entity IDs
   * @param {string} options.subType - The body part subtype
   * @returns {ModEntityBuilder} This builder for chaining
   */
  asBodyPart(options = {}) {
    const { parent = null, children = [], subType } = options;
    this.entityData.components['anatomy:part'] = {
      parent,
      children,
      subType,
    };
    return this;
  }

  /**
   * Adds positioning:kneeling_before component.
   *
   * @param {string} targetEntityId - The entity being knelt before
   * @returns {ModEntityBuilder} This builder for chaining
   */
  kneelingBefore(targetEntityId) {
    this.entityData.components['positioning:kneeling_before'] = {
      entityId: targetEntityId,
    };
    return this;
  }

  /**
   * Adds positioning:facing component.
   *
   * @param {string} direction - The facing direction
   * @returns {ModEntityBuilder} This builder for chaining
   */
  facing(direction) {
    this.entityData.components['positioning:facing'] = {
      direction,
    };
    return this;
  }

  /**
   * Adds a clothing component.
   *
   * @param {object} clothingData - The clothing configuration
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withClothing(clothingData) {
    this.entityData.components['clothing:items'] = clothingData;
    return this;
  }

  /**
   * Marks this entity as a room/location.
   *
   * @param {string} roomName - The room display name
   * @returns {ModEntityBuilder} This builder for chaining
   */
  asRoom(roomName) {
    this.withName(roomName);
    // Add any room-specific components here if needed
    return this;
  }

  /**
   * Creates multiple components at once from an object.
   *
   * @param {object} components - Object mapping component IDs to component data
   * @returns {ModEntityBuilder} This builder for chaining
   */
  withComponents(components) {
    Object.assign(this.entityData.components, components);
    return this;
  }

  /**
   * Validates the entity structure before building.
   *
   * @returns {ModEntityBuilder} This builder for chaining
   * @throws {Error} If entity structure is invalid
   */
  validate() {
    // Validate entity ID
    if (!this.entityData.id) {
      throw new Error('ModEntityBuilder.validate: Entity ID is required');
    }

    // Validate components structure
    if (typeof this.entityData.components !== 'object') {
      throw new Error(
        'ModEntityBuilder.validate: Components must be an object'
      );
    }

    // Validate required components if any exist
    const hasPosition = this.entityData.components[POSITION_COMPONENT_ID];
    if (hasPosition && !hasPosition.locationId) {
      throw new Error(
        'ModEntityBuilder.validate: Position component must have locationId'
      );
    }

    const hasName = this.entityData.components[NAME_COMPONENT_ID];
    if (hasName && !hasName.text) {
      throw new Error(
        'ModEntityBuilder.validate: Name component must have text'
      );
    }

    return this;
  }

  /**
   * Returns the built entity object.
   *
   * @returns {object} The complete entity object
   */
  build() {
    return { ...this.entityData };
  }
}

/**
 * Helper class for building common entity scenarios.
 */
export class ModEntityScenarios {
  /**
   * Creates a basic actor-target pair in the same room.
   *
   * @param {object} options - Configuration options
   * @param {Array<string>} [options.names] - Names for actor and target
   * @param {string} [options.location] - Location ID
   * @param {boolean} [options.closeProximity] - Whether entities are close to each other
   * @returns {object} Object with actor and target entities
   */
  static createActorTargetPair(options = {}) {
    const {
      names = ['Alice', 'Bob'],
      location = 'room1',
      closeProximity = false,
      idPrefix = '',
    } = options;

    const [actorName, targetName] = names;
    const actorId = `${idPrefix}actor1`;
    const targetId = `${idPrefix}target1`;

    const actor = new ModEntityBuilder(actorId)
      .withName(actorName)
      .atLocation(location)
      .withLocationComponent(location)
      .asActor();

    const target = new ModEntityBuilder(targetId)
      .withName(targetName)
      .atLocation(location)
      .withLocationComponent(location)
      .asActor();

    if (closeProximity) {
      actor.closeToEntity(targetId);
      target.closeToEntity(actorId);
    }

    return {
      actor: actor.build(),
      target: target.build(),
    };
  }

  /**
   * Creates a multi-actor scenario with observers.
   *
   * @param {object} options - Configuration options
   * @param {Array<string>} options.names - Names for all entities
   * @param {string} [options.location] - Location ID
   * @param {number} [options.closeToMain] - How many entities are close to the main actor
   * @returns {object} Object with main actor, target, and observers
   */
  static createMultiActorScenario(options = {}) {
    const {
      names = ['Alice', 'Bob', 'Charlie', 'Diana'],
      location = 'room1',
      closeToMain = 1,
    } = options;

    const entities = [];
    const [actorName, targetName, ...observerNames] = names;

    // Create main actor
    const actor = new ModEntityBuilder('actor1')
      .withName(actorName)
      .atLocation(location)
      .withLocationComponent(location);

    // Collect all close relationships for the actor
    const actorPartners = [];

    // Add close proximity to target if requested
    if (closeToMain >= 1) {
      actorPartners.push('target1');
    }

    // Add close proximity for additional close entities
    observerNames.forEach((name, index) => {
      if (index + 2 <= closeToMain) {
        const observerId = `observer${index + 1}`;
        actorPartners.push(observerId);
      }
    });

    // Set all actor partnerships at once
    if (actorPartners.length > 0) {
      actor.closeToEntity(actorPartners);
    }

    entities.push(actor.build());

    // Create target
    const target = new ModEntityBuilder('target1')
      .withName(targetName)
      .atLocation(location)
      .withLocationComponent(location);

    if (closeToMain >= 1) {
      target.closeToEntity('actor1');
    }

    entities.push(target.build());

    // Create observers
    const observers = observerNames.map((name, index) => {
      const observerId = `observer${index + 1}`;
      const observer = new ModEntityBuilder(observerId)
        .withName(name)
        .atLocation(location)
        .withLocationComponent(location);

      // Add close proximity for additional close entities
      if (index + 2 <= closeToMain) {
        observer.closeToEntity('actor1');
      }

      return observer.build();
    });

    entities.push(...observers);

    return {
      actor: entities[0],
      target: entities[1],
      observers,
      allEntities: entities,
    };
  }

  /**
   * Creates an anatomy scenario with body parts.
   *
   * @param {object} options - Configuration options
   * @param {Array<string>} [options.names] - Names for actor and target
   * @param {string} [options.location] - Location ID
   * @param {Array<string>} [options.bodyParts] - Body part types to create
   * @returns {object} Object with entities and body parts
   */
  static createAnatomyScenario(options = {}) {
    const {
      names = ['Alice', 'Bob'],
      location = 'room1',
      bodyParts = ['torso', 'breast', 'breast'],
    } = options;

    const [actorName, targetName] = names;

    // Create base entities
    const actor = new ModEntityBuilder('actor1')
      .withName(actorName)
      .atLocation(location)
      .withLocationComponent(location)
      .closeToEntity('target1')
      .asActor();

    const target = new ModEntityBuilder('target1')
      .withName(targetName)
      .atLocation(location)
      .withLocationComponent(location)
      .closeToEntity('actor1')
      .withBody('torso1')
      .asActor();

    const entities = [actor.build(), target.build()];

    // Create body parts
    const bodyPartEntities = [];
    let partCounter = 1;

    bodyParts.forEach((partType, index) => {
      const partId = `${partType}${partCounter++}`;
      const isRoot = index === 0;

      const part = new ModEntityBuilder(partId)
        .asBodyPart({
          parent: isRoot ? null : 'torso1',
          children: isRoot
            ? bodyParts.slice(1).map((_, i) => `${bodyParts[i + 1]}${i + 2}`)
            : [],
          subType: partType,
        })
        .atLocation(location)
        .withLocationComponent(location);

      bodyPartEntities.push(part.build());
    });

    return {
      actor: entities[0],
      target: entities[1],
      bodyParts: bodyPartEntities,
      allEntities: [...entities, ...bodyPartEntities],
    };
  }

  /**
   * Creates a room entity with the specified name.
   *
   * @param {string} [roomId] - The room entity ID
   * @param {string} [roomName] - The room display name
   * @returns {object} The room entity
   */
  static createRoom(roomId = 'room1', roomName = 'Test Room') {
    return new ModEntityBuilder(roomId).asRoom(roomName).build();
  }

  /**
   * Creates entities for positioning tests.
   *
   * @param {object} options - Configuration options
   * @param {Array<string>} [options.names] - Entity names
   * @param {string} [options.location] - Location ID
   * @param {string} [options.positioning] - Initial positioning setup
   * @returns {object} Entities configured for positioning tests
   */
  static createPositioningScenario(options = {}) {
    const {
      names = ['Alice', 'Bob'],
      location = 'room1',
      positioning = 'standing',
    } = options;

    const scenario = this.createActorTargetPair({
      names,
      location,
      closeProximity: true,
    });

    // Add positioning-specific setup
    if (positioning === 'kneeling') {
      scenario.actor = new ModEntityBuilder('actor1')
        .withName(names[0])
        .atLocation(location)
        .kneelingBefore('target1')
        .build();
    } else if (positioning === 'facing_away') {
      scenario.target = new ModEntityBuilder('target1')
        .withName(names[1])
        .atLocation(location)
        .facing('away')
        .build();
    }

    return scenario;
  }
}

export default ModEntityBuilder;
