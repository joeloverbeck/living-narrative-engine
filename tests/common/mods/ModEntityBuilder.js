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
   * Passing an array replaces any existing partners. Passing a single partner ID appends
   * it to the existing list (unless it is already present).
   *
   * @param {string|Array<string>} partnerIds - Single partner ID or array of partner IDs
   * @returns {ModEntityBuilder} This builder for chaining
   */
  closeToEntity(partnerIds) {
    const closenessComponentId = 'positioning:closeness';

    if (Array.isArray(partnerIds)) {
      const validatedPartners = partnerIds.map((partnerId, index) => {
        string.assertNonBlank(
          partnerId,
          `Closeness partner[${index}]`,
          'ModEntityBuilder.closeToEntity'
        );

        return partnerId;
      });

      this.entityData.components[closenessComponentId] = {
        partners: [...validatedPartners],
      };

      return this;
    }

    string.assertNonBlank(
      partnerIds,
      'Closeness partner',
      'ModEntityBuilder.closeToEntity'
    );

    const existingCloseness =
      this.entityData.components[closenessComponentId] || { partners: [] };
    const existingPartners = existingCloseness.partners || [];

    if (!existingPartners.includes(partnerIds)) {
      this.entityData.components[closenessComponentId] = {
        partners: [...existingPartners, partnerIds],
      };
    }

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
    // Validate entity ID exists
    if (!this.entityData.id) {
      throw new Error(
        'ModEntityBuilder.validate: Entity ID is required\n' +
          '\n' +
          'An entity must have a string ID. Use:\n' +
          '  new ModEntityBuilder("entity-id")\n'
      );
    }

    // Validate entity ID is string (detect double-nesting)
    if (typeof this.entityData.id !== 'string') {
      const actualType = typeof this.entityData.id;
      const actualValue =
        actualType === 'object'
          ? JSON.stringify(this.entityData.id, null, 2)
          : String(this.entityData.id);

      throw new Error(
        '❌ ENTITY DOUBLE-NESTING DETECTED!\n' +
          '\n' +
          `entity.id should be STRING but is ${actualType}:\n` +
          `${actualValue}\n` +
          '\n' +
          'This usually happens when:\n' +
          '  1. An entity instance was passed instead of string ID\n' +
          '  2. A helper function used entity instead of entity.id\n' +
          '\n' +
          'Fix by ensuring all entity manager calls use string IDs:\n' +
          '  ❌ entityManager.addComponent(entity, componentId, data)\n' +
          '  ✅ entityManager.addComponent(entity.id, componentId, data)\n' +
          '\n' +
          '  ❌ builder.closeToEntity(targetEntity)\n' +
          '  ✅ builder.closeToEntity(targetEntity.id)\n'
      );
    }

    // Validate entity ID is non-blank
    if (this.entityData.id.trim() === '') {
      throw new Error(
        'ModEntityBuilder.validate: Entity ID cannot be blank\n' +
          '\n' +
          'Entity IDs must be non-empty strings. Use descriptive IDs like:\n' +
          '  "actor1", "target1", "room-library", "item-sword"\n'
      );
    }

    // Validate components structure
    if (
      typeof this.entityData.components !== 'object' ||
      this.entityData.components === null
    ) {
      throw new Error(
        `ModEntityBuilder.validate: Components must be an object, got: ${typeof this.entityData.components}\n` +
          '\n' +
          'Internal error in ModEntityBuilder - components should be initialized as {}.\n'
      );
    }

    // Validate position component if present
    const hasPosition = this.entityData.components[POSITION_COMPONENT_ID];
    if (hasPosition) {
      if (!hasPosition.locationId) {
        throw new Error(
          `ModEntityBuilder.validate: Position component missing 'locationId' property\n` +
            '\n' +
            'Position component data:\n' +
            `${JSON.stringify(hasPosition, null, 2)}\n` +
            '\n' +
            'Fix using:\n' +
            "  builder.atLocation(\"location-id\")\n" +
            '\n' +
            'Or manually:\n' +
            '  builder.withComponent("core:position", { locationId: "location-id" })\n'
        );
      }

      if (typeof hasPosition.locationId !== 'string') {
        throw new Error(
          `ModEntityBuilder.validate: Position component locationId must be string, got: ${typeof hasPosition.locationId}\n` +
            '\n' +
            'This may indicate entity double-nesting in location references.\n'
        );
      }
    }

    // Validate name component if present
    const hasName = this.entityData.components[NAME_COMPONENT_ID];
    if (hasName) {
      if (!hasName.text) {
        throw new Error(
          `ModEntityBuilder.validate: Name component missing 'text' property\n` +
            '\n' +
            'Name component data:\n' +
            `${JSON.stringify(hasName, null, 2)}\n` +
            '\n' +
            'Fix using:\n' +
            '  builder.withName("name-text")\n' +
            '\n' +
            'Or manually:\n' +
            '  builder.withComponent("core:name", { text: "name-text" })\n'
        );
      }

      if (typeof hasName.text !== 'string') {
        throw new Error(
          `ModEntityBuilder.validate: Name component text must be string, got: ${typeof hasName.text}\n`
        );
      }
    }

    // Validate closeness component if present
    const hasCloseness = this.entityData.components['positioning:closeness'];
    if (hasCloseness) {
      if (!Array.isArray(hasCloseness.partners)) {
        throw new Error(
          `ModEntityBuilder.validate: Closeness component 'partners' must be array, got: ${typeof hasCloseness.partners}\n` +
            '\n' +
            'Closeness component data:\n' +
            `${JSON.stringify(hasCloseness, null, 2)}\n` +
            '\n' +
            'Fix using:\n' +
            '  builder.closeToEntity("target-id")\n' +
            '  builder.closeToEntity(["target1", "target2"])\n'
        );
      }

      // Validate all partners are strings
      for (const [index, partnerId] of hasCloseness.partners.entries()) {
        if (typeof partnerId !== 'string') {
          throw new Error(
            `ModEntityBuilder.validate: Closeness partner at index ${index} must be string, got: ${typeof partnerId}\n` +
              '\n' +
              `Partner value: ${JSON.stringify(partnerId)}\n` +
              '\n' +
              'This indicates entity double-nesting. Use entity IDs, not entity objects:\n' +
              '  ❌ builder.closeToEntity(targetEntity)\n' +
              '  ✅ builder.closeToEntity(targetEntity.id)\n'
          );
        }
      }
    }

    // Validate kneeling component if present
    const hasKneeling =
      this.entityData.components['positioning:kneeling_before'];
    if (hasKneeling) {
      if (!hasKneeling.entityId) {
        throw new Error(
          `ModEntityBuilder.validate: Kneeling component missing 'entityId' property\n` +
            '\n' +
            'Fix using:\n' +
            '  builder.kneelingBefore("target-id")\n'
        );
      }

      if (typeof hasKneeling.entityId !== 'string') {
        throw new Error(
          `ModEntityBuilder.validate: Kneeling entityId must be string, got: ${typeof hasKneeling.entityId}\n` +
            '\n' +
            'This indicates entity double-nesting. Use entity ID, not entity object:\n' +
            '  ❌ builder.kneelingBefore(targetEntity)\n' +
            '  ✅ builder.kneelingBefore(targetEntity.id)\n'
        );
      }
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
   * @description Creates a configurable sitting arrangement with seated, standing, and kneeling actors.
   *
   * @param {object} [options] - Configuration overrides for the scenario
   * @param {string} [options.locationId='room1'] - Location where all entities are placed
   * @param {boolean} [options.includeRoom=true] - Whether to include a room entity in the output
   * @param {string} [options.roomId] - Identifier for the optional room entity
   * @param {string} [options.roomName='Test Room'] - Display name for the optional room entity
   * @param {string} [options.furnitureId='couch1'] - Identifier for the primary furniture entity
   * @param {string} [options.furnitureName='Comfy Couch'] - Display name for the primary furniture entity
   * @param {string} [options.furnitureLocationId] - Location identifier for the primary furniture entity
   * @param {object} [options.furnitureAllowsSitting] - Additional data merged into positioning:allows_sitting for the primary furniture
   * @param {Array<object>} [options.additionalFurniture] - Extra furniture definitions with optional allows_sitting overrides
   * @param {Array<object>} [options.seatedActors] - Actor definitions for seated occupants (id, name, spotIndex, furnitureId, closeTo)
   * @param {Array<object>} [options.standingActors] - Actor definitions for standing occupants (id, name, behindTargetId, closeTo, standingData)
   * @param {Array<object>} [options.kneelingActors] - Actor definitions for kneeling occupants (id, name, targetId, closeTo)
   * @param {boolean} [options.closeSeatedActors=true] - Whether seated actors default to being close to one another when sharing furniture
   * @returns {object} Scenario details with entities ready for fixture.reset
   */
  static createSittingArrangement(options = {}) {
    const {
      locationId = 'room1',
      includeRoom = true,
      roomId = locationId,
      roomName = 'Test Room',
      furnitureId = 'couch1',
      furnitureName = 'Comfy Couch',
      furnitureLocationId = locationId,
      furnitureAllowsSitting = {},
      additionalFurniture = [],
      seatedActors: providedSeatedActors,
      standingActors: providedStandingActors = [],
      kneelingActors: providedKneelingActors = [],
      closeSeatedActors = true,
    } = options;

    const normalizePartners = (partners) => {
      if (!partners) {
        return undefined;
      }

      if (Array.isArray(partners)) {
        return partners.filter((partner) => Boolean(partner));
      }

      return [partners];
    };

    const defaultSeatedActors = [
      { id: 'actor1', name: 'Alice', spotIndex: 0 },
      { id: 'actor2', name: 'Bob', spotIndex: 1 },
    ];

    const seatedActorsInput = Array.isArray(providedSeatedActors)
      ? [...providedSeatedActors]
      : defaultSeatedActors;

    if (seatedActorsInput.length === 0) {
      throw new Error(
        'ModEntityScenarios.createSittingArrangement: at least one seated actor is required'
      );
    }

    const normalizedFurniture = new Map();
    const ensureFurnitureDefinition = (definition) => {
      const { id, name, locationId: furnitureLocation, allowsSitting, components } = definition;
      if (!id) {
        throw new Error(
          'ModEntityScenarios.createSittingArrangement: furniture definitions must include an id'
        );
      }

      if (!normalizedFurniture.has(id)) {
        normalizedFurniture.set(id, {
          id,
          name: name || id,
          locationId: furnitureLocation || locationId,
          allowsSitting: allowsSitting || {},
          components: components || {},
        });
      }
    };

    ensureFurnitureDefinition({
      id: furnitureId,
      name: furnitureName,
      locationId: furnitureLocationId,
      allowsSitting: furnitureAllowsSitting,
    });

    const extraFurniture = Array.isArray(additionalFurniture)
      ? additionalFurniture
      : [];
    extraFurniture.forEach((furniture) => ensureFurnitureDefinition(furniture));

    const normalizedSeatedActors = seatedActorsInput.map((actor, index) => {
      const id = actor.id || `actor${index + 1}`;
      const actorName = actor.name || `Actor ${index + 1}`;
      const assignedFurnitureId = actor.furnitureId || furnitureId;

      ensureFurnitureDefinition({ id: assignedFurnitureId });

      return {
        id,
        name: actorName,
        furnitureId: assignedFurnitureId,
        spotIndex: actor.spotIndex,
        closeTo: normalizePartners(actor.closeTo),
        locationId: actor.locationId || locationId,
      };
    });

    const furnitureGroups = new Map();
    normalizedSeatedActors.forEach((actor) => {
      if (!furnitureGroups.has(actor.furnitureId)) {
        furnitureGroups.set(actor.furnitureId, []);
      }
      furnitureGroups.get(actor.furnitureId).push(actor);
    });

    furnitureGroups.forEach((actors) => {
      const usedIndices = new Set(
        actors
          .filter((actor) => typeof actor.spotIndex === 'number')
          .map((actor) => actor.spotIndex)
      );

      let nextIndex = 0;
      actors.forEach((actor) => {
        if (typeof actor.spotIndex !== 'number') {
          while (usedIndices.has(nextIndex)) {
            nextIndex += 1;
          }
          actor.spotIndex = nextIndex;
          usedIndices.add(nextIndex);
          nextIndex += 1;
        }
      });
    });

    const roomEntity = includeRoom
      ? new ModEntityBuilder(roomId).asRoom(roomName).build()
      : null;

    const furnitureEntities = [];
    normalizedFurniture.forEach((definition, id) => {
      const actorsOnFurniture = furnitureGroups.get(id) || [];
      const highestIndex = actorsOnFurniture.reduce(
        (maxIndex, actor) => Math.max(maxIndex, actor.spotIndex),
        -1
      );
      const spots = highestIndex >= 0 ? Array.from({ length: highestIndex + 1 }, () => null) : [];

      actorsOnFurniture.forEach((actor) => {
        spots[actor.spotIndex] = actor.id;
      });

      const builder = new ModEntityBuilder(id)
        .withName(definition.name)
        .atLocation(definition.locationId)
        .withLocationComponent(definition.locationId);

      if (definition.components && Object.keys(definition.components).length > 0) {
        builder.withComponents(definition.components);
      }

      builder.withComponent('positioning:allows_sitting', {
        spots,
        ...definition.allowsSitting,
      });

      furnitureEntities.push(builder.build());
    });

    const seatedActorEntities = normalizedSeatedActors.map((actor) => {
      const builder = new ModEntityBuilder(actor.id)
        .withName(actor.name)
        .atLocation(actor.locationId)
        .withLocationComponent(actor.locationId)
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: actor.furnitureId,
          spot_index: actor.spotIndex,
        });

      const partners = new Set();
      const actorGroup = furnitureGroups.get(actor.furnitureId) || [];
      if (closeSeatedActors) {
        actorGroup
          .filter((groupActor) => groupActor.id !== actor.id)
          .forEach((groupActor) => partners.add(groupActor.id));
      }

      if (actor.closeTo) {
        actor.closeTo.forEach((partner) => partners.add(partner));
      }

      if (partners.size > 0) {
        const partnerArray = [...partners];
        builder.closeToEntity(
          partnerArray.length === 1 ? partnerArray[0] : partnerArray
        );
      }

      return builder.build();
    });

    const normalizedStandingActors = Array.isArray(providedStandingActors)
      ? providedStandingActors.map((actor, index) => ({
          id: actor.id || `standing${index + 1}`,
          name: actor.name || `Standing Actor ${index + 1}`,
          locationId: actor.locationId || locationId,
          behindTargetId: actor.behindTargetId,
          closeTo: normalizePartners(actor.closeTo),
          standingData: actor.standingData || {},
          facingDirection: actor.facingDirection,
        }))
      : [];

    const standingActorEntities = normalizedStandingActors.map((actor) => {
      const builder = new ModEntityBuilder(actor.id)
        .withName(actor.name)
        .atLocation(actor.locationId)
        .withLocationComponent(actor.locationId)
        .asActor()
        .withComponent('positioning:standing', actor.standingData || {});

      if (actor.behindTargetId) {
        builder.withComponent('positioning:standing_behind', {
          entityId: actor.behindTargetId,
        });
      }

      if (actor.facingDirection) {
        builder.facing(actor.facingDirection);
      }

      if (actor.closeTo && actor.closeTo.length > 0) {
        builder.closeToEntity(
          actor.closeTo.length === 1 ? actor.closeTo[0] : actor.closeTo
        );
      }

      return builder.build();
    });

    const normalizedKneelingActors = Array.isArray(providedKneelingActors)
      ? providedKneelingActors.map((actor, index) => ({
          id: actor.id || `kneeling${index + 1}`,
          name: actor.name || `Kneeling Actor ${index + 1}`,
          locationId: actor.locationId || locationId,
          targetId: actor.targetId,
          closeTo: normalizePartners(actor.closeTo),
        }))
      : [];

    const kneelingActorEntities = normalizedKneelingActors.map((actor) => {
      if (!actor.targetId) {
        throw new Error(
          'ModEntityScenarios.createSittingArrangement: kneeling actors require a targetId'
        );
      }

      const builder = new ModEntityBuilder(actor.id)
        .withName(actor.name)
        .atLocation(actor.locationId)
        .withLocationComponent(actor.locationId)
        .asActor()
        .kneelingBefore(actor.targetId);

      if (actor.closeTo && actor.closeTo.length > 0) {
        builder.closeToEntity(
          actor.closeTo.length === 1 ? actor.closeTo[0] : actor.closeTo
        );
      }

      return builder.build();
    });

    const entities = [];
    if (roomEntity) {
      entities.push(roomEntity);
    }

    entities.push(...furnitureEntities, ...seatedActorEntities, ...standingActorEntities, ...kneelingActorEntities);

    return {
      room: roomEntity,
      furniture: furnitureEntities.length === 1 ? furnitureEntities[0] : furnitureEntities,
      furnitureEntities,
      seatedActors: seatedActorEntities,
      standingActors: standingActorEntities,
      kneelingActors: kneelingActorEntities,
      entities,
    };
  }

  /**
   * @description Creates a default two-person sitting scenario with shared furniture.
   *
   * @param {object} [options] - Scenario overrides passed to createSittingArrangement
   * @returns {object} Scenario details containing seated actors and furniture
   */
  static createSittingPair(options = {}) {
    const { seatedActors = [], closeSeatedActors, ...rest } = options;

    const finalSeatedActors = seatedActors.length > 0 ? seatedActors : [
      { id: 'actor1', name: 'Alice', spotIndex: 0 },
      { id: 'actor2', name: 'Bob', spotIndex: 1 },
    ];

    const finalCloseSetting =
      typeof closeSeatedActors === 'boolean' ? closeSeatedActors : true;

    return this.createSittingArrangement({
      seatedActors: finalSeatedActors,
      closeSeatedActors: finalCloseSetting,
      ...rest,
    });
  }

  /**
   * @description Creates a solo sitting scenario for a single actor and furniture.
   *
   * @param {object} [options] - Scenario overrides passed to createSittingArrangement
   * @returns {object} Scenario details for the solo sitter
   */
  static createSoloSitting(options = {}) {
    const { seatedActors = [], closeSeatedActors, ...rest } = options;

    const finalSeatedActors = seatedActors.length > 0 ? seatedActors : [
      { id: 'actor1', name: 'Alice', spotIndex: 0 },
    ];

    const finalCloseSetting =
      typeof closeSeatedActors === 'boolean' ? closeSeatedActors : false;

    return this.createSittingArrangement({
      seatedActors: finalSeatedActors,
      closeSeatedActors: finalCloseSetting,
      ...rest,
    });
  }

  /**
   * @description Creates a sitting scenario with at least one seated actor and nearby standing actors.
   *
   * @param {object} [options] - Scenario overrides passed to createSittingArrangement
   * @returns {object} Scenario details with seated and standing actors
   */
  static createStandingNearSitting(options = {}) {
    const {
      seatedActors = [],
      standingActors = [],
      closeSeatedActors,
      ...rest
    } = options;

    const finalSeatedActors = seatedActors.length > 0 ? seatedActors : [
      { id: 'actor1', name: 'Alice', spotIndex: 0 },
    ];

    const defaultStandingActors = standingActors.length > 0
      ? standingActors
      : [
          {
            id: 'standing1',
            name: 'Bob',
            closeTo: [finalSeatedActors[0].id],
          },
        ];

    const normalizedStandingActors = defaultStandingActors.map(
      (actor, index) => ({
        id: actor.id || `standing${index + 1}`,
        name: actor.name || `Standing Actor ${index + 1}`,
        closeTo:
          actor.closeTo && actor.closeTo.length > 0
            ? actor.closeTo
            : [finalSeatedActors[0].id],
        behindTargetId: actor.behindTargetId,
        locationId: actor.locationId,
        standingData: actor.standingData,
        facingDirection: actor.facingDirection,
      })
    );

    const finalCloseSetting =
      typeof closeSeatedActors === 'boolean'
        ? closeSeatedActors
        : finalSeatedActors.length > 1;

    return this.createSittingArrangement({
      seatedActors: finalSeatedActors,
      standingActors: normalizedStandingActors,
      closeSeatedActors: finalCloseSetting,
      ...rest,
    });
  }

  /**
   * @description Creates a scenario where actors occupy different furniture entities in the same room.
   *
   * @param {object} [options] - Scenario overrides passed to createSittingArrangement
   * @returns {object} Scenario details with separate furniture instances
   */
  static createSeparateFurnitureArrangement(options = {}) {
    const {
      seatedActors = [],
      additionalFurniture = [],
      closeSeatedActors,
      furnitureId = 'couch_left',
      furnitureName = 'Left Couch',
      ...rest
    } = options;

    const defaultSeatedActors = [
      { id: 'actor1', name: 'Alice', furnitureId: furnitureId, spotIndex: 0 },
      {
        id: 'actor2',
        name: 'Bob',
        furnitureId:
          (additionalFurniture[0] && additionalFurniture[0].id) || 'couch_right',
        spotIndex: 0,
      },
    ];

    const finalSeatedActors = seatedActors.length > 0 ? seatedActors : defaultSeatedActors;

    const defaultAdditionalFurniture =
      additionalFurniture.length > 0
        ? additionalFurniture
        : [
            {
              id: 'couch_right',
              name: 'Right Couch',
            },
          ];

    const finalCloseSetting =
      typeof closeSeatedActors === 'boolean' ? closeSeatedActors : false;

    return this.createSittingArrangement({
      furnitureId,
      furnitureName,
      additionalFurniture: defaultAdditionalFurniture,
      seatedActors: finalSeatedActors,
      closeSeatedActors: finalCloseSetting,
      ...rest,
    });
  }

  /**
   * @description Creates a scenario with a seated actor and kneeling actors positioned nearby.
   *
   * @param {object} [options] - Scenario overrides passed to createSittingArrangement
   * @returns {object} Scenario details with seated and kneeling actors
   */
  static createKneelingBeforeSitting(options = {}) {
    const {
      seatedActors = [],
      kneelingActors = [],
      closeSeatedActors,
      ...rest
    } = options;

    const finalSeatedActors = seatedActors.length > 0 ? seatedActors : [
      { id: 'actor1', name: 'Alice', spotIndex: 0 },
    ];

    const defaultKneelingActors = kneelingActors.length > 0
      ? kneelingActors
      : [
          {
            id: 'kneeling1',
            name: 'Charlie',
            targetId: finalSeatedActors[0].id,
            closeTo: [finalSeatedActors[0].id],
          },
        ];

    const normalizedKneelingActors = defaultKneelingActors.map(
      (actor, index) => ({
        id: actor.id || `kneeling${index + 1}`,
        name: actor.name || `Kneeling Actor ${index + 1}`,
        targetId: actor.targetId || finalSeatedActors[0].id,
        closeTo:
          actor.closeTo && actor.closeTo.length > 0
            ? actor.closeTo
            : [finalSeatedActors[0].id],
        locationId: actor.locationId,
      })
    );

    const finalCloseSetting =
      typeof closeSeatedActors === 'boolean'
        ? closeSeatedActors
        : finalSeatedActors.length > 1;

    return this.createSittingArrangement({
      seatedActors: finalSeatedActors,
      kneelingActors: normalizedKneelingActors,
      closeSeatedActors: finalCloseSetting,
      ...rest,
    });
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
