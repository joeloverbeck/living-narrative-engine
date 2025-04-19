// src/services/filterValidTargetsForAction.js

import {ConnectionsComponent} from "../components/connectionsComponent.js";
import {ActionTargetContext} from "./actionValidationService.js";
import {getEntityIdsForScopes} from "./entityScopeService.js";

/**
 * Filters potential targets for a given action based on validation rules.
 *
 * @param {ActionDefinition} actionDefinition - The definition of the action being considered.
 * @param {Entity} actorEntity - The entity performing the action.
 * @param {ActionContext} context - The context containing dependencies like entityManager, actionValidationService, etc.
 * @param {ActionValidationService} actionValidationService - The service instance used for validation.
 * @param {EntityManager} entityManager - The entity manager instance.
 * @returns {Promise<Array<string | EntityId>>} A promise resolving to an array of valid target identifiers (entity IDs or direction strings).
 */
export async function filterValidTargetsForAction(actionDefinition, actorEntity, context, actionValidationService, entityManager) {
    const {target_domain} = actionDefinition;
    const validTargets = [];

    // --- 1. Handle Non-Entity Domains ---
    if (target_domain === 'none' || target_domain === 'self') {
        // For 'none' or 'self', validation is typically handled entirely within ActionValidationService
        // based on actor state and prerequisites. We assume if we got this far,
        // the action *might* be valid, but there's no specific target list to filter.
        // The ActionDiscoverySystem would likely call isValid once for the appropriate context.
        // Let's assume isValid is called elsewhere for these domains. No targets to return here.
        // OR, if isValid needs to be checked here specifically for non-target actions:
        // const targetContext = (target_domain === 'self')
        //     ? ActionTargetContext.forEntity(actorEntity.id) // 'self' implicitly targets the actor
        //     : ActionTargetContext.noTarget(); // 'none' has no target
        // if (actionValidationService.isValid(actionDefinition, actorEntity, targetContext)) {
        //     // For 'none' or 'self', if valid, the action itself is valid, but there's no *target* identifier to return.
        //     // The calling system needs to handle this (e.g., add the action without a target).
        // }
        return []; // No specific targets to list for 'none' or 'self' domain actions

    } else if (target_domain === 'direction') {
        // Retrieve potential directions (e.g., from room exits)
        // This logic depends on how directions are represented (e.g., room component)
        const potentialDirections = context.currentLocation?.getComponent(ConnectionsComponent)?.getAllDirections() ?? []; // Example retrieval

        for (const direction of potentialDirections) {
            const targetContext = ActionTargetContext.forDirection(direction);
            // Validate the direction itself using isValid (checks prerequisites like blocked paths)
            if (actionValidationService.isValid(actionDefinition, actorEntity, targetContext)) {
                validTargets.push(direction); // Add the valid direction string
            }
        }
        return validTargets;
    }

    // --- 2. Handle Entity Domains ---
    // Retrieve candidate entity IDs based on the domain (e.g., 'inventory', 'environment')
    const candidateEntityIds = getEntityIdsForScopes([target_domain], context); // Use the existing service

    if (!candidateEntityIds || candidateEntityIds.size === 0) {
        return []; // No potential targets found in the scope
    }

    // --- 3. Filter Entity Candidates using ActionValidationService ---
    // Use Promise.all for potential async operations, though isValid might be sync
    const validationPromises = Array.from(candidateEntityIds).map(async (targetId) => {
        const targetEntity = entityManager.getEntityInstance(targetId);
        if (!targetEntity) {
            // Could not resolve instance, invalid target
            return null;
        }

        const targetContext = ActionTargetContext.forEntity(targetId);
        try {
            // Call the validation service
            const isValid = actionValidationService.isValid(actionDefinition, actorEntity, targetContext);
            return isValid ? targetId : null;
        } catch (error) {
            // Log error during validation for this specific target
            console.error(`Error validating target ${targetId} for action ${actionDefinition.id}:`, error);
            return null; // Treat validation errors as invalid
        }
    });

    const validationResults = await Promise.all(validationPromises);

    // Filter out null results (invalid targets)
    const finalValidTargets = validationResults.filter(targetId => targetId !== null);

    return finalValidTargets; // Return the list of valid entity IDs
}

// --- Example Usage within ActionDiscoverySystem ---

/*
async function discoverActionsForActor(actorEntity, context) {
    const { entityManager, actionValidationService, gameDataRepository } = context; // Assume these are in context
    const allActionDefinitions = gameDataRepository.getAllActionDefinitions(); // Get all possible actions
    const discoveredActions = [];

    for (const actionDef of allActionDefinitions) {
        // Initial check: Does the actor meet basic requirements?
        const actorContext = ActionTargetContext.noTarget(); // Use noTarget/self context for actor checks if needed
        // Note: isValid performs actor checks internally first.
        // We might call isValid here with a placeholder target context if needed *before* target filtering,
        // but the filter loop below calls isValid anyway.

        // Find and filter valid targets for this action definition
        const validTargetIds = await filterValidTargetsForAction(
            actionDef,
            actorEntity,
            context,
            actionValidationService, // Pass the service instance
            entityManager        // Pass the manager instance
        );

        // If the action requires no target ('none', 'self'), and passed validation elsewhere (or if filter handles it)
        if ((actionDef.target_domain === 'none' || actionDef.target_domain === 'self')) {
             // Re-validate here if filterValidTargetsForAction doesn't handle it
             const simpleContext = (actionDef.target_domain === 'self')
                 ? ActionTargetContext.forEntity(actorEntity.id)
                 : ActionTargetContext.noTarget();
             if (actionValidationService.isValid(actionDef, actorEntity, simpleContext)) {
                 discoveredActions.push({ actionId: actionDef.id, target: null, command: actionDef.template }); // Add action without specific target ID
             }
        }
        // If the action requires targets and we found valid ones
        else if (validTargetIds.length > 0) {
            for (const targetIdOrDirection of validTargetIds) {
                 // Format the command string using the template
                 let command = actionDef.template;
                 if (actionDef.target_domain === 'direction') {
                     command = command.replace('{direction}', targetIdOrDirection); // targetIdOrDirection is a string like 'north'
                 } else {
                     // Assume targetIdOrDirection is an entity ID
                     const targetEntity = entityManager.getEntityInstance(targetIdOrDirection);
                     const targetName = targetEntity?.getComponent(NameComponent)?.value || targetIdOrDirection; // Get target name or use ID
                     command = command.replace('{target}', targetName);
                 }

                discoveredActions.push({
                    actionId: actionDef.id,
                    target: targetIdOrDirection, // Store the valid entity ID or direction string
                    command: command
                });
            }
        }
    }
    return discoveredActions; // List of objects representing valid actions and their targets
}
*/