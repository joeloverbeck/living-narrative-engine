// src/services/connectionResolver.js

// Service responsible for resolving connection targets based on user input
// (e.g., directions like 'north' or connection names like 'door')

// ** Import Core Classes/Types **
import Entity from '../entities/entity.js';
import EntityManager from '../entities/entityManager.js';
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js';
import {CONNECTIONS_COMPONENT_TYPE_ID, PASSAGE_DETAILS_COMPONENT_TYPE_ID} from '../types/components.js';

// ** Added Type Imports for Dependencies **
/** @typedef {import('../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */


// ========================================================================
// == Core Type Definitions for Connection Resolution =====================
// ========================================================================

/**
 * Represents a fetched connection along with its originating direction.
 * @typedef {object} FetchedConnectionData
 * @property {string} direction
 * @property {Entity} connectionEntity
 */

/**
 * Represents the output of the connection matching logic.
 * @typedef {object} PotentialConnectionMatches
 * @property {FetchedConnectionData[]} directionMatches
 * @property {FetchedConnectionData[]} nameMatches
 */

// ========================================================================
// == Service Function Implementations ===================================
// ========================================================================

/**
 * **Internal:** Finds potential Connection entities based on direction and name matching.
 * @param {ActionContext} context - Needs `currentLocation`, `entityManager`.
 * @param {string} connectionTargetName - The user input.
 * @param {ILogger} logger - The logger instance. // Added logger to signature description
 * @returns {PotentialConnectionMatches}
 */
function findPotentialConnectionMatches(context, connectionTargetName, logger) {
  // Use a fallback just in case, but logger should always be provided by the caller
  const logWarn = logger?.warn || console.warn;
  const logError = logger?.error || console.error;

  const {currentLocation, entityManager} = context; // Assume context provides these

  /** @type {PotentialConnectionMatches} */
  const results = {
    directionMatches: [],
    nameMatches: [],
  };

  if (!currentLocation || !entityManager) {
    logError('findPotentialConnectionMatches (in ConnectionResolver): Missing currentLocation or entityManager in context.');
    return results;
  }

  // --- *** MODIFIED PART 1: Get Connections Data *** ---
  // Use getComponentData with the string type ID
  const connectionsComponentData = currentLocation.getComponentData(CONNECTIONS_COMPONENT_TYPE_ID);

  if (!connectionsComponentData) {
    // Log is slightly different now, as we are looking for data, not a component instance
    logWarn(`findPotentialConnectionMatches (in ConnectionResolver): Connections component data (typeId: ${CONNECTIONS_COMPONENT_TYPE_ID}) not found on location '${currentLocation.id}'`);
    return results;
  }

  // Access the connections map directly from the data object
  const connectionsMap = connectionsComponentData.connections; // Assumes data structure { typeId: '...', connections: { ... } }

  if (!connectionsMap || typeof connectionsMap !== 'object' || Object.keys(connectionsMap).length === 0) {
    // No connections defined, return empty results
    return results;
  }
  // --- *** END MODIFIED PART 1 *** ---


  // --- *** MODIFIED PART 2: Iterate and Fetch Entities *** ---
  /** @type {FetchedConnectionData[]} */
  const fetchedConnectionsData = [];
  // Iterate over the key-value pairs (direction, entityId) of the map
  for (const [direction, connectionEntityId] of Object.entries(connectionsMap)) {

    // Add a check for valid entity ID format if necessary
    if (typeof connectionEntityId !== 'string' || !connectionEntityId) {
      logWarn(`findPotentialConnectionMatches: Invalid connectionEntityId ('${connectionEntityId}') found for direction '${direction}' in location '${currentLocation.id}'. Skipping.`);
      continue;
    }

    const connectionEntity = entityManager.getEntityInstance(connectionEntityId);
    if (connectionEntity) {
      fetchedConnectionsData.push({direction, connectionEntity});
    } else {
      logWarn(`findPotentialConnectionMatches (in ConnectionResolver): Could not find Connection entity '${connectionEntityId}' referenced in location '${currentLocation.id}' for direction '${direction}'`);
    }
  }
  // --- *** END MODIFIED PART 2 *** ---

  // Check if any entities were actually fetched (handles cases where IDs exist but entities don't)
  if (fetchedConnectionsData.length === 0 && Object.keys(connectionsMap).length > 0) {
    logWarn(`findPotentialConnectionMatches (in ConnectionResolver): Location '${currentLocation.id}' has connection mappings, but failed to fetch any corresponding Connection entities.`);
    return results;
  }


  const lowerCaseTarget = connectionTargetName.trim().toLowerCase();
  const nameMatchEntityIds = new Set();

  for (const item of fetchedConnectionsData) {
    let isDirectionMatch = false;

    // Direction matching logic remains the same
    if (item.direction === lowerCaseTarget) {
      results.directionMatches.push(item);
      isDirectionMatch = true;
    }

    // --- *** MODIFIED PART 3: Get Blocker Data *** ---
    // Get potential blocker info using getComponentData
    const passageDetailsData = item.connectionEntity.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
    const blockerId = passageDetailsData?.blockerEntityId; // Access property from data object
    const blockerEnt = blockerId ? context.entityManager.getEntityInstance(blockerId) : null;
    // --- *** END MODIFIED PART 3 *** ---

    // Name matching logic - getDisplayName should ideally work with entities directly
    // Ensure getDisplayName uses getComponentData(NAME_COMPONENT_TYPE_ID) internally
    const entityName = getDisplayName(item.connectionEntity)?.toLowerCase();
    const blockerName = blockerEnt ? getDisplayName(blockerEnt)?.toLowerCase() : null;

    // Name matching condition remains the same logic
    if (!isDirectionMatch && ((entityName && entityName.includes(lowerCaseTarget)) || (blockerName && blockerName.includes(lowerCaseTarget)))) {
      if (!nameMatchEntityIds.has(item.connectionEntity.id)) {
        results.nameMatches.push(item);
        nameMatchEntityIds.add(item.connectionEntity.id);
      }
    }
  }

  return results;
} // End findPotentialConnectionMatches


/**
 * **CONN-5.1.3 Implementation:** Resolves a target Connection entity based on user input.
 * Handles ambiguity and dispatches messages using the validated dispatcher from context.
 * @param {ActionContext & { validatedDispatcher: ValidatedEventDispatcher, logger: ILogger }} context - The action context, **MUST** include `validatedDispatcher` and `logger`. Also needs `eventBus` (implicitly used by dispatcher), `currentLocation`, `entityManager`.
 * @param {string} connectionTargetName - The raw target string from the user.
 * @param {string} [actionVerb='go'] - The verb used in ambiguity messages.
 * // Update the type definition for findMatchesFn to include the logger
 * @param {(context: ActionContext, targetName: string, logger: ILogger) => PotentialConnectionMatches} [findMatchesFn=findPotentialConnectionMatches] - The function to use for finding matches.
 * @returns {Promise<Entity | null>} The resolved Connection entity or null if not found/ambiguous.
 */
export async function resolveTargetConnection(
  context,
  connectionTargetName,
  actionVerb = 'go',
  findMatchesFn = findPotentialConnectionMatches
) {
  // --- Get required dependencies from context ---
  const {validatedDispatcher, logger} = context; // Expect these to be passed in context

  // --- Step 1: Validate Inputs & Dependencies ---
  if (!context || !validatedDispatcher || typeof validatedDispatcher.dispatchValidated !== 'function' || !logger || typeof logger.warn !== 'function' || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
    // Use console.error as logger might be missing
    console.error('resolveTargetConnection (in ConnectionResolver): Invalid context or missing validatedDispatcher/logger functions provided.');
    return null;
  }
  const trimmedTargetName = typeof connectionTargetName === 'string' ? connectionTargetName.trim() : '';
  if (trimmedTargetName === '') {
    logger.warn('resolveTargetConnection (in ConnectionResolver): Invalid or empty connectionTargetName provided.');
    return null;
  }

  // --- Step 2: Find Potential Matches ---
  // Pass the logger to the findMatchesFn
  const {directionMatches, nameMatches} = findMatchesFn(context, trimmedTargetName, logger); // <-- Pass logger here
  logger.debug(`resolveTargetConnection: Matches for '${trimmedTargetName}': Directions=${directionMatches.length}, Names=${nameMatches.length}`);

  // ================================================================
  // --- Step 3: Resolve Priority and Ambiguity ---
  // ================================================================

  // Unique Direction Match
  if (directionMatches.length === 1) {
    const match = directionMatches[0];
    logger.info(`resolveTargetConnection: Found unique direction match: ${match.direction} -> ${match.connectionEntity.id}`);
    return match.connectionEntity;
  }

  // Ambiguous Direction Match
  if (directionMatches.length > 1) {
    logger.warn(`resolveTargetConnection: Ambiguous direction match for '${trimmedTargetName}'. Dispatching message.`);
    const displayNames = directionMatches.map(item => getDisplayName(item.connectionEntity) || item.direction || item.connectionEntity.id);
    let ambiguousMsg;
    if (TARGET_MESSAGES.AMBIGUOUS_DIRECTION) {
      ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(trimmedTargetName, displayNames);
    } else {
      ambiguousMsg = `There are multiple ways to go '${trimmedTargetName}'. Which one did you mean? (${displayNames.join(', ')})`;
    }

    // --- Refactored Dispatch Logic ---
    // Line: 142 (approx)
    await validatedDispatcher.dispatchValidated('event:display_message', {text: ambiguousMsg, type: 'warning'});
    // --- End Refactored Dispatch Logic ---
    return null;
  }

  // Unique Name Match
  if (nameMatches.length === 1) {
    const match = nameMatches[0];
    logger.info(`resolveTargetConnection: Found unique name match: ${getDisplayName(match.connectionEntity)} (${match.connectionEntity.id}) via direction ${match.direction}`);
    return match.connectionEntity;
  }

  // Ambiguous Name Match
  if (nameMatches.length > 1) {
    logger.warn(`resolveTargetConnection: Ambiguous name match for '${trimmedTargetName}'. Dispatching message.`);
    const displayNames = nameMatches.map(item => getDisplayName(item.connectionEntity) || item.direction || item.connectionEntity.id);
    let ambiguousMsg;
    if (TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT) {
      const ambiguousEntities = nameMatches.map(match => match.connectionEntity);
      ambiguousMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, trimmedTargetName, ambiguousEntities);
    } else {
      ambiguousMsg = `Which '${trimmedTargetName}' did you want to ${actionVerb}? (${displayNames.join(', ')})`;
    }

    // --- Refactored Dispatch Logic ---
    // Line: 165 (approx)
    await validatedDispatcher.dispatchValidated('event:display_message', {text: ambiguousMsg, type: 'warning'});
    // --- End Refactored Dispatch Logic ---
    return null;
  }

  // Not Found
  logger.info(`resolveTargetConnection: No direction or name matches found for '${trimmedTargetName}'. Dispatching message.`);
  const notFoundMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(trimmedTargetName);

  // --- Refactored Dispatch Logic ---
  // Line: 172 (approx)
  await validatedDispatcher.dispatchValidated('event:display_message', {text: notFoundMsg, type: 'info'});
  // --- End Refactored Dispatch Logic ---
  return null;
}