/**
 * @file Service for generating activity descriptions based on component metadata.
 * Follows the Equipment service pattern from BODCLODES.
 * Integrates into BodyDescriptionComposer as an optional extension point.
 * @see src/clothing/services/equipmentDescriptionService.js
 * @see reports/BODCLODES-body-description-composition-architecture.md
 * @see brainstorming/ACTDESC-activity-description-composition-design.md
 */

import {
  validateDependency,
  ensureValidLogger,
  assertNonBlankString,
} from '../../utils/index.js';

/**
 * @typedef {object} ActivityGroup
 * @description Represents a grouped collection of related activities.
 * @property {object} primaryActivity - The leading activity for the group.
 * @property {Array<ActivityGroupRelatedActivity>} relatedActivities - Additional grouped activities with their conjunctions.
 */

/**
 * @typedef {object} ActivityGroupRelatedActivity
 * @description Describes a related activity and how it should be connected to the primary activity.
 * @property {object} activity - The related activity metadata.
 * @property {string} conjunction - Conjunction used to join with the primary activity.
 */

/**
 * @typedef {object} ActivityPhraseComponents
 * @description Represents the decomposed pieces of a generated activity phrase.
 * @property {string} fullPhrase - The full phrase including the actor reference.
 * @property {string} verbPhrase - The phrase without the actor/copula for conjunction usage.
 */

class ActivityDescriptionService {
  #logger;

  #entityManager;

  #anatomyFormattingService;

  #entityNameCache = new Map();

  #activityIndex = null; // Phase 3: ACTDESC-020

  #simultaneousPriorityThreshold = 10;

  /**
   * Creates an ActivityDescriptionService instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.logger - Logger service
   * @param {object} dependencies.entityManager - Entity manager for component access
   * @param {object} dependencies.anatomyFormattingService - Configuration service
   * @param {object} [dependencies.activityIndex] - Optional index for performance (Phase 3)
   */
  constructor({
    logger,
    entityManager,
    anatomyFormattingService,
    activityIndex = null,
  }) {
    this.#logger = ensureValidLogger(logger, 'ActivityDescriptionService');

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(
      anatomyFormattingService,
      'AnatomyFormattingService',
      this.#logger
    );

    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#activityIndex = activityIndex;
  }

  /**
   * Generate activity description for an entity.
   *
   * @param {string} entityId - Entity ID to generate activity description for
   * @returns {Promise<string>} Formatted activity description (empty string if no activities)
   * @example
   * const description = await service.generateActivityDescription('character_1');
   * // Returns: "Activity: Jon Ureña is kneeling before Alicia Western."
   */
  async generateActivityDescription(entityId) {
    assertNonBlankString(
      entityId,
      'entityId',
      'ActivityDescriptionService.generateActivityDescription',
      this.#logger
    );

    try {
      this.#logger.debug(`Generating activity description for entity: ${entityId}`);

      const entity = this.#entityManager.getEntityInstance(entityId);

      const activities = this.#collectActivityMetadata(entityId);

      if (activities.length === 0) {
        this.#logger.debug(`No activities found for entity: ${entityId}`);
        return '';
      }

      const conditionedActivities = this.#filterByConditions(activities, entity);

      if (conditionedActivities.length === 0) {
        this.#logger.debug(
          `No visible activities available after filtering for entity: ${entityId}`
        );
        return this.#formatActivityDescription([], entity);
      }

      const prioritizedActivities = this.#sortByPriority(conditionedActivities);
      const description = this.#formatActivityDescription(
        prioritizedActivities,
        entity
      );

