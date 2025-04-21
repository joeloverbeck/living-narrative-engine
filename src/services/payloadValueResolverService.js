// src/services/payloadValueResolverService.js

// --- Imports for JSDoc Type Definitions ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/component.js').default} Component */ // Keep for context, though not directly used
/** @typedef {import('../managers/entityManager.js').default} EntityManager */ // Keep for context
/** @typedef {import('../managers/componentRegistry.js').ComponentRegistry} ComponentRegistry */ // Referenced in logic

// --- Necessary Imports for Logic ---
import {getDisplayName} from '../utils/messages.js'; // Required by the migrated logic

/**
 * @Class PayloadValueResolverService
 * Responsible for resolving values for event payloads based on source strings
 * defined in action definitions. This service centralizes the complex logic
 * previously found in ActionExecutor.#getValueFromSource, improving separation
 * of concerns and testability.
 *
 * Refactored (REFACTOR-AE-04) to use private helper methods for each source prefix.
 */
class PayloadValueResolverService {
    /**
     * @private
     * @type {ILogger | undefined}
     */
    #logger;

    /**
     * Creates an instance of PayloadValueResolverService.
     * @param {object} dependencies - The required services.
     * @param {ILogger} [dependencies.logger] - Optional logger instance.
     */
    constructor({logger}) {
        this.#logger = logger;
        // No other dependencies injected directly at this stage.
        this.#logger?.info("PayloadValueResolverService initialized.");
    }

    // ======================================================================= //
    // == START: Public Value Resolution Method                            == //
    // ======================================================================= //

    /**
     * Resolves a value based on a source string mapping convention defined in
     * actionDefinition.dispatch_event.payload.
     * Delegates the core resolution logic to private helper methods based on the prefix.
     * Handles graceful failures by returning null or undefined and logging errors.
     *
     * @param {string} sourceString - The mapping string (e.g., 'actor.id', 'target.component.Health.current', 'literal.boolean.true').
     * @param {ActionContext} context - The action execution context (must contain playerEntity, entityManager, parsedCommand, currentLocation).
     * @param {TargetResolutionResult} resolutionResult - The result from target resolution (contains targetType, targetEntity, targetConnectionEntity, details).
     * @param {ActionDefinition} actionDefinition - The definition of the current action (for context in logging).
     * @returns {any | null | undefined} The resolved value, or null/undefined if resolution fails gracefully or source is invalid.
     * @public
     */
    resolveValue(sourceString, context, resolutionResult, actionDefinition) {
        // --- Initial Validation ---
        if (typeof sourceString !== 'string' || !sourceString) {
            this.#logger?.error(`PayloadValueResolverService (resolveValue): Invalid or empty sourceString provided for action '${actionDefinition.id}'.`, {sourceString});
            return undefined;
        }

        const parts = sourceString.split('.');
        const sourcePrefix = parts[0];
        // Pass the remaining parts (excluding the prefix) to the helper methods
        const remainingParts = parts.slice(1);

        try {
            // --- Delegate to Helper Methods based on Prefix ---
            switch (sourcePrefix) {
                case 'actor':
                    return this.#resolveActorSource(remainingParts, context, actionDefinition, sourceString);
                case 'target':
                    return this.#resolveTargetSource(remainingParts, context, resolutionResult, actionDefinition, sourceString);
                case 'resolved':
                    return this.#resolveResolvedSource(remainingParts, context, resolutionResult, actionDefinition, sourceString);
                case 'context':
                    return this.#resolveContextSource(remainingParts, context, actionDefinition, sourceString);
                case 'parsed':
                    return this.#resolveParsedSource(remainingParts, context, actionDefinition, sourceString);
                case 'literal':
                    // Literal only needs remaining parts and definition (for logging), plus original string for logging
                    return this.#resolveLiteralSource(remainingParts, actionDefinition, sourceString);

                // --- Unknown Prefix ---
                default: // <<< --- THIS IS THE CASE TO CHANGE --- >>>
                    // Corrected log message location for unknown prefix
                    // PROBLEM: It's using .warn() but the test expects .error()
                    this.#logger?.error(`PayloadValueResolverService (resolveValue): Unknown source prefix '${sourcePrefix}' in source string '${sourceString}' for action '${actionDefinition.id}'.`);
                    return undefined; // This part is correct (returns undefined)
            }
        } catch (error) {
            // Catch unexpected errors during resolution within helpers or the switch itself
            this.#logger?.error(`PayloadValueResolverService (resolveValue): Unexpected error resolving source string '${sourceString}' for action '${actionDefinition.id}':`, error);
            return undefined; // Return undefined on unexpected errors
        }
    }

