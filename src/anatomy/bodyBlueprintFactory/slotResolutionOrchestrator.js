// src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js

/**
 * @file Slot resolution orchestration logic
 * Handles processing of blueprint slots to create anatomy structure
 * Extracted from bodyBlueprintFactory.js #processBlueprintSlots method
 */

import { ValidationError } from '../../errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/systemEventIds.js';

/** @typedef {import('../anatomyGraphContext.js').AnatomyGraphContext} AnatomyGraphContext */
/** @typedef {import('../entityGraphBuilder.js').EntityGraphBuilder} EntityGraphBuilder */
/** @typedef {import('../partSelectionService.js').PartSelectionService} PartSelectionService */
/** @typedef {import('../socketManager.js').SocketManager} SocketManager */
/** @typedef {import('../recipeProcessor.js').RecipeProcessor} RecipeProcessor */
/** @typedef {import('../../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} AnatomyBlueprint
 * @property {string} [id]
 * @property {object} slots
 */

/**
 * @typedef {object} Recipe
 * @property {string} [recipeId]
 * @property {object} [slots]
 */

/**
 * @typedef {object} SlotProcessingDependencies
 * @property {EntityGraphBuilder} entityGraphBuilder - Entity graph builder
 * @property {PartSelectionService} partSelectionService - Part selection service
 * @property {SocketManager} socketManager - Socket manager
 * @property {RecipeProcessor} recipeProcessor - Recipe processor
 * @property {EventDispatchService} eventDispatchService - Event dispatch service
 * @property {ILogger} logger - Logger instance
 */

/**
 * Processes blueprint slots to create the anatomy structure
 * Extracted from bodyBlueprintFactory.js #processBlueprintSlots method
 *
 * @param {AnatomyBlueprint} blueprint - The blueprint with slots
 * @param {Recipe} recipe - The processed recipe
 * @param {AnatomyGraphContext} context - The graph building context
 * @param {string} ownerId - Owner entity ID
 * @param {SlotProcessingDependencies} dependencies - Required services
 * @returns {Promise<void>} Processes slots and updates context
 */