      if (!description) {
        this.#logger.debug(
          `No formatted activity description produced for entity: ${entityId}`
        );
        return '';
      }

      return description;

    } catch (error) {
      this.#logger.error(
        `Failed to generate activity description for entity ${entityId}`,
        error
      );
      return ''; // Fail gracefully
    }
  }

  // Stub methods - to be implemented in subsequent tickets
   
  #collectActivityMetadata(entityId) {
    // ACTDESC-006, ACTDESC-007
    const activities = [];

    // Collect from activity index (Phase 3)
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
          `Failed to collect activity metadata for entity ${entityId}`,
          error
        );
      }
    }

    // Collect inline metadata (ACTDESC-006)
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      const inlineActivities = this.#collectInlineMetadata(entity);
      activities.push(...inlineActivities);
    } catch (error) {
      this.#logger.error(
        `Failed to collect inline metadata for entity ${entityId}`,
        error
      );
    }

    // Collect dedicated metadata (ACTDESC-007)
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      const dedicatedActivities = this.#collectDedicatedMetadata(entity);
      activities.push(...dedicatedActivities);
    } catch (error) {
      this.#logger.error(
        `Failed to collect dedicated metadata for entity ${entityId}`,
        error
      );
    }

    return activities;
  }

  /**
   * Collect inline metadata from components.
   *
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Inline metadata activities
   * @private
   */
   
  #collectInlineMetadata(entity) {
    const activities = [];
    const componentIds = entity.componentTypeIds ?? [];

    for (const componentId of componentIds) {
      // Skip dedicated metadata components (already processed)
      if (componentId === 'activity:description_metadata') {
        continue;
      }

      const componentData = entity.getComponentData(componentId);
      const activityMetadata = componentData?.activityMetadata;

      if (activityMetadata?.shouldDescribeInActivity) {
        try {
          const activity = this.#parseInlineMetadata(
            componentId,
            componentData,
            activityMetadata
          );
          if (activity) {
            activities.push(activity);
          }
        } catch (error) {
          this.#logger.error(
            `Failed to parse inline metadata for ${componentId}`,
            error
          );
        }
      }
    }

    return activities;
  }

  /**
   * Parse inline metadata into activity object.
   *
   * @param {string} componentId - Component ID
   * @param {object} componentData - Full component data
   * @param {object} activityMetadata - Activity metadata from component
   * @returns {object|null} Activity object or null if invalid
   * @private
   */
   
  #parseInlineMetadata(componentId, componentData, activityMetadata) {
    const { template, targetRole = 'entityId', priority = 50 } = activityMetadata;

    if (!template) {
      this.#logger.warn(`Inline metadata missing template for ${componentId}`);
      return null;
    }

    // Resolve target entity ID
    const targetEntityId = componentData[targetRole];

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
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Dedicated metadata activities (single item or empty)
   * @private
   */

  #collectDedicatedMetadata(entity) {
    const activities = [];

    // Check if entity has dedicated metadata component type
    // Note: Entity can only have ONE instance of each component type
    if (!entity.hasComponent('activity:description_metadata')) {
      return activities;
    }

    // Get the single metadata component
    const metadata = entity.getComponentData('activity:description_metadata');

    if (!metadata) {
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
   * @param {object} metadata - Metadata component data
   * @param {object} entity - Entity instance
   * @returns {object|null} Activity object or null if invalid
   * @private
   */

  #parseDedicatedMetadata(metadata, entity) {
    const { sourceComponent, descriptionType, targetRole, priority = 50 } = metadata;

    if (!sourceComponent) {
      this.#logger.warn('Dedicated metadata missing sourceComponent');
      return null;
    }

    // Get source component data
    const sourceData = entity.getComponentData(sourceComponent);
    if (!sourceData) {
      this.#logger.warn(`Source component not found: ${sourceComponent}`);
      return null;
    }

    // Resolve target entity ID
    const targetEntityId = sourceData[targetRole || 'entityId'];

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


  #filterByConditions(activities, _entity) {
    // ACTDESC-018 (Phase 3)
    return activities.filter((activity) => {
      if (!activity || activity.visible === false) {
        return false;
      }

      if (typeof activity.condition === 'function') {
        try {
          return activity.condition(_entity);
        } catch (error) {
          this.#logger.warn(
            'Condition evaluation failed for activity description entry',
            error
          );
          return false;
        }
      }

      return true;
    });
  }

   
  #sortByPriority(activities) {
    // ACTDESC-016 (Phase 2)
    return [...activities].sort(
      (a, b) => (b?.priority ?? 0) - (a?.priority ?? 0)
    );
  }


  #formatActivityDescription(activities, entity) {
    // ACTDESC-008 (Phase 2 - Enhanced with Pronoun Resolution)
    // ACTDESC-014: Pronoun resolution implementation
    const config =
      this.#anatomyFormattingService.getActivityIntegrationConfig?.() ?? {};

    if (activities.length === 0) {
      return '';
    }

    // Get actor name and gender for pronoun resolution
    const actorId = entity?.id;
    const actorName = this.#resolveEntityName(actorId);
    const actorGender = this.#detectEntityGender(actorId);
    const actorPronouns = this.#getPronounSet(actorGender);
    const pronounsEnabled =
      config.nameResolution?.usePronounsWhenAvailable === true;

    // Respect maxActivities limit
    const maxActivities = config.maxActivities ?? 10;
    const limitedActivities = activities.slice(0, maxActivities);

    const groupedActivities = this.#groupActivities(limitedActivities);

    const descriptions = [];

    groupedActivities.forEach((group, index) => {
      const isFirstGroup = index === 0;
      const useActorPronounForPrimary = !isFirstGroup && pronounsEnabled;
      const actorReference = useActorPronounForPrimary
        ? actorPronouns.subject
        : actorName;

      const primaryPhraseResult = this.#generateActivityPhrase(
        actorReference,
        group.primaryActivity,
        useActorPronounForPrimary
      );

      const primaryPhrase =
        typeof primaryPhraseResult === 'string'
          ? primaryPhraseResult
          : primaryPhraseResult?.fullPhrase ?? '';

      if (!primaryPhrase || !primaryPhrase.trim()) {
        return;
      }

      let groupDescription = primaryPhrase.trim();

      for (const related of group.relatedActivities) {
        const phraseComponents = this.#generateActivityPhrase(
          actorReference,
          related.activity,
          pronounsEnabled,
          { omitActor: true }
        );

        const fragment = this.#buildRelatedActivityFragment(
          related.conjunction,
          phraseComponents,
          {
            actorName,
            actorReference,
            actorPronouns,
            pronounsEnabled,
          }
        );

        if (fragment) {
          groupDescription = `${groupDescription} ${fragment}`.trim();
        }
      }

      if (groupDescription) {
        descriptions.push(groupDescription);
      }
    });

    if (descriptions.length === 0) {
      return '';
    }

    // Format with configuration
    const prefix = config.prefix ?? '';
    const suffix = config.suffix ?? '';
    const separator = config.separator ?? '. ';

    const activityText = descriptions.join(separator);
    return `${prefix}${activityText}${suffix}`.trim();
  }

  /**
   * Generate a single activity phrase.
   * ACTDESC-014: Enhanced with pronoun support for target entities
   *
   * @param {string} actorRef - Actor name or pronoun
   * @param {object} activity - Activity object
   * @param {boolean} usePronounsForTarget - Whether to use pronouns for target (default: false)
   * @param {object} [options] - Additional generation options
   * @param {boolean} [options.omitActor=false] - When true, return decomposed phrases for grouping
   * @returns {string|ActivityPhraseComponents} Activity phrase or decomposed components when omitActor is true
   * @private
   */

  #generateActivityPhrase(
    actorRef,
    activity,
    usePronounsForTarget = false,
    options = {}
  ) {
    const targetEntityId = activity.targetEntityId || activity.targetId;

    // Resolve target reference (name or pronoun)
    let targetRef = '';
    if (targetEntityId) {
      if (usePronounsForTarget) {
        const targetGender = this.#detectEntityGender(targetEntityId);
        const targetPronouns = this.#getPronounSet(targetGender);
        targetRef = targetPronouns.object; // 'him', 'her', 'them'
      } else {
        targetRef = this.#resolveEntityName(targetEntityId);
      }
    }

    let rawPhrase = '';

    if (activity.type === 'inline') {
      // Use template replacement
      if (activity.template) {
        rawPhrase = activity.template
          .replace(/\{actor\}/g, actorRef)
          .replace(/\{target\}/g, targetRef);
      } else if (activity.description) {
        const normalizedDesc = activity.description.trim();
        if (normalizedDesc) {
          rawPhrase = targetRef
            ? `${actorRef} ${normalizedDesc} ${targetRef}`
            : `${actorRef} ${normalizedDesc}`;
        }
      }
    } else if (activity.type === 'dedicated') {
      // Dedicated metadata: construct from verb/adverb
      const verb = (activity.verb || 'interacting with').trim();
      const adverb = activity.adverb ? ` ${activity.adverb.trim()}` : '';

      if (targetRef) {
        rawPhrase = `${actorRef} is ${verb} ${targetRef}${adverb}`;
      } else {
        rawPhrase = `${actorRef} is ${verb}${adverb}`;
      }
    } else if (activity.description) {
      const normalizedDesc = activity.description.trim();
      if (normalizedDesc) {
        rawPhrase = targetRef
          ? `${actorRef} ${normalizedDesc} ${targetRef}`
          : `${actorRef} ${normalizedDesc}`;
      }
    } else if (activity.verb) {
      const normalizedVerb = activity.verb.trim();
      if (normalizedVerb) {
        rawPhrase = targetRef
          ? `${actorRef} ${normalizedVerb} ${targetRef}`
          : `${actorRef} ${normalizedVerb}`;
      }
    }

    const normalizedPhrase = rawPhrase.trim();
    const omitActor = options?.omitActor === true;

    if (!omitActor) {
      return normalizedPhrase;
    }

    if (!normalizedPhrase) {
      return { fullPhrase: '', verbPhrase: '' };
    }

    const actorToken = (actorRef ?? '').trim();
    let verbPhrase = normalizedPhrase;

    if (actorToken) {
      const actorPattern = new RegExp(
        `^${this.#escapeRegExp(actorToken)}\\s+`,
        'i'
      );
      verbPhrase = verbPhrase.replace(actorPattern, '').trim();
    }

    return {
      fullPhrase: normalizedPhrase,
      verbPhrase,
    };
  }

  /**
   * @description Sanitize verb phrases to prevent duplicate copulas when grouping activities.
   * @param {string} phrase - Raw verb phrase with potential leading copula.
   * @returns {string} Cleaned phrase suitable for conjunction usage.
   * @private
   */
  #sanitizeVerbPhrase(phrase) {
    if (!phrase) {
      return '';
    }

    const trimmed = phrase.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.replace(/^(?:is|are|was|were|am)\s+/i, '').trim();
  }

  /**
   * @description Build the fragment used to connect related activities to the primary activity.
   * @param {string} conjunction - Conjunction used to join the phrase ("and" or "while").
   * @param {ActivityPhraseComponents} phraseComponents - Generated phrase components for the related activity.
   * @param {object} context - Actor context for pronoun and naming logic.
   * @param {string} context.actorName - Resolved actor name.
   * @param {string} context.actorReference - Reference used for the primary activity (name or pronoun).
   * @param {object} context.actorPronouns - Pronoun set for the actor.
   * @param {boolean} context.pronounsEnabled - Whether pronouns are enabled in configuration.
   * @returns {string} Fragment to append to the primary phrase.
   * @private
   */
  #buildRelatedActivityFragment(
    conjunction,
    phraseComponents,
    { actorName, actorReference, actorPronouns, pronounsEnabled }
  ) {
    if (!phraseComponents) {
      return '';
    }

    const rawVerbPhrase = phraseComponents.verbPhrase?.trim() ?? '';
    const sanitizedVerbPhrase = this.#sanitizeVerbPhrase(rawVerbPhrase);
    const removedCopula =
      sanitizedVerbPhrase && rawVerbPhrase !== sanitizedVerbPhrase;
    const fallbackPhrase = phraseComponents.fullPhrase?.trim() ?? '';
    const safeConjunction = conjunction || 'and';

    if (!sanitizedVerbPhrase && !fallbackPhrase) {
      return '';
    }

    if (safeConjunction === 'while') {
      if (sanitizedVerbPhrase) {
        if (removedCopula) {
          return `while ${sanitizedVerbPhrase}`;
        }

        const subjectRef = pronounsEnabled
          ? actorPronouns.subject
          : actorReference || actorName;

        if (subjectRef) {
          return `while ${subjectRef} ${sanitizedVerbPhrase}`;
        }

        return `while ${sanitizedVerbPhrase}`;
      }

      if (fallbackPhrase) {
        return `while ${fallbackPhrase}`;
      }

      return '';
    }

    const phraseBody = sanitizedVerbPhrase || fallbackPhrase;

    if (!phraseBody) {
      return '';
    }

    return `${safeConjunction} ${phraseBody}`;
  }

  /**
   * @description Group activities intelligently for natural composition.
   * @param {Array<object>} activities - Activities sorted by priority.
   * @returns {Array<ActivityGroup>} Grouped activities ready for rendering.
   * @private
   */
  #groupActivities(activities) {
    const groups = [];
    let currentGroup = null;

    for (const activity of activities) {
      if (!currentGroup) {
        currentGroup = this.#startActivityGroup(activity);
        continue;
      }

      if (this.#shouldGroupActivities(currentGroup.primaryActivity, activity)) {
        currentGroup.relatedActivities.push({
          activity,
          conjunction: this.#determineConjunction(
            currentGroup.primaryActivity,
            activity
          ),
        });
        continue;
      }

      groups.push(currentGroup);
      currentGroup = this.#startActivityGroup(activity);
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * @description Initialise a new activity group.
   * @param {object} activity - Activity that becomes the group's primary entry.
   * @returns {ActivityGroup} Fresh activity group container.
   * @private
   */
  #startActivityGroup(activity) {
    return {
      primaryActivity: activity,
      relatedActivities: [],
    };
  }

  /**
   * @description Determine if two activities should be grouped together.
   * @param {object} first - Primary activity in the current group.
   * @param {object} second - Candidate activity being evaluated.
   * @returns {boolean} True when activities belong in the same group.
   * @private
   */
  #shouldGroupActivities(first, second) {
    const firstGroupKey = first?.grouping?.groupKey;
    const secondGroupKey = second?.grouping?.groupKey;

    if (firstGroupKey && firstGroupKey === secondGroupKey) {
      return true;
    }

    const firstTarget = first?.targetEntityId ?? first?.targetId;
    const secondTarget = second?.targetEntityId ?? second?.targetId;

    if (firstTarget && firstTarget === secondTarget) {
      return true;
    }

    return false;
  }

  /**
   * @description Determine the conjunction connecting two activities.
   * @param {object} first - Primary activity.
   * @param {object} second - Related activity.
   * @returns {string} Conjunction keyword.
   * @private
   */
  #determineConjunction(first, second) {
    const firstPriority = first?.priority ?? 0;
    const secondPriority = second?.priority ?? 0;

    return this.#activitiesOccurSimultaneously(firstPriority, secondPriority)
      ? 'while'
      : 'and';
  }

  /**
   * @description Determine whether activities should be considered simultaneous.
   * @param {number} firstPriority - Priority of the first activity.
   * @param {number} secondPriority - Priority of the second activity.
   * @returns {boolean} True when priorities are within the simultaneous threshold.
   * @private
   */
  #activitiesOccurSimultaneously(firstPriority, secondPriority) {
    return (
      Math.abs((firstPriority ?? 0) - (secondPriority ?? 0)) <=
      this.#simultaneousPriorityThreshold
    );
  }

  /**
   * @description Escape special characters within a string for safe RegExp usage.
   * @param {string} value - Raw string to escape.
   * @returns {string} Escaped string.
   * @private
   */
  #escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }


  #resolveEntityName(entityId) {
    // ACTDESC-009
    if (!entityId) {
      return 'Unknown entity';
    }

    if (this.#entityNameCache.has(entityId)) {
      return this.#entityNameCache.get(entityId);
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);

      // Entities use core:name component for their names
      const nameComponent = entity.getComponentData?.('core:name');
      const resolvedName = nameComponent?.text ?? entity?.id ?? entityId;

      this.#entityNameCache.set(entityId, resolvedName);
      return resolvedName;
    } catch (error) {
      this.#logger.warn(
        `Failed to resolve entity name for ${entityId}`,
        error
      );
      return entityId;
    }
  }

  /**
   * Detect entity gender for pronoun resolution.
   * ACTDESC-014: Phase 2 Natural Language Enhancement
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Gender: 'male', 'female', 'neutral', or 'unknown'
   * @private
   */
  #detectEntityGender(entityId) {
    if (!entityId) {
      return 'unknown';
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        return 'unknown';
      }

      // Check for explicit gender component
      const genderComponent = entity.getComponentData?.('core:gender');
      if (genderComponent?.value) {
        return genderComponent.value; // 'male', 'female', 'neutral'
      }

      // Default to neutral pronouns if unknown
      return 'neutral';
    } catch (error) {
      this.#logger.warn(
        `Failed to detect gender for entity ${entityId}`,
        error
      );
      return 'neutral';
    }
  }

  /**
   * Get pronouns for entity based on gender.
   * ACTDESC-014: Phase 2 Natural Language Enhancement
   *
   * @param {string} gender - Gender value ('male', 'female', 'neutral', 'unknown')
   * @returns {object} Pronoun set with subject, object, possessive, possessivePronoun
   * @private
   */
  #getPronounSet(gender) {
    const pronounSets = {
      male: {
        subject: 'he',
        object: 'him',
        possessive: 'his',
        possessivePronoun: 'his',
      },
      female: {
        subject: 'she',
        object: 'her',
        possessive: 'her',
        possessivePronoun: 'hers',
      },
      neutral: {
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      },
      unknown: {
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      },
    };

    return pronounSets[gender] || pronounSets.neutral;
  }
}

export default ActivityDescriptionService;
