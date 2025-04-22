// src/systems/actionDiscoverySystem.js

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../services/actionValidationService.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../services/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */
/** @typedef {import('../services/actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').TargetDomain} TargetDomain */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */ // Assuming ConsoleLogger implementation
/** @typedef {import('../services/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */ // <<< Ensure this type import exists

// --- Dependency Imports ---
// Assuming these exist and provide the necessary classes/functions
import {ActionTargetContext} from "../models/actionTargetContext.js";
import {formatActionCommand} from '../services/actionFormatter.js';


/**
 * System responsible for discovering all valid actions an actor can take
 * based on the current game state and loaded action definitions.
 */
export class ActionDiscoverySystem {
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {ActionValidationService} */
    #actionValidationService;
    /** @private @type {getEntityIdsForScopesFn} */ // Store the function itself
    #getEntityIdsForScopesFn;
    /** @private @type {formatActionCommandFn} */ // Store the function itself
    #formatActionCommandFn;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ActionDiscoverySystem.
     * @param {object} dependencies - The required dependencies injected by the container.
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {EntityManager} dependencies.entityManager
     * @param {ActionValidationService} dependencies.actionValidationService
     * @param {ILogger} dependencies.logger
     * @param {formatActionCommandFn} dependencies.formatActionCommandFn
     * @param {getEntityIdsForScopesFn} dependencies.getEntityIdsForScopesFn // <<< ADDED DEPENDENCY
     */
    constructor({
                    gameDataRepository,
                    entityManager,
                    actionValidationService,
                    logger,
                    formatActionCommandFn,
                    getEntityIdsForScopesFn // <<< ADDED PARAMETER
                }) {
        // --- Existing validation checks ---
        if (!gameDataRepository || !entityManager || !actionValidationService || !logger || !formatActionCommandFn) {
            throw new Error("ActionDiscoverySystem requires GameDataRepository, EntityManager, ActionValidationService, ILogger, and formatActionCommandFn instances.");
        }
        // --- ADD VALIDATION for the new dependency ---
        if (!getEntityIdsForScopesFn || typeof getEntityIdsForScopesFn !== 'function') {
            throw new Error("ActionDiscoverySystem requires a valid getEntityIdsForScopesFn function.");
        }
        // --- End validation checks ---

        this.#gameDataRepository = gameDataRepository;
        this.#entityManager = entityManager;
        this.#actionValidationService = actionValidationService;
        this.#logger = logger;
        this.#formatActionCommandFn = formatActionCommandFn; // Use injected formatter

        // --- USE THE INJECTED SCOPE FUNCTION ---
        this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn; // <<< CORRECT ASSIGNMENT

        this.#logger.info("ActionDiscoverySystem initialized.");
    }