    // ======================================================================= //
    // == END: Public Value Resolution Method                              == //
    // ======================================================================= //


    // ======================================================================= //
    // == START: Private Helper Methods for Source Prefixes                == //
    // ======================================================================= //

    /**
     * Resolves values sourced from the 'actor' (player entity).
     * Handles 'actor.id', 'actor.name', 'actor.component.<ComponentTypeId>.<property>'.
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'actor.'.
     * @param {ActionContext} context - The action context.
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {any | undefined} The resolved value or undefined on failure.
     */
    #resolveActorSource(parts, context, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveActorSource):`;
        if (parts.length < 1) { // Need at least one part after 'actor.'
            this.#logger?.warn(`${logPrefix} Malformed 'actor' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires at least 'actor.<field>'.`);
            return undefined;
        }
        const actorEntity = context?.playerEntity;
        if (!actorEntity) {
            this.#logger?.error(`${logPrefix} Cannot resolve 'actor.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Actor entity not found in context.`);
            return undefined;
        }

        const field = parts[0];

        if (field === 'id') {
            return actorEntity.id;
        } else if (field === 'name') {
            return getDisplayName(actorEntity);
        } else if (field === 'component' && parts.length >= 3) { // actor.component.TypeId.property
            const componentTypeId = parts[1];
            const propertyName = parts[2];

            // --- *** ADDED: Check Component Registry First *** ---
            const registry = context?.entityManager?.componentRegistry;
            if (!registry) {
                this.#logger?.error(`${logPrefix} Component registry not found in context. Cannot verify component type '${componentTypeId}' for source '${originalSourceString}' (action: ${actionDefinition.id}).`);
                return undefined; // Cannot proceed without registry
            }
            const componentClass = registry.get(componentTypeId); // <-- This is the call the test expects
            if (!componentClass) {
                // Log the warning expected by Test 2
                this.#logger?.warn(`${logPrefix} Could not find component class '${componentTypeId}' in registry for source '${originalSourceString}' (action: ${actionDefinition.id}).`);
                return undefined; // Class definition missing, cannot resolve property.
            }
            // --- *** END ADDED *** ---

            // --- Existing logic (now only runs if class exists in registry) ---
            const componentData = actorEntity.getComponentData(componentTypeId);

            if (!componentData) {
                // Class exists, but this actor doesn't have instance data for it
                this.#logger?.warn(`${logPrefix} Component data for ID '${componentTypeId}' not found on actor entity ${actorEntity.id} for source '${originalSourceString}' (action: ${actionDefinition.id}). Returning undefined.`);
                return undefined;
            }
            if (!(propertyName in componentData)) {
                // Class exists, instance data exists, but property missing (handles Test 1 scenario)
                this.#logger?.warn(`${logPrefix} Property '${propertyName}' not found in component data for ID '${componentTypeId}' for source '${originalSourceString}' on actor ${actorEntity.id} (action: ${actionDefinition.id}).`);
                return undefined;
            }
            // Everything exists
            return componentData[propertyName];

        } else if (field === 'component' && parts.length < 3) { // Handle malformed component string early
            this.#logger?.warn(`${logPrefix} Invalid 'actor.component.*' source string format '${originalSourceString}'. Expected 'actor.component.<ComponentName>.<propertyName>'. Action: '${actionDefinition.id}'`);
            return undefined;
        } else { // Handle other unknown actor fields
            this.#logger?.warn(`${logPrefix} Unhandled 'actor' source string format '${originalSourceString}' for action '${actionDefinition.id}'. Field: '${field}'.`);
            return undefined;
        }
    }

    /**
     * Resolves values sourced from the 'target' entity (if resolved).
     * Handles 'target.id', 'target.name', 'target.component.<ComponentTypeId>.<property>'.
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'target.'.
     * @param {ActionContext} context - The action context (unused here but kept for signature consistency).
     * @param {TargetResolutionResult} resolutionResult - The target resolution result.
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {any | undefined} The resolved value or undefined on failure.
     */
    #resolveTargetSource(parts, context, resolutionResult, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveTargetSource):`;
        if (parts.length < 1) { // Need at least one part after 'target.'
            this.#logger?.warn(`${logPrefix} Malformed 'target' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires at least 'target.<field>'.`);
            return undefined;
        }
        // Target sources only valid if resolution resulted in a specific entity
        if (resolutionResult?.targetType !== 'entity') {
            this.#logger?.warn(`${logPrefix} Cannot resolve 'target.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Target type is '${resolutionResult?.targetType}', not 'entity'.`);
            return undefined;
        }
        const targetEntity = resolutionResult?.targetEntity;
        if (!targetEntity) {
            // Should ideally not happen if type is 'entity', but safety check
            this.#logger?.warn(`${logPrefix} Cannot resolve 'target.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Target entity not found in resolutionResult despite type 'entity'.`);
            return undefined;
        }

        const field = parts[0];

        if (field === 'id') {
            return targetEntity.id;
        } else if (field === 'name') {
            return getDisplayName(targetEntity);
        } else if (field === 'component' && parts.length >= 3) { // target.component.TypeId.property
            const componentTypeId = parts[1];
            const propertyName = parts[2];

            // --- *** ADDED: Check Component Registry First (Consistency) *** ---
            const registry = context?.entityManager?.componentRegistry; // Assumes context is available here, may need adjustment if not passed
            if (!registry) {
                this.#logger?.error(`${logPrefix} Component registry not found in context. Cannot verify component type '${componentTypeId}' for source '${originalSourceString}' (action: ${actionDefinition.id}).`);
                return undefined; // Cannot proceed without registry
            }
            const componentClass = registry.get(componentTypeId); // <-- Check registry for target too
            if (!componentClass) {
                this.#logger?.warn(`${logPrefix} Could not find component class '${componentTypeId}' in registry for source '${originalSourceString}' (action: ${actionDefinition.id}).`);
                return undefined; // Class definition missing, cannot resolve property.
            }
            // --- *** END ADDED *** ---

            // --- Existing logic ---
            const componentData = targetEntity.getComponentData(componentTypeId);

            if (!componentData) {
                // Class exists, but this target doesn't have instance data for it
                this.#logger?.warn(`${logPrefix} Component data for ID '${componentTypeId}' not found on target entity ${targetEntity.id} for source '${originalSourceString}' (action: ${actionDefinition.id}). Returning undefined.`);
                return undefined;
            }
            if (!(propertyName in componentData)) {
                // Class exists, instance data exists, but property missing
                this.#logger?.warn(`${logPrefix} Property '${propertyName}' not found in component data for ID '${componentTypeId}' for source '${originalSourceString}' on target ${targetEntity.id} (action: ${actionDefinition.id}).`);
                return undefined;
            }
            // Everything exists
            return componentData[propertyName];

        } else if (field === 'component' && parts.length < 3) { // Handle malformed component string early
            this.#logger?.warn(`${logPrefix} Invalid 'target.component.*' source string format '${originalSourceString}'. Expected 'target.component.<ComponentName>.<propertyName>'. Action: '${actionDefinition.id}'`);
            return undefined;
        } else { // Handle other unknown target fields
            this.#logger?.warn(`${logPrefix} Unhandled 'target' source string format '${originalSourceString}' for action '${actionDefinition.id}'. Field: '${field}'.`);
            return undefined;
        }
    }

    /**
     * Resolves values sourced from the 'resolved' details of target resolution (e.g., direction, connection info).
     * Handles 'resolved.direction', 'resolved.connection.id', 'resolved.connection.targetLocationId', 'resolved.connection.blockerEntityId'.
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'resolved.'.
     * @param {ActionContext} context - The action context (for parsed command).
     * @param {TargetResolutionResult} resolutionResult - The target resolution result.
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {any | undefined} The resolved value or undefined on failure.
     */
    #resolveResolvedSource(parts, context, resolutionResult, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveResolvedSource):`;
        if (parts.length < 1) { // Need at least one part after 'resolved.'
            this.#logger?.warn(`${logPrefix} Malformed 'resolved' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires at least 'resolved.<field>'.`);
            return undefined;
        }
        const field = parts[0];

        // Typically used for 'direction' targets
        if (field === 'direction') {
            if (resolutionResult?.targetType !== 'direction') {
                this.#logger?.warn(`${logPrefix} Cannot resolve 'resolved.direction' source '${originalSourceString}' for action '${actionDefinition.id}'. Target type is '${resolutionResult?.targetType}', not 'direction'.`);
                return undefined;
            }
            // Use the parsed direct object phrase as the resolved direction string
            // Check if parsedCommand exists before accessing its properties
            return context?.parsedCommand?.directObjectPhrase ?? undefined;
        } else if (field === 'connection' && parts.length >= 2) { // resolved.connection.<field>
            if (resolutionResult?.targetType !== 'direction') {
                this.#logger?.warn(`${logPrefix} Cannot resolve 'resolved.connection.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Target type is '${resolutionResult?.targetType}', not 'direction'.`);
                return undefined;
            }
            const connectionField = parts[1];
            if (connectionField === 'id') {
                // Prefer the actual connection entity ID if available, fallback to targetId (might be connection ID)
                return resolutionResult.targetConnectionEntity?.id ?? resolutionResult.targetId ?? undefined;
            } else if (connectionField === 'targetLocationId') {
                // Assumes details object holds this info
                return resolutionResult.details?.targetLocationId ?? undefined;
            } else if (connectionField === 'blockerEntityId') {
                // Assumes details object holds this info, can be null/undefined.
                // Return the value directly, even if null or undefined.
                return resolutionResult.details?.blockerEntityId;
            } else {
                this.#logger?.warn(`${logPrefix} Unhandled 'resolved.connection' field '${connectionField}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
                return undefined;
            }
        } else {
            this.#logger?.warn(`${logPrefix} Unhandled 'resolved' source string format '${originalSourceString}' for action '${actionDefinition.id}'. Field: '${field}'`);
            return undefined;
        }
    }

    /**
     * Resolves values sourced from the 'context' object.
     * Handles 'context.currentLocation.id', 'context.currentLocation.name'.
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'context.'.
     * @param {ActionContext} context - The action context.
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {any | undefined} The resolved value or undefined on failure.
     */
    #resolveContextSource(parts, context, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveContextSource):`;
        if (parts.length < 1) { // Need at least one part after 'context.'
            this.#logger?.warn(`${logPrefix} Malformed 'context' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires at least 'context.<field>'.`);
            return undefined;
        }
        const field = parts[0];

        if (field === 'currentLocation' && parts.length >= 2) { // context.currentLocation.<field>
            const locationField = parts[1];
            const locationEntity = context?.currentLocation;
            if (!locationEntity) {
                this.#logger?.warn(`${logPrefix} Cannot resolve 'context.currentLocation.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Current location not found in context.`);
                return undefined;
            }
            if (locationField === 'id') {
                return locationEntity.id;
            } else if (locationField === 'name') {
                return getDisplayName(locationEntity);
            } else {
                this.#logger?.warn(`${logPrefix} Unhandled 'context.currentLocation' field '${locationField}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
                return undefined;
            }
        }
        // Add other context fields here if needed (e.g., context.gameTime)
        else {
            this.#logger?.warn(`${logPrefix} Unhandled 'context' field '${field}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
            return undefined;
        }
    }

    /**
     * Resolves values sourced from the 'parsed' command object.
     * Handles 'parsed.directObjectPhrase', 'parsed.indirectObjectPhrase'.
     * Returns undefined if the source property is null or undefined. // <-- Updated doc comment
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'parsed.'.
     * @param {ActionContext} context - The action context.
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {string | undefined} The resolved phrase string, or undefined on failure or if null/undefined. // <-- Updated return type
     */
    #resolveParsedSource(parts, context, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveParsedSource):`;
        if (parts.length < 1) { // Need at least one part after 'parsed.'
            this.#logger?.warn(`${logPrefix} Malformed 'parsed' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires at least 'parsed.<field>'.`);
            return undefined;
        }
        // Check if parsedCommand exists before accessing it
        const parsedCommand = context?.parsedCommand;
        if (!parsedCommand) {
            this.#logger?.warn(`${logPrefix} Cannot resolve 'parsed.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Parsed command not found in context.`);
            return undefined;
        }

        const field = parts[0];
        if (field === 'directObjectPhrase') {
            // --- CORRECTED LINE ---
            // Use ?? to return undefined if the phrase is null or undefined
            return parsedCommand.directObjectPhrase ?? undefined;
        } else if (field === 'indirectObjectPhrase') {
            // --- CORRECTED LINE ---
            // Use ?? to return undefined if the phrase is null or undefined
            return parsedCommand.indirectObjectPhrase ?? undefined;
        }
        // Add other parsed fields if needed (e.g., originalInput, preposition)
        else {
            this.#logger?.warn(`${logPrefix} Unhandled 'parsed' field '${field}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
            return undefined;
        }
    }

    /**
     * Resolves literal values defined directly in the source string.
     * Handles 'literal.string.<value>', 'literal.number.<value>', 'literal.boolean.<true|false>', 'literal.null'.
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'literal.'. Should be [<type>, <value>, ...].
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {any | undefined} The resolved literal value or undefined on failure/invalid format.
     */
    #resolveLiteralSource(parts, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveLiteralSource):`;

        // Check if we have at least the <type> part
        if (parts.length < 1) {
            this.#logger?.warn(`${logPrefix} Malformed 'literal' source string '${originalSourceString}'. Requires at least 'literal.<type>'.`);
            return undefined;
        }

        const type = parts[0].toLowerCase();

        // Special handling for 'null' type
        if (type === 'null') {
            if (parts.length > 1) {
                const valueString = parts.slice(1).join('.');
                if (valueString.toLowerCase() !== 'null') { // Check if extra parts are also 'null'
                    this.#logger?.warn(`${logPrefix} Literal 'null' type used with unexpected value part ('${valueString}') in source '${originalSourceString}'. Resolving to null anyway.`);
                }
            }
            return null; // Handles "literal.null" or "literal.null.null" etc.
        }

        // Other types require a value part
        if (parts.length < 2) {
            this.#logger?.warn(`${logPrefix} Malformed 'literal' source string '${originalSourceString}'. Type '${type}' requires a value part ('literal.<type>.<value>').`);
            return undefined;
        }

        // Process types with value parts
        const valueString = parts.slice(1).join('.'); // Rejoin remaining parts as value
        switch (type) {
            case 'string':
                // Return the raw string value, preserving case and content
                return valueString;
            case 'number':
                const num = parseFloat(valueString);
                if (isNaN(num)) {
                    this.#logger?.error(`${logPrefix} Failed to parse number from literal source '${originalSourceString}'. Value: '${valueString}'.`);
                    return undefined;
                }
                return num;
            case 'boolean':
                const boolStr = valueString.toLowerCase();
                if (boolStr === 'true') return true;
                if (boolStr === 'false') return false;
                this.#logger?.error(`${logPrefix} Invalid boolean value in literal source '${originalSourceString}'. Value: '${valueString}'. Expected 'true' or 'false'.`);
                return undefined;
            // case 'null': // Already handled above
            default:
                this.#logger?.error(`${logPrefix} Unknown literal type '${type}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
                return undefined;
        }
    }

    // ======================================================================= //
    // == END: Private Helper Methods for Source Prefixes                  == //
    // ======================================================================= //
}

export default PayloadValueResolverService;