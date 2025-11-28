/**
 * @file Activity Metadata Collection System
 * @description Implements 3-tier metadata collection for activity descriptions:
 * Tier 1: Optional ActivityIndex (fastest)
 * Tier 2: Inline component metadata (fallback)
 * Tier 3: Dedicated metadata components (fallback)
 *
 * Extracted from ActivityDescriptionService for better separation of concerns.
 * @see activityDescriptionService.js
 */

import {
  validateDependency,
  ensureValidLogger,
} from '../../utils/index.js';

/**
 * Manages activity metadata collection from multiple sources with fallback strategy.
 *
 * Collection Strategy:
 * 1. ActivityIndex lookup (if available) - Fast pre-computed index
 * 2. Inline metadata - Scan component activityMetadata fields
 * 3. Dedicated metadata - Check activity:description_metadata component
 * 4. Deduplicate - Remove activities with identical semantic signatures
 *
 * All collected activities are deduplicated based on semantic signature
 * (type, template, source component, target, and groupKey).
 */
class ActivityMetadataCollectionSystem {
  #entityManager;

  #activityIndex;

  #logger;

  /**
   * Create an ActivityMetadataCollectionSystem instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.entityManager - Entity manager for component access
   * @param {object} dependencies.logger - Logger service
   * @param {object} [dependencies.activityIndex] - Optional index for performance (Phase 3)
   */
  constructor({ entityManager, logger, activityIndex = null }) {
    this.#logger = ensureValidLogger(
      logger,
      'ActivityMetadataCollectionSystem'
    );

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'],
    });

    this.#entityManager = entityManager;
    this.#activityIndex = activityIndex;

    this.#logger.debug('ActivityMetadataCollectionSystem initialized');
  }

  /**
   * Collect activity metadata using 3-tier fallback strategy.
   *
   * Tier 1: Optional ActivityIndex (fastest, pre-computed)
   * Tier 2: Inline component metadata (scan activityMetadata fields)
   * Tier 3: Dedicated metadata components (activity:description_metadata)
   *
   * All collected activities are deduplicated by semantic signature
   * to prevent redundant descriptions.
   *
   * @param {string} entityId - Entity ID to collect metadata for
   * @param {object} [entity] - Optional pre-fetched entity instance
   * @returns {Array<object>} Deduplicated activity metadata array
   * @example
   * const activities = collector.collectActivityMetadata('actor_1', actorEntity);
   * // Returns: [{ type: 'inline', template: '{actor} is kneeling before {target}', ... }]
   */
  collectActivityMetadata(entityId, entity = null) {
    const activities = [];

    // Tier 1: Collect from activity index (Phase 3 - optional)
    if (
      this.#activityIndex &&
      typeof this.#activityIndex.findActivitiesForEntity === 'function'
    ) {
      try {
        const indexedActivities =
          this.#activityIndex.findActivitiesForEntity(entityId);

        if (!Array.isArray(indexedActivities)) {
          this.#logger.warn(
            `Activity index returned invalid data for entity ${entityId}`
          );
        } else {
          activities.push(...indexedActivities.filter(Boolean));
        }
      } catch (error) {
        this.#logger.error(
          `Failed to collect activity metadata from index for entity ${entityId}`,
          error
        );
      }
    }

    // Resolve entity if not provided
    let resolvedEntity = entity;
    if (!resolvedEntity) {
      try {
        resolvedEntity = this.#entityManager.getEntityInstance(entityId);
      } catch (error) {
        this.#logger.warn(
          `Failed to resolve entity for metadata collection: ${entityId}`,
          error
        );
      }
    }

    if (!resolvedEntity) {
      this.#logger.warn(
        `No entity available for metadata collection: ${entityId}`
      );
      return activities.filter(Boolean);
    }

    // Tier 2: Collect inline metadata
    try {
      const inlineActivities = this.collectInlineMetadata(resolvedEntity);
      activities.push(...inlineActivities);
    } catch (error) {
      this.#logger.error(
        `Failed to collect inline metadata for entity ${entityId}`,
        error
      );
    }

    // Tier 3: Collect dedicated metadata
    try {
      const dedicatedActivities =
        this.collectDedicatedMetadata(resolvedEntity);
      activities.push(...dedicatedActivities);
    } catch (error) {
      this.#logger.error(
        `Failed to collect dedicated metadata for entity ${entityId}`,
        error
      );
    }

    return activities.filter(Boolean);
  }

  /**
   * Collect inline metadata from component activityMetadata fields.
   *
   * Scans all entity components for activityMetadata fields and
   * parses them into activity objects. Skips dedicated metadata
   * components (processed separately).
   *
   * @param {object} entity - Entity instance to scan
   * @returns {Array<object>} Inline metadata activities
   * @example
   * const inlineActivities = collector.collectInlineMetadata(entity);
   * // Returns: [{ type: 'inline', sourceComponent: 'positioning:kneeling', ... }]
   */
  collectInlineMetadata(entity) {
    const activities = [];
    if (!entity || typeof entity !== 'object') {
      this.#logger.warn(
        'Cannot collect inline metadata without a valid entity'
      );
      return activities;
    }

    const componentIds = Array.isArray(entity.componentTypeIds)
      ? entity.componentTypeIds
      : [];

    this.#logger.info('Scanning components for inline metadata', {
      entityId: entity?.id,
      componentCount: componentIds.length,
      componentIds,
    });

    for (const componentId of componentIds) {
      // Skip dedicated metadata components (already processed)
      if (componentId === 'activity:description_metadata') {
        continue;
      }

      if (typeof entity.getComponentData !== 'function') {
        this.#logger.warn(
          `Entity ${entity?.id ?? 'unknown'} is missing getComponentData; skipping ${componentId}`
        );
        continue;
      }

      let componentData;
      try {
        componentData = entity.getComponentData(componentId);
      } catch (error) {
        this.#logger.error(
          `Failed to retrieve component data for ${componentId}`,
          error
        );
        continue;
      }

      if (!componentData || typeof componentData !== 'object') {
        this.#logger.warn(
          `Component ${componentId} returned invalid data; skipping inline metadata`
        );
        continue;
      }

      const activityMetadata = componentData?.activityMetadata;

      if (activityMetadata && typeof activityMetadata !== 'object') {
        this.#logger.warn(
          `Activity metadata for ${componentId} is malformed; skipping`
        );
        continue;
      }

      // Only process components that have activityMetadata and aren't explicitly disabled
      if (
        activityMetadata &&
        activityMetadata?.shouldDescribeInActivity !== false
      ) {
        this.#logger.info('Found activity metadata in component', {
          componentId,
          hasTemplate: !!activityMetadata?.template,
          hasPriority: !!activityMetadata?.priority,
          hasTargetRole: !!activityMetadata?.targetRole,
          shouldDescribe: activityMetadata?.shouldDescribeInActivity,
        });

        try {
          const activity = this.#parseInlineMetadata(
            componentId,
            componentData,
            activityMetadata
          );
          if (activity) {
            this.#logger.info('Successfully parsed inline metadata', {
              componentId,
              activityPriority: activity.priority,
            });
            activities.push(activity);
          } else {
            this.#logger.info('Inline metadata parsing returned null', {
              componentId,
            });
          }
        } catch (error) {
          this.#logger.error(
            `Failed to parse inline metadata for ${componentId}`,
            error
          );
        }
      }
    }

    this.#logger.info('Finished scanning inline metadata', {
      entityId: entity?.id,
      activitiesFound: activities.length,
      activitySources: activities.map((a) => a.source),
    });

    return activities;
  }

  /**
   * Parse inline metadata into activity object.
   *
   * Extracts template, targetRole, targetRoleIsArray, and priority from inline metadata
   * and resolves target entity ID(s) from component data.
   *
   * For single targets (default): returns object with `targetEntityId` and `targetId`
   * For array targets (when targetRoleIsArray=true): returns object with `targetEntityIds` and `isMultiTarget: true`
   *
   * @param {string} componentId - Component ID containing metadata
   * @param {object} componentData - Full component data
   * @param {object} activityMetadata - Activity metadata from component
   * @param {boolean} [activityMetadata.targetRoleIsArray] - Whether targetRole points to an array
   * @returns {object|null} Activity object or null if invalid
   * @private
   */
  #parseInlineMetadata(componentId, componentData, activityMetadata) {
    const {
      template,
      targetRole = 'entityId',
      targetRoleIsArray = false,
      priority = 50,
    } = activityMetadata;

    if (!template) {
      this.#logger.warn(`Inline metadata missing template for ${componentId}`);
      return null;
    }

    // Resolve target entity ID(s)
    const rawTargetValue = componentData?.[targetRole];

    // Handle array targets when targetRoleIsArray is true
    if (targetRoleIsArray && Array.isArray(rawTargetValue)) {
      const validIds = rawTargetValue.filter(
        (id) => typeof id === 'string' && id.trim().length > 0
      );

      const basicDescription = template
        .replace(/\{actor\}/g, '')
        .replace(/\{targets\}/g, '')
        .trim();

      return {
        type: 'inline',
        sourceComponent: componentId,
        sourceData: componentData,
        activityMetadata,
        conditions: activityMetadata?.conditions ?? null,
        targetEntityIds: validIds,
        isMultiTarget: true,
        priority,
        template,
        description: basicDescription,
      };
    }

    // Handle single string target (original behavior)
    let targetEntityId = null;

    if (typeof rawTargetValue === 'string') {
      const trimmedTarget = rawTargetValue.trim();
      if (trimmedTarget.length > 0) {
        targetEntityId = trimmedTarget;
      } else if (rawTargetValue.length > 0) {
        this.#logger.warn(
          `Inline metadata for ${componentId} provided blank target entity reference for role ${targetRole}; using null`
        );
      }
    } else if (rawTargetValue !== undefined && rawTargetValue !== null) {
      this.#logger.warn(
        `Inline metadata for ${componentId} provided invalid target entity reference for role ${targetRole}; expected non-empty string`
      );
    }

    // For Phase 1 compatibility with existing formatter, provide a basic description
    // Phase 2 (ACTDESC-008) will handle proper template interpolation
    const basicDescription = template
      .replace(/\{actor\}/g, '')
      .replace(/\{target\}/g, '')
      .trim();

    return {
      type: 'inline',
      sourceComponent: componentId,
      sourceData: componentData,
      activityMetadata,
      conditions: activityMetadata?.conditions ?? null,
      targetEntityId,
      targetId: targetEntityId, // Alias for compatibility with formatter
      priority,
      template,
      description: basicDescription, // Temporary for Phase 1 formatter
    };
  }

  /**
   * Collect dedicated metadata component.
   *
   * Checks for activity:description_metadata component and parses
   * it into activity object. Entity can only have ONE instance of
   * each component type.
   *
   * @param {object} entity - Entity instance to check
   * @returns {Array<object>} Dedicated metadata activities (single item or empty)
   * @example
   * const dedicatedActivities = collector.collectDedicatedMetadata(entity);
   * // Returns: [{ type: 'dedicated', sourceComponent: 'positioning:kneeling', ... }] or []
   */
  collectDedicatedMetadata(entity) {
    const activities = [];

    if (!entity || typeof entity !== 'object') {
      this.#logger.warn(
        'Cannot collect dedicated metadata without a valid entity'
      );
      return activities;
    }

    if (typeof entity.hasComponent !== 'function') {
      this.#logger.warn(
        `Entity ${entity?.id ?? 'unknown'} is missing hasComponent; skipping dedicated metadata`
      );
      return activities;
    }

    let hasMetadataComponent = false;
    try {
      hasMetadataComponent = entity.hasComponent(
        'activity:description_metadata'
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to verify dedicated metadata component for ${entity?.id ?? 'unknown'}`,
        error
      );
      return activities;
    }

    // Check if entity has dedicated metadata component type
    // Note: Entity can only have ONE instance of each component type
    if (!hasMetadataComponent) {
      return activities;
    }

    // Get the single metadata component
    if (typeof entity.getComponentData !== 'function') {
      this.#logger.warn(
        `Entity ${entity?.id ?? 'unknown'} is missing getComponentData; skipping dedicated metadata`
      );
      return activities;
    }

    let metadata;
    try {
      metadata = entity.getComponentData('activity:description_metadata');
    } catch (error) {
      this.#logger.warn(
        `Failed to read dedicated metadata for ${entity?.id ?? 'unknown'}`,
        error
      );
      return activities;
    }

    if (!metadata || typeof metadata !== 'object') {
      this.#logger.warn(
        `Dedicated metadata for ${entity?.id ?? 'unknown'} is invalid; skipping`
      );
      return activities;
    }

    try {
      const activity = this.#parseDedicatedMetadata(metadata, entity);
      if (activity) {
        activities.push(activity);
      }
    } catch (error) {
      this.#logger.error(`Failed to parse dedicated metadata`, error);
    }

    return activities;
  }

  /**
   * Parse dedicated metadata component into activity object.
   *
   * Extracts sourceComponent, descriptionType, targetRole, and priority
   * from dedicated metadata and resolves target entity ID from source component.
   *
   * @param {object} metadata - Metadata component data
   * @param {object} entity - Entity instance for source component access
   * @returns {object|null} Activity object or null if invalid
   * @private
   */
  #parseDedicatedMetadata(metadata, entity) {
    if (!metadata || typeof metadata !== 'object') {
      this.#logger.warn('Dedicated metadata payload is invalid; skipping');
      return null;
    }

    if (!entity || typeof entity.getComponentData !== 'function') {
      this.#logger.warn(
        `Cannot parse dedicated metadata without component access for ${entity?.id ?? 'unknown'}`
      );
      return null;
    }

    const {
      sourceComponent,
      descriptionType,
      targetRole,
      priority = 50,
    } = metadata;

    if (!sourceComponent) {
      this.#logger.warn('Dedicated metadata missing sourceComponent');
      return null;
    }

    // Get source component data
    let sourceData;
    try {
      sourceData = entity.getComponentData(sourceComponent);
    } catch (error) {
      this.#logger.warn(
        `Failed to retrieve source component ${sourceComponent} for dedicated metadata`,
        error
      );
      return null;
    }
    if (!sourceData) {
      this.#logger.warn(`Source component not found: ${sourceComponent}`);
      return null;
    }

    // Resolve target entity ID
    const roleKey = targetRole || 'entityId';
    let targetEntityId = null;

    try {
      targetEntityId = sourceData?.[roleKey] ?? null;
    } catch (error) {
      this.#logger.warn(
        `Failed to resolve target entity for dedicated metadata ${sourceComponent}`,
        error
      );
      targetEntityId = null;
    }

    return {
      type: 'dedicated',
      sourceComponent,
      descriptionType,
      metadata,
      sourceData,
      targetEntityId,
      priority,
      verb: metadata.verb,
      template: metadata.template,
      adverb: metadata.adverb,
      conditions: metadata.conditions,
      grouping: metadata.grouping,
    };
  }

  /**
   * Remove duplicate activities that share the same descriptive signature.
   *
   * Deduplication preserves insertion order and keeps the highest priority
   * activity when duplicates are found. Activities are considered duplicates
   * when they have the same:
   * - type (inline/dedicated)
   * - template/description/verb
   * - target entity ID
   * - grouping key
   *
   * @param {Array<object>} activities - Activities to deduplicate
   * @returns {Array<object>} Deduplicated activities preserving insertion order
   * @example
   * const unique = collector.deduplicateActivitiesBySignature([
   *   { type: 'inline', template: 'is kneeling', targetId: 'actor1', priority: 10 },
   *   { type: 'inline', template: 'is kneeling', targetId: 'actor1', priority: 5 }
   * ]);
   * // Returns: [{ ... priority: 10 }] (higher priority kept)
   */
  deduplicateActivitiesBySignature(activities) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return Array.isArray(activities) ? [...activities] : [];
    }

    const entriesBySignature = new Map();

    for (const activity of activities) {
      if (!activity || typeof activity !== 'object') {
        continue;
      }

      const signature = this.#buildActivityDeduplicationKey(activity);
      const existing = entriesBySignature.get(signature);

      if (!existing) {
        entriesBySignature.set(signature, activity);
        continue;
      }

      const existingPriority = existing?.priority ?? 0;
      const candidatePriority = activity?.priority ?? 0;

      if (candidatePriority >= existingPriority) {
        entriesBySignature.set(signature, activity);
      }
    }

    return Array.from(entriesBySignature.values());
  }

  /**
   * Build deterministic signature used for deduplicating activities.
   *
   * Creates a reproducible signature encoding:
   * - type: Activity type (inline/dedicated)
   * - template/description/verb: Activity content
   * - target: Target entity ID
   * - groupKey: Grouping key for related activities
   *
   * Signature format: "type|content|target:id|group:key"
   *
   * @param {object} activity - Activity metadata entry
   * @returns {string} Signature describing the activity interaction
   * @private
   */
  #buildActivityDeduplicationKey(activity) {
    if (!activity || typeof activity !== 'object') {
      return 'invalid';
    }

    const type = activity.type ?? 'generic';
    const target = activity?.targetEntityId ?? activity?.targetId ?? 'solo';
    const groupKey = activity?.grouping?.groupKey ?? 'none';
    const template =
      typeof activity.template === 'string'
        ? activity.template.trim().toLowerCase()
        : '';
    const sourceComponent =
      typeof activity.sourceComponent === 'string'
        ? activity.sourceComponent.trim().toLowerCase()
        : '';
    const description =
      typeof activity.description === 'string'
        ? activity.description.trim().toLowerCase()
        : '';
    const verb =
      typeof activity.verb === 'string'
        ? activity.verb.trim().toLowerCase()
        : '';
    const adverb =
      typeof activity.adverb === 'string'
        ? activity.adverb.trim().toLowerCase()
        : '';

    let signatureCore = '';

    if (template) {
      signatureCore = `template:${template}`;
    } else if (sourceComponent) {
      signatureCore = `source:${sourceComponent}`;
    } else if (description) {
      signatureCore = `description:${description}`;
    } else if (verb) {
      signatureCore = `verb:${verb}:${adverb}`;
    } else {
      signatureCore = 'activity:generic';
    }

    return `${type}|${signatureCore}|target:${target}|group:${groupKey}`;
  }

  /**
   * Provide controlled access to private helpers for white-box unit testing.
   *
   * @returns {object} Selected helper functions bound to the current instance
   */
  getTestHooks() {
    return {
      parseInlineMetadata: (...args) => this.#parseInlineMetadata(...args),
      parseDedicatedMetadata: (...args) =>
        this.#parseDedicatedMetadata(...args),
      buildActivityDeduplicationKey: (...args) =>
        this.#buildActivityDeduplicationKey(...args),
    };
  }
}

export default ActivityMetadataCollectionSystem;