export async function processBlueprintSlots(blueprint, recipe, context, ownerId, dependencies) {
  const { entityGraphBuilder, partSelectionService, socketManager, recipeProcessor, eventDispatchService, logger } = dependencies;

  console.log('[DEBUG] #processBlueprintSlots CALLED');
  console.log('[DEBUG]   blueprint.slots exists?', !!blueprint.slots);
  console.log('[DEBUG]   blueprint.slots keys:', blueprint.slots ? Object.keys(blueprint.slots) : 'N/A');

  // Debug logging for recipe slots
  logger.debug(
    `SlotResolutionOrchestrator: Recipe has ${recipe.slots ? Object.keys(recipe.slots).length : 0} slots`,
    recipe.slots ? Object.keys(recipe.slots) : []
  );

  // Sort slots by dependency order
  const sortedSlots = sortSlotsByDependency(blueprint.slots);
  console.log('[DEBUG] #processBlueprintSlots - after sort:');
  console.log('[DEBUG]   sortedSlots type:', sortedSlots.constructor.name);
  console.log('[DEBUG]   sortedSlots.length or size:', sortedSlots.length || sortedSlots.size);
  console.log('[DEBUG]   sortedSlots keys:', Array.from(sortedSlots.keys()));

  logger.debug(
    `SlotResolutionOrchestrator: Processing ${sortedSlots.length} blueprint slots`,
    Array.from(sortedSlots.keys())
  );

  for (const [slotKey, slot] of sortedSlots) {
    try {
      // Log slot processing start for diagnostics
      logger.info(
        `SlotResolutionOrchestrator: Processing slot '${slotKey}'`,
        { slotId: slot.id, parent: slot.parent, socket: slot.socket }
      );

      // Determine parent entity
      let parentEntityId;
      if (slot.parent === null || slot.parent === undefined) {
        // If no parent specified, attach to root
        parentEntityId = context.getRootId();
      } else {
        // Otherwise, find the entity for the parent slot
        parentEntityId = context.getEntityForSlot(slot.parent);
        if (!parentEntityId) {
          throw new ValidationError(
            `Parent slot '${slot.parent}' not found for slot '${slotKey}'`
          );
        }
      }

      // Validate socket availability
      const socketValidation = socketManager.validateSocketAvailability(
        parentEntityId,
        slot.socket,
        context.getSocketOccupancy(),
        !slot.optional
      );

      if (!socketValidation.valid) {
        if (socketValidation.error) {
          throw new ValidationError(socketValidation.error);
        }
        // Skip optional slots if socket not available
        logger.info(
          `SlotResolutionOrchestrator: SKIPPING slot '${slotKey}' - socket validation failed`,
          { socketValidation }
        );
        continue;
      }

      const socket = socketValidation.socket;

      // Check if this is an equipment slot (not an anatomy part slot)
      // Equipment slots typically have requirements like strength, dexterity, etc.
      // and use sockets like 'grip' which should not create anatomy parts
      if (isEquipmentSlot(slot, socket)) {
        logger.debug(
          `SlotResolutionOrchestrator: Skipping equipment slot '${slotKey}' (socket: ${socket.id})`
        );
        continue;
      }

      // Merge requirements and select part
      const mergedRequirements = recipeProcessor.mergeSlotRequirements(
        slot.requirements,
        recipe.slots?.[slotKey]
      );

      const partDefinitionId = await partSelectionService.selectPart(
        mergedRequirements,
        socket.allowedTypes,
        recipe.slots?.[slotKey],
        context.getRNG()
      );

      if (!partDefinitionId && slot.optional) {
        logger.info(
          `SlotResolutionOrchestrator: SKIPPING optional slot '${slotKey}' - no part selected`
        );
        continue; // Skip optional slots if no part found
      }

      // Log successful part selection
      logger.info(
        `SlotResolutionOrchestrator: Selected part '${partDefinitionId}' for slot '${slotKey}'`
      );

      if (!partDefinitionId) {
        throw new ValidationError(
          `No part found for required slot '${slotKey}' with requirements: ${JSON.stringify(mergedRequirements)}`
        );
      }

      // Use socket orientation if available, otherwise extract from slot key
      // For slots like "left_hand", "right_foot", extract "left" or "right"
      let orientation = socket.orientation;
      if (!orientation && slotKey) {
        // Check if slot key starts with a known orientation prefix
        const orientationPrefixes = [
          'left',
          'right',
          'upper',
          'lower',
          'front',
          'back',
        ];
        for (const prefix of orientationPrefixes) {
          if (slotKey.startsWith(prefix + '_')) {
            orientation = prefix;
            break;
          }
        }
      }

      // Debug logging for orientation issues
      logger.debug(
        `SlotResolutionOrchestrator: Creating part for slot '${slotKey}' - socket.orientation: ${socket.orientation}, extracted orientation: ${orientation}, socket.nameTpl: ${socket.nameTpl}`
      );

      // Create and attach the part
      // Get slot properties from recipe patterns (descriptor components, etc.)
      console.log(`[DEBUG] Processing slot: ${slotKey}`);
      console.log('[DEBUG]   recipe.slots?.[slotKey]:', JSON.stringify(recipe.slots?.[slotKey], null, 2));
      const componentOverrides = recipe.slots?.[slotKey]?.properties || {};
      console.log('[DEBUG]   componentOverrides:', JSON.stringify(componentOverrides, null, 2));
      console.log('[DEBUG]   componentOverrides keys:', Object.keys(componentOverrides));

      logger.debug(
        `SlotResolutionOrchestrator: Checking for properties in recipe.slots['${slotKey}']`,
        {
          hasSlots: !!recipe.slots,
          slotKeys: recipe.slots ? Object.keys(recipe.slots) : [],
          hasSlotKey: !!recipe.slots?.[slotKey],
          slotData: recipe.slots?.[slotKey]
        }
      );
      if (Object.keys(componentOverrides).length > 0) {
        logger.debug(
          `SlotResolutionOrchestrator: Will apply ${Object.keys(componentOverrides).length} component overrides from recipe slot '${slotKey}' during entity creation`,
          componentOverrides
        );
      } else {
        logger.debug(
          `SlotResolutionOrchestrator: No component overrides found for slot '${slotKey}'`
        );
      }

      const childId = await entityGraphBuilder.createAndAttachPart(
        parentEntityId,
        socket.id,
        partDefinitionId,
        ownerId,
        orientation,
        componentOverrides
      );

      if (childId) {
        logger.info(
          `SlotResolutionOrchestrator: Created entity '${childId}' for slot '${slotKey}'`
        );
        context.addCreatedEntity(childId);
        context.mapSlotToEntity(slotKey, childId);

        // Update part count
        const partType = entityGraphBuilder.getPartType(childId);
        context.incrementPartCount(partType);

        // Mark socket as occupied
        socketManager.occupySocket(
          parentEntityId,
          socket.id,
          context.getSocketOccupancy()
        );

        // Generate and set name if template provided
        const name = socketManager.generatePartName(
          socket,
          childId,
          parentEntityId
        );
        logger.debug(
          `SlotResolutionOrchestrator: Generated name '${name}' for child '${childId}' using socket '${socket.id}' with template '${socket.nameTpl}'`
        );
        if (name) {
          await entityGraphBuilder.setEntityName(childId, name);
        }
      }
    } catch (error) {
      const errorContext = {
        slotKey,
        slot,
        blueprintId: blueprint.id,
        recipeId: recipe.recipeId,
      };

      const errorMessage = `Failed to process blueprint slot '${slotKey}': ${error.message}`;

      await eventDispatchService.safeDispatchEvent(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: errorMessage,
          details: {
            raw: JSON.stringify({
              ...errorContext,
              context: 'SlotResolutionOrchestrator.processBlueprintSlots',
            }),
          },
        }
      );

      throw new ValidationError(errorMessage);
    }
  }
}

/**
 * Sorts slots by dependency order (parents before children)
 * Extracted from bodyBlueprintFactory.js #sortSlotsByDependency
 *
 * @param {object} slots - Slots object from blueprint
 * @returns {Array<[string, object]>} Sorted array of [key, slot] pairs
 * @throws {ValidationError} If circular dependency detected
 */
export function sortSlotsByDependency(slots) {
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  const visit = (key, slot) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new ValidationError(
        `Circular dependency detected in blueprint slots involving '${key}'`
      );
    }

    visiting.add(key);

    // Visit parent first if it exists
    if (slot.parent && slots[slot.parent]) {
      visit(slot.parent, slots[slot.parent]);
    }

    visiting.delete(key);
    visited.add(key);
    sorted.push([key, slot]);
  };

  // Process all slots
  for (const [key, slot] of Object.entries(slots)) {
    visit(key, slot);
  }

  return sorted;
}

/**
 * Determines if a slot is an equipment slot (vs anatomy part slot)
 * Extracted from bodyBlueprintFactory.js #isEquipmentSlot
 * Equipment slots should not create anatomy parts
 *
 * @param {object} slot - Slot definition
 * @param {object} socket - Socket definition
 * @returns {boolean} True if equipment slot
 */
export function isEquipmentSlot(slot, socket) {
  // Equipment slots typically use sockets like 'grip' for weapons/tools
  const equipmentSocketTypes = ['grip', 'weapon', 'tool', 'accessory'];

  if (equipmentSocketTypes.includes(socket.id)) {
    return true;
  }

  // Equipment slots typically have requirements like strength, dexterity, etc.
  // that are not typical anatomy part requirements
  const equipmentRequirements = [
    'strength',
    'dexterity',
    'intelligence',
    'level',
  ];

  if (slot.requirements) {
    const hasEquipmentRequirements = equipmentRequirements.some((req) =>
      Object.prototype.hasOwnProperty.call(slot.requirements, req)
    );

    if (hasEquipmentRequirements) {
      return true;
    }
  }

  return false;
}

export default {
  processBlueprintSlots,
  sortSlotsByDependency,
  isEquipmentSlot,
};
