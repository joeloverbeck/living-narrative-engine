/**
 *
 * @param input
 * @param options
 */
export function buildPlanningState(input, options = {}) {
  if (input && typeof input === 'object' && input.id && input.components) {
    return buildStateFromActor(input);
  }
  return buildStateFromFragments(input || {}, options);
}

/**
 *
 * @param actor
 */
export function buildDualFormatState(actor) {
  return buildPlanningState(actor);
}

/**
 *
 * @param componentId
 */
export function flattenComponentId(componentId) {
  return componentId.replace(/:/g, '_');
}

/**
 *
 * @param componentId
 * @param field
 */
export function buildComponentFieldPath(componentId, field) {
  const flattenedId = flattenComponentId(componentId);
  return `state.actor.components.${flattenedId}.${field}`;
}

/**
 *
 * @param actor
 */
function buildStateFromActor(actor) {
  const state = {
    actor: {
      id: actor.id,
      components: {},
    },
  };

  Object.keys(actor.components || {}).forEach((componentId) => {
    const componentValue = cloneValue(actor.components[componentId]);
    const flatKey = `${actor.id}:${componentId}`;
    state[flatKey] = componentValue;
    state.actor.components[componentId] = componentValue;
    state.actor.components[flattenComponentId(componentId)] = componentValue;
  });

  return state;
}

/**
 *
 * @param fragments
 * @param options
 */
function buildStateFromFragments(fragments, options = {}) {
  const state = {};
  const sourceEntries = Object.entries(fragments);
  for (const [key, value] of sourceEntries) {
    state[key] = cloneValue(value);
  }

  const actorId = options.actorId || inferActorIdFromFragments(sourceEntries);
  if (!actorId) {
    return state;
  }

  const actorComponents = {};
  for (const [key, value] of sourceEntries) {
    if (typeof key !== 'string' || !key.includes(':')) {
      continue;
    }
    const [entityId, ...componentParts] = key.split(':');
    const normalizedEntityId = normalizeEntityId(entityId, actorId);
    if (normalizedEntityId !== actorId) {
      continue;
    }
    const componentId = componentParts.join(':');
    const componentValue = cloneValue(value);
    actorComponents[componentId] = componentValue;
    actorComponents[flattenComponentId(componentId)] = componentValue;
  }

  state.actor = {
    id: actorId,
    components: actorComponents,
  };

  return state;
}

/**
 *
 * @param entries
 */
function inferActorIdFromFragments(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }
  for (const [key] of entries) {
    if (typeof key === 'string' && key.includes(':')) {
      return key.split(':')[0];
    }
  }
  return null;
}

/**
 *
 * @param entityId
 * @param actorId
 */
function normalizeEntityId(entityId, actorId) {
  if (entityId === 'actor') {
    return actorId;
  }
  return entityId;
}

/**
 *
 * @param value
 */
function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}
