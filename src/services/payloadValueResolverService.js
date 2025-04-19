// src/services/payloadValueResolverService.js

// --- Imports for JSDoc Type Definitions ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/component.js').default} Component */ // Assuming Component base class path
/** @typedef {import('../managers/entityManager.js').default} EntityManager */ // Assuming EntityManager path
/** @typedef {import('../managers/componentRegistry.js').ComponentRegistry} ComponentRegistry */ // Assuming ComponentRegistry path

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
                default:
                    this.#logger?.error(`PayloadValueResolverService (resolveValue): Unknown source prefix '${sourcePrefix}' in source string '${sourceString}' for action '${actionDefinition.id}'.`);
                    return undefined;
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
     * Handles 'actor.id', 'actor.name', 'actor.component.<ComponentName>.<property>'.
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
        } else if (field === 'component' && parts.length >= 3) { // actor.component.Name.property
            const componentName = parts[1];
            const propertyName = parts[2];
            const ComponentClass = context.entityManager?.componentRegistry?.get(componentName);
            if (!ComponentClass) {
                this.#logger?.warn(`${logPrefix} Could not find component class '${componentName}' in registry for source '${originalSourceString}' (action: ${actionDefinition.id}).`);
                return undefined; // Component definition not found
            }
            const componentInstance = actorEntity.getComponent(ComponentClass);
            if (!componentInstance) {
                // Graceful failure: Component not present on this specific actor instance
                this.#logger?.debug(`${logPrefix} Component '${componentName}' not found on actor entity ${actorEntity.id} for source '${originalSourceString}' (action: ${actionDefinition.id}). Returning undefined.`);
                return undefined;
            }
            if (!(propertyName in componentInstance)) {
                this.#logger?.warn(`${logPrefix} Property '${propertyName}' not found on component '${componentName}' for source '${originalSourceString}' on actor ${actorEntity.id} (action: ${actionDefinition.id}).`);
                return undefined; // Property doesn't exist on the component instance
            }
            return componentInstance[propertyName];
        } else {
            this.#logger?.warn(`${logPrefix} Unhandled 'actor' source string format '${originalSourceString}' for action '${actionDefinition.id}'.`);
            return undefined;
        }
    }

    /**
     * Resolves values sourced from the 'target' entity (if resolved).
     * Handles 'target.id', 'target.name', 'target.component.<ComponentName>.<property>'.
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'target.'.
     * @param {ActionContext} context - The action context (for component registry).
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
        } else if (field === 'component' && parts.length >= 3) { // target.component.Name.property
            const componentName = parts[1];
            const propertyName = parts[2];
            const ComponentClass = context.entityManager?.componentRegistry?.get(componentName);
            if (!ComponentClass) {
                this.#logger?.warn(`${logPrefix} Could not find component class '${componentName}' in registry for source '${originalSourceString}' (action: ${actionDefinition.id}).`);
                return undefined;
            }
            const componentInstance = targetEntity.getComponent(ComponentClass);
            if (!componentInstance) {
                this.#logger?.debug(`${logPrefix} Component '${componentName}' not found on target entity ${targetEntity.id} for source '${originalSourceString}' (action: ${actionDefinition.id}). Returning undefined.`);
                return undefined; // Graceful: Component not on target
            }
            if (!(propertyName in componentInstance)) {
                this.#logger?.warn(`${logPrefix} Property '${propertyName}' not found on component '${componentName}' for source '${originalSourceString}' on target ${targetEntity.id} (action: ${actionDefinition.id}).`);
                return undefined;
            }
            return componentInstance[propertyName];
        } else {
            this.#logger?.warn(`${logPrefix} Unhandled 'target' source string format '${originalSourceString}' for action '${actionDefinition.id}'.`);
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
            return context.parsedCommand?.directObjectPhrase ?? undefined;
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
                return resolutionResult.details?.blockerEntityId; // Optional chaining `?.` handles details being null/undefined.
            } else {
                this.#logger?.warn(`${logPrefix} Unhandled 'resolved.connection' field '${connectionField}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
                return undefined;
            }
        } else {
            this.#logger?.warn(`${logPrefix} Unhandled 'resolved' source string format '${originalSourceString}' for action '${actionDefinition.id}'.`);
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
     * @private
     * @param {string[]} parts - The parts of the source string *after* 'parsed.'.
     * @param {ActionContext} context - The action context.
     * @param {ActionDefinition} actionDefinition - The current action definition (for logging).
     * @param {string} originalSourceString - The full original source string (for logging).
     * @returns {any | undefined} The resolved value or undefined on failure.
     */
    #resolveParsedSource(parts, context, actionDefinition, originalSourceString) {
        const logPrefix = `PayloadValueResolverService (#resolveParsedSource):`;
        if (parts.length < 1) { // Need at least one part after 'parsed.'
            this.#logger?.warn(`${logPrefix} Malformed 'parsed' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires at least 'parsed.<field>'.`);
            return undefined;
        }
        if (!context?.parsedCommand) {
            this.#logger?.warn(`${logPrefix} Cannot resolve 'parsed.*' source '${originalSourceString}' for action '${actionDefinition.id}'. Parsed command not found in context.`);
            return undefined;
        }

        const field = parts[0];
        if (field === 'directObjectPhrase') {
            return context.parsedCommand.directObjectPhrase ?? undefined;
        } else if (field === 'indirectObjectPhrase') {
            return context.parsedCommand.indirectObjectPhrase ?? undefined;
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
        // Need at least <type>.<value>, so parts length must be >= 2
        if (parts.length < 2) {
            this.#logger?.warn(`${logPrefix} Malformed 'literal' source string '${originalSourceString}' for action '${actionDefinition.id}'. Requires 'literal.<type>.<value>'.`);
            return undefined;
        }
        const type = parts[0].toLowerCase();
        // Join remaining parts for the value (handles dots in numbers/strings)
        const valueString = parts.slice(1).join('.');

        switch (type) {
            case 'string':
                return valueString; // Keep as is
            case 'number':
                const num = parseFloat(valueString);
                if (isNaN(num)) {
                    this.#logger?.error(`${logPrefix} Failed to parse number from literal source '${originalSourceString}' for action '${actionDefinition.id}'. Value: '${valueString}'.`);
                    return undefined; // Parsing failed
                }
                return num;
            case 'boolean':
                const boolStr = valueString.toLowerCase();
                if (boolStr === 'true') return true;
                if (boolStr === 'false') return false;
                this.#logger?.error(`${logPrefix} Invalid boolean value in literal source '${originalSourceString}' for action '${actionDefinition.id}'. Value: '${valueString}'. Expected 'true' or 'false'.`);
                return undefined; // Invalid boolean value
            case 'null':
                // Check if the value string is also 'null' for consistency, though type 'null' is sufficient.
                if (valueString.toLowerCase() !== 'null') {
                    this.#logger?.warn(`${logPrefix} Literal 'null' type used, but value part was not 'null' (value: '${valueString}') in source '${originalSourceString}' for action '${actionDefinition.id}'. Returning null anyway.`);
                }
                return null; // Explicit null literal
            default:
                this.#logger?.error(`${logPrefix} Unknown literal type '${type}' in source '${originalSourceString}' for action '${actionDefinition.id}'.`);
                return undefined; // Unknown literal type
        }
    }

    // ======================================================================= //
    // == END: Private Helper Methods for Source Prefixes                  == //
    // ======================================================================= //
}

export default PayloadValueResolverService;