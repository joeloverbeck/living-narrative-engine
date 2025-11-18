import jsonLogic from 'json-logic-js';
import {
  recordPlanningStateMiss,
  recordPlanningStateLookup,
} from './planningStateDiagnostics.js';
import {
  PLANNING_STATE_COMPONENT_REASONS,
  PLANNING_STATE_COMPONENT_SOURCES,
  PLANNING_STATE_COMPONENT_STATUSES,
} from './planningStateTypes.js';

const viewCache = new WeakMap();

/**
 *
 * @param options
 */
function toMetadata(options = {}) {
  if (!options) {
    return {};
  }
  if (options.metadata && typeof options.metadata === 'object') {
    return { ...options.metadata };
  }
  return { ...options };
}

/**
 * Factory that memoizes PlanningStateView instances per state snapshot.
 * Subsequent calls update metadata/loggers before returning the cached view.
 *
 * @param {object} state
 * @param {object} [options]
 * @returns {PlanningStateView}
 */
export function createPlanningStateView(state, options = {}) {
  const baseState = state && typeof state === 'object' ? state : {};
  let view = viewCache.get(baseState);
  if (view) {
    view.updateMetadata(options);
    return view;
  }
  view = new PlanningStateView(baseState, options);
  viewCache.set(baseState, view);
  return view;
}

export class PlanningStateView {
  #state;
  #logger;
  #metadata;
  #actorId;
  #actorSnapshot;
  #evaluationContext;
  #entityIndex;

  constructor(state, options = {}) {
    this.#state = state && typeof state === 'object' ? state : {};
    this.#logger = options.logger || null;
    this.#metadata = toMetadata(options);
    this.#actorId = this.#metadata.actorId || this.#inferActorId();
    this.#actorSnapshot = this.#buildActorSnapshot();
    this.#entityIndex = this.#buildEntityIndex();
    this.#evaluationContext = this.#buildEvaluationContext();
  }

  updateMetadata(options = {}) {
    if (options.logger) {
      this.#logger = options.logger;
    }
    const next = toMetadata(options);
    if (Object.keys(next).length > 0) {
      this.#metadata = { ...this.#metadata, ...next };
      if (next.actorId) {
        this.#actorId = next.actorId;
      }
    }
  }

  getEvaluationContext() {
    return this.#evaluationContext;
  }

  getState() {
    return this.#state;
  }

  getActorId() {
    return this.#actorId || null;
  }

  getActorSnapshot() {
    if (!this.#actorSnapshot) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(this.#actorSnapshot));
    } catch (_) {
      return { ...this.#actorSnapshot };
    }
  }

  hasComponent(entityId, componentId, options = {}) {
    const normalizedEntityId =
      entityId === undefined || entityId === null ? null : String(entityId);
    const normalizedComponentId =
      typeof componentId === 'string'
        ? componentId.trim()
        : componentId === undefined || componentId === null
          ? null
          : String(componentId);
    const metadata =
      options.metadata && typeof options.metadata === 'object'
        ? { ...options.metadata }
        : {};

    recordPlanningStateLookup({
      actorId: metadata.actorId || this.getActorId(),
      entityId: normalizedEntityId,
      componentId: normalizedComponentId,
      origin:
        metadata.origin ||
        this.#metadata.origin ||
        'PlanningStateView.hasComponent',
    });

    if (!normalizedEntityId || !normalizedComponentId) {
      const reason = PLANNING_STATE_COMPONENT_REASONS.INVALID_LOOKUP;
      this.#recordMiss('component', {
        entityId: normalizedEntityId,
        componentId: normalizedComponentId,
        reason,
        ...metadata,
        metadata,
      });
      return this.#buildUnknownResult(reason);
    }

    const entry = this.#entityIndex.get(normalizedEntityId);
    if (!entry) {
      const reason = PLANNING_STATE_COMPONENT_REASONS.ENTITY_MISSING;
      this.#recordMiss('component', {
        entityId: normalizedEntityId,
        componentId: normalizedComponentId,
        reason,
        ...metadata,
        metadata,
      });
      return this.#buildUnknownResult(reason);
    }

    if (entry.values.has(normalizedComponentId)) {
      const payload = entry.values.get(normalizedComponentId);
      const normalizedValue = this.#normalizeComponentValue(payload?.value);
      return this.#buildPresentResult(payload?.source || null, normalizedValue);
    }

    const reason = PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING;
    this.#recordMiss('component', {
      entityId: normalizedEntityId,
      componentId: normalizedComponentId,
      reason,
      ...metadata,
      metadata,
    });
    return this.#buildAbsentResult(entry);
  }

  assertPath(path, metadata = {}) {
    const metadataClone =
      metadata && typeof metadata === 'object' ? { ...metadata } : {};
    if (!path || typeof path !== 'string') {
      return undefined;
    }

    try {
      const value = jsonLogic.apply({ var: path }, this.#evaluationContext);
      if (value === undefined || value === null) {
        this.#recordMiss('path', {
          path,
          reason: 'unresolved-path',
          ...metadataClone,
          metadata: metadataClone,
        });
        return undefined;
      }
      return value;
    } catch (err) {
      this.#recordMiss('path', {
        path,
        reason: err?.message || 'path-resolution-error',
        ...metadataClone,
        metadata: metadataClone,
      });
      return undefined;
    }
  }

  #buildUnknownResult(reason) {
    return {
      status: PLANNING_STATE_COMPONENT_STATUSES.UNKNOWN,
      value: false,
      source: null,
      reason,
    };
  }

  #buildPresentResult(source, value) {
    return {
      status: PLANNING_STATE_COMPONENT_STATUSES.PRESENT,
      value,
      source,
      reason: null,
    };
  }

  #buildAbsentResult(entry) {
    return {
      status: PLANNING_STATE_COMPONENT_STATUSES.ABSENT,
      value: false,
      source: this.#resolvePrimarySource(entry),
      reason: PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING,
    };
  }

  #normalizeComponentValue(value) {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'object') {
      return true;
    }
    return Boolean(value);
  }

  #resolvePrimarySource(entry) {
    if (!entry?.sources || entry.sources.size === 0) {
      return null;
    }
    if (entry.sources.has(PLANNING_STATE_COMPONENT_SOURCES.ACTOR)) {
      return PLANNING_STATE_COMPONENT_SOURCES.ACTOR;
    }
    if (entry.sources.has(PLANNING_STATE_COMPONENT_SOURCES.STATE)) {
      return PLANNING_STATE_COMPONENT_SOURCES.STATE;
    }
    if (entry.sources.has(PLANNING_STATE_COMPONENT_SOURCES.FLAT)) {
      return PLANNING_STATE_COMPONENT_SOURCES.FLAT;
    }
    const [firstSource] = entry.sources;
    return firstSource || null;
  }

  #buildEvaluationContext() {
    const base = { ...this.#state };
    if (this.#actorSnapshot) {
      base.actor = this.#actorSnapshot;
    }

    const stateWrapper = { ...base };
    stateWrapper.actor = this.#actorSnapshot || base.actor;

    const context = {
      ...base,
      state: stateWrapper,
    };

    if (!context.actor && this.#actorSnapshot) {
      context.actor = this.#actorSnapshot;
    }

    return context;
  }

  #buildEntityIndex() {
    const index = new Map();

    const register = (entityId, componentId, value, source = null) => {
      if (!entityId || !componentId) {
        return;
      }
      if (!index.has(entityId)) {
        index.set(entityId, {
          components: new Set(),
          values: new Map(),
          sources: new Set(),
        });
      }
      const entry = index.get(entityId);
      entry.components.add(componentId);
      entry.values.set(componentId, {
        value,
        source,
      });
      if (source) {
        entry.sources.add(source);
      }
    };

    for (const [key, value] of Object.entries(this.#state)) {
      if (typeof key !== 'string' || !key.includes(':')) {
        continue;
      }
      const [entityId, ...componentParts] = key.split(':');
      const componentId = componentParts.join(':');
      register(
        entityId,
        componentId,
        value,
        PLANNING_STATE_COMPONENT_SOURCES.FLAT
      );
    }

    const nested = this.#state.state;
    if (nested && typeof nested === 'object') {
      for (const [entityId, entityData] of Object.entries(nested)) {
        if (!entityData || typeof entityData !== 'object') {
          continue;
        }
        const componentsObject = entityData.components || entityData;
        if (!componentsObject || typeof componentsObject !== 'object') {
          continue;
        }
        for (const [componentId, componentValue] of Object.entries(
          componentsObject
        )) {
          if (componentId.includes('_') && componentsObject[componentId.replace(/_/g, ':')]) {
            continue; // Skip flattened aliases when colon key exists
          }
          register(
            entityId,
            componentId,
            componentValue,
            PLANNING_STATE_COMPONENT_SOURCES.STATE
          );
        }
      }
    }

    if (this.#actorId && this.#actorSnapshot?.components) {
      for (const [componentId, componentValue] of Object.entries(
        this.#actorSnapshot.components
      )) {
        if (componentId.includes('_') && this.#actorSnapshot.components[componentId.replace(/_/g, ':')]) {
          continue;
        }
        register(
          this.#actorId,
          componentId,
          componentValue,
          PLANNING_STATE_COMPONENT_SOURCES.ACTOR
        );
      }
    }

    return index;
  }

  #buildActorSnapshot() {
    const actorData = this.#state.actor || this.#state.state?.actor;
    const base = {
      id: actorData?.id || this.#actorId || null,
      components: {},
    };

    if (!base.id) {
      return null;
    }

    const registerComponent = (componentId, value) => {
      if (!componentId) {
        return;
      }
      base.components[componentId] = value;
      const flattened = this.#flattenComponentId(componentId);
      base.components[flattened] = value;
    };

    if (actorData?.components && typeof actorData.components === 'object') {
      for (const [componentId, componentValue] of Object.entries(actorData.components)) {
        registerComponent(componentId, componentValue);
      }
    }

    for (const [key, value] of Object.entries(this.#state)) {
      if (typeof key !== 'string' || !key.includes(':')) {
        continue;
      }
      const [entityId, ...componentParts] = key.split(':');
      const componentId = componentParts.join(':');
      if (entityId === base.id) {
        registerComponent(componentId, value);
      }
    }

    return base;
  }

  #inferActorId() {
    if (this.#state?.actor?.id) {
      return this.#state.actor.id;
    }
    if (this.#state?.state?.actor?.id) {
      return this.#state.state.actor.id;
    }
    const flatKey = Object.keys(this.#state).find((key) => key.includes(':'));
    if (flatKey) {
      return flatKey.split(':')[0];
    }
    return null;
  }

  #flattenComponentId(componentId) {
    return componentId.replace(/:/g, '_');
  }

  #recordMiss(type, details = {}) {
    const payload = {
      actorId: details.actorId || this.getActorId() || undefined,
      path: details.path || null,
      entityId: details.entityId || null,
      componentId: details.componentId || null,
      origin: details.origin || this.#metadata.origin || null,
      goalId: details.goalId || this.#metadata.goalId || null,
      taskId: details.taskId || this.#metadata.taskId || null,
      reason: details.reason || 'planning-state-miss',
      metadata: details.metadata || this.#metadata || null,
    };

    recordPlanningStateMiss(payload);

    if (this.#logger?.warn) {
      this.#logger.warn(
        `PlanningStateView: Missing ${type} information in planning state`,
        payload
      );
    }

    if (process.env.GOAP_STATE_ASSERT === '1') {
      const jsonLogicExpression =
        (payload.metadata && payload.metadata.jsonLogicExpression) ||
        payload.path ||
        null;
      const errorDetails = {
        type,
        reason: payload.reason,
        actorId: payload.actorId || undefined,
        entityId: payload.entityId || undefined,
        componentId: payload.componentId || undefined,
        jsonLogicExpression,
      };
      const remediation =
        'Ensure the planning state hydrates this entity/component or disable GOAP_STATE_ASSERT to collect diagnostics.';
      const error = new Error(
        `[GOAP_STATE_MISS] Missing ${type} data. ${remediation} Details: ${JSON.stringify(errorDetails)}`
      );
      error.code = 'GOAP_STATE_MISS';
      error.details = errorDetails;
      throw error;
    }
  }
}

export default createPlanningStateView;