    /**
     * Discovers all valid, formatted command strings available to the actor.
     * @param {Entity} actorEntity - The entity for whom to discover actions.
     * @param {ActionContext} context - The broader ActionContext including currentLocation etc.
     * @returns {Promise<string[]>} A promise resolving to a flat array of valid command strings.
     */
    async getValidActions(actorEntity, context) {
        // --- ADD THIS LINE ---
        this.#logger.debug(`--- MARKER 2: GETVALIDACTIONS ENTRY for ${actorEntity.id} ---`);
        this.#logger.debug(`Starting action discovery for actor: ${actorEntity.id}`);
        const allActionDefinitions = this.#gameDataRepository.getAllActionDefinitions();
        // Assumes validCommandStrings is initialized (per Ticket 4.3.4)
        console.log('>>> DEBUG ADS: Processing Action Definition IDs:', JSON.stringify(allActionDefinitions.map(a => a.id))); // <-- Add this
        const validCommandStrings = new Set(); // Use a Set to automatically handle duplicates

        // --- 1. Iterate through all Action Definitions ---
        for (const actionDef of allActionDefinitions) {
            this.#logger.debug(` -> Processing action definition: ${actionDef.id}`);

            // --- [TICKET 4.2 START] Initial Actor Validation Check ---
            // Use ActionTargetContext.noTarget() for the initial actor check.
            const initialActorContext = ActionTargetContext.noTarget();
            if (!this.#actionValidationService.isValid(actionDef, actorEntity, initialActorContext)) {
                this.#logger.debug(`    - Action ${actionDef.id} skipped: Invalid for actor based on initial check.`);
                continue; // Skip to the next action definition if actor requirements fail
            }
            // --- [TICKET 4.2 END] ---


            const domain = actionDef.target_domain;
            this.#logger.debug(` -> Passed initial actor check for ${actionDef.id}. Proceeding with target domain: ${domain}`);

            // --- 2. Handle based on Target Domain ---
            try {
                // --- [TICKET 4.3.1 START] Domain: 'none' or 'self' ---
                if (domain === 'none' || domain === 'self') {
                    // AC: Code Location Verified: Inside main loop, after initial actor validation.

                    // AC: Context Creation ('self') Verified
                    // AC: Context Creation ('none') Verified
                    const targetContext = (domain === 'self')
                        ? ActionTargetContext.forEntity(actorEntity.id) // Target is the actor itself
                        : ActionTargetContext.noTarget(); // Explicitly no target

                    // AC: Final Validation Call Verified
                    if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                        // AC: Formatting Call (on Validation Success) Verified
                        const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager, {debug: false /* optional based on logger */});
                        // AC: Result Addition (on Formatting Success) Verified
                        if (command !== null) {
                            validCommandStrings.add(command);
                            this.#logger.debug(`    * Found valid action (no target/self): ${command}`);
                        } else {
                            // AC: Logging (Formatting Failure) Verified
                            this.#logger.warn(`    * Action ${actionDef.id} validated but formatter returned null.`);
                        }
                    } else {
                        // AC: Logging (Validation Failure) Verified (Log message adjusted)
                        this.#logger.debug(`    - Action ${actionDef.id} failed the final context-specific validation for '${domain}' domain.`);
                    }
                    // AC: No Iteration Verified: No loops within this block.
                }
                    // --- [TICKET 4.3.1 END] ---

                    // --- 2b. Domain: 'direction' ---
                // --- 2b. Domain: 'direction' ---
                else if (domain === 'direction') {
                    // --- CORRECTED LOGIC ---
                    // Get the raw data using EntityManager and the component type ID string
                    const connectionsData = this.#entityManager.getComponentData(context.currentLocation.id, 'Connections'); // Use 'Connections' ID

                    this.#logger.debug(`Checking connections data for location: ${context.currentLocation?.id}`, connectionsData);

                    let potentialDirections = [];
                    // Check if data exists and has the expected structure
                    if (connectionsData && connectionsData.connections && typeof connectionsData.connections === 'object') {
                        // Get the direction names (keys) from the nested 'connections' object
                        potentialDirections = Object.keys(connectionsData.connections);
                        this.#logger.debug(`Extracted potentialDirections: ${potentialDirections.join(', ')}`);
                    } else {
                        this.#logger.debug(`Connections data not found or invalid structure on currentLocation ${context.currentLocation?.id}.`);
                    }
                    // --- END CORRECTION ---


                    if (potentialDirections.length === 0) {
                        this.#logger.debug(`    - No potential direction targets found for action ${actionDef.id}.`);
                        // Note: In the original code, there was no 'continue' here,
                        // the loop below would simply not execute. Keep it that way.
                        // continue;
                    } else {
                        this.#logger.debug(`    - Found ${potentialDirections.length} potential direction targets. Checking validation...`);
                    }


                    for (const direction of potentialDirections) { // Should now loop with 'north'
                        this.#logger.debug(`    -> Processing direction: ${direction}`);
                        const targetContext = ActionTargetContext.forDirection(direction);
                        // Validate with the specific direction context
                        if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) { // Should call the mock which returns true for 'north'
                            this.#logger.debug(`      - isValid TRUE for ${direction}. Calling formatter.`);
                            // ---> ADD THIS LINE <---
                            console.log('>>> DEBUG ADS: targetContext JUST BEFORE formatter call:', JSON.stringify(targetContext));
                            const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager);

                            if (command !== null) {
                                validCommandStrings.add(command);
                                this.#logger.debug(`    * Found valid action (direction: ${direction}): ${command}`);
                            } else {
                                this.#logger.warn(`    * Action ${actionDef.id} validated for direction ${direction} but formatter returned null.`);
                            }
                        } else {
                            // This branch should NOT be taken for 'north' due to the mock returning true
                            this.#logger.debug(`      - isValid FALSE for ${direction}.`);
                        }
                    }
                } // End domain === 'direction'
                // --- 2c. Domain: Entity Scopes (inventory, environment, etc.) ---
                else {
                    // Actor check already passed, now find and validate potential entity targets
                    const potentialTargetIds = this.#getEntityIdsForScopesFn([domain], context);
                    if (potentialTargetIds.size === 0) {
                        this.#logger.debug(`    - No potential targets found in domain '${domain}' for action ${actionDef.id}.`);
                        continue; // Skip to the next action definition
                    }

                    this.#logger.debug(`    - Found ${potentialTargetIds.size} potential targets in domain '${domain}'. Checking validation...`);

                    for (const targetId of potentialTargetIds) {
                        // Note: getEntityIdsForScopes should ideally return IDs for which instances exist,
                        // but we double-check here just in case.
                        const targetEntity = this.#entityManager.getEntityInstance(targetId);
                        if (!targetEntity) {
                            this.#logger.warn(`    - Could not get entity instance for potential target ID ${targetId} from domain ${domain}. Skipping validation.`);
                            continue;
                        }

                        const targetContext = ActionTargetContext.forEntity(targetId);
                        // Validate with the specific entity target context
                        if (this.#actionValidationService.isValid(actionDef, actorEntity, targetContext)) {
                            const command = this.#formatActionCommandFn(actionDef, targetContext, this.#entityManager);
                            if (command !== null) {
                                validCommandStrings.add(command);
                                this.#logger.debug(`    * Found valid action (target ${targetId}): ${command}`);
                            } else {
                                this.#logger.warn(`    * Action ${actionDef.id} validated for target ${targetId} but formatter returned null.`);
                            }
                        } else {
                            this.#logger.debug(`    - Action ${actionDef.id} invalid for target: ${targetId}.`);
                        }
                    }
                }
            } catch (error) {
                this.#logger.error(`Error processing action definition ${actionDef.id} for actor ${actorEntity.id}:`, error);
                // Continue to the next action definition despite the error
            }
        } // End loop through action definitions

        const finalCommands = Array.from(validCommandStrings);
        this.#logger.debug(`Finished action discovery for actor ${actorEntity.id}. Found ${finalCommands.length} valid commands.`);
        return finalCommands;
    }
}

// Ensure ActionDiscoverySystem is exported if needed by other modules or the container setup
// export default ActionDiscoverySystem; // Or named export: export { ActionDiscoverySystem };