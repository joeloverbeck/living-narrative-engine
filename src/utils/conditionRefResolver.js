/**
 * @module conditionRefResolver
 */

/**
 * @description Recursively resolves objects containing `condition_ref` properties using a
 * repository lookup while detecting circular references.
 * @param {object|any} logic - Logic block potentially containing condition_ref references.
 * @param {{getConditionDefinition: function(string): {logic: object}|null}} repo - Repository
 *  providing condition definitions via `getConditionDefinition`.
 * @param {{debug: function(string): void}} logger - Logger for debug output. Other log methods are ignored.
 * @param {Set<string>} [visited] - Tracks visited condition IDs to detect cycles.
 * @returns {object|any} The logic object with all `condition_ref` entries replaced by their referenced logic.
 * @throws {Error} If a circular reference is detected or a referenced condition cannot be resolved.
 */
export function resolveConditionRefs(logic, repo, logger, visited = new Set()) {
  if (!logic || typeof logic !== 'object' || logic === null) {
    return logic;
  }

  if (Array.isArray(logic)) {
    return logic.map((item) =>
      resolveConditionRefs(item, repo, logger, new Set(visited))
    );
  }

  if (Object.prototype.hasOwnProperty.call(logic, 'condition_ref')) {
    const conditionId = logic.condition_ref;
    if (typeof conditionId !== 'string') {
      throw new Error('Invalid condition_ref value: not a string.');
    }

    if (visited.has(conditionId)) {
      throw new Error(
        `Circular condition_ref detected. Path: ${[...visited, conditionId].join(' -> ')}`
      );
    }
    visited.add(conditionId);

    if (logger && typeof logger.debug === 'function') {
      logger.debug(`Resolving condition_ref '${conditionId}'...`);
    }

    const conditionDef = repo.getConditionDefinition(conditionId);

    if (!conditionDef || !conditionDef.logic) {
      throw new Error(
        `Could not resolve condition_ref '${conditionId}'. Definition or its logic property not found.`
      );
    }

    const resolved = resolveConditionRefs(
      conditionDef.logic,
      repo,
      logger,
      visited
    );
    visited.delete(conditionId);
    return resolved;
  }

  const resolvedObj = {};
  for (const [key, val] of Object.entries(logic)) {
    resolvedObj[key] = resolveConditionRefs(
      val,
      repo,
      logger,
      new Set(visited)
    );
  }
  return resolvedObj;
}
