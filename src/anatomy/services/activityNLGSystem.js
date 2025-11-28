/**
 * @file Natural Language Generation system for activity descriptions
 * @description Self-contained NLG system extracted from ActivityDescriptionService
 * with pronoun resolution, phrase generation, and text composition capabilities.
 *
 * CRITICAL: Pronoun logic is SELF-CONTAINED - NO AnatomyFormattingService dependency.
 * Gender detection uses EntityManager to query core:gender component directly.
 * @see workflows/ACTDESSERREF-006-extract-nlg-system.md
 * @see src/anatomy/services/activityDescriptionService.js (original source)
 */

import {
  validateDependency,
  ensureValidLogger,
} from '../../utils/index.js';
import { ACTOR_COMPONENT_ID } from '../../constants/componentIds.js';

const GENDER_COMPONENT_ID = 'core:gender';

/**
 * Natural Language Generation system for activity descriptions
 *
 * Provides self-contained pronoun resolution, phrase generation, and text composition
 * without external formatting service dependencies. Uses EntityManager for gender
 * detection via core:gender component and ActivityCacheManager for performance.
 */
class ActivityNLGSystem {
  #logger;
  #entityManager;
  #cacheManager;
  // Reserved for future configuration options (e.g., custom pronoun sets, formatting preferences)
  // eslint-disable-next-line no-unused-private-class-members
  #config;

  /**
   * Creates an ActivityNLGSystem instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.logger - Logger service (ILogger interface)
   * @param {object} dependencies.entityManager - Entity manager for component access (IEntityManager interface)
   * @param {object} dependencies.cacheManager - Cache manager for name/gender caching (ActivityCacheManager)
   * @param {object} [dependencies.config] - Optional NLG configuration (nameResolution settings)
   */
  constructor({ logger, entityManager, cacheManager, config = {} }) {
    this.#logger = ensureValidLogger(logger, 'ActivityNLGSystem');

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'],
    });

    validateDependency(cacheManager, 'ActivityCacheManager', this.#logger, {
      requiredMethods: ['get', 'set', 'invalidate'],
    });

    this.#entityManager = entityManager;
    this.#cacheManager = cacheManager;
    this.#config = config || {};

    this.#logger.debug('ActivityNLGSystem initialized');
  }

  // ============================================================================
  // Name Resolution Methods
  // ============================================================================

  /**
   * Normalise entity names to remove control characters and redundant whitespace.
   *
   * @description Sanitise a potentially untrusted entity name before exposing it to user interfaces.
   * @param {string} name - Raw entity name value.
   * @returns {string} Sanitised entity name with graceful fallback.
   */
  sanitizeEntityName(name) {
    if (typeof name !== 'string') {
      return 'Unknown entity';
    }

    // Remove control characters (eslint no-control-regex)
    const withoutControl = name.replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001F\u007F-\u009F]/g,
      ''
    );
    const withoutZeroWidth = withoutControl.replace(
      /[\u200B-\u200D\uFEFF]/g,
      ''
    );
    const collapsedWhitespace = withoutZeroWidth.replace(/\s+/g, ' ').trim();

    if (!collapsedWhitespace) {
      return 'Unknown entity';
    }

    return collapsedWhitespace;
  }

  /**
   * Resolve entity name from ID with caching support.
   *
   * @description Resolve entity display name using core:name component with cache optimization.
   * @param {string} entityId - Entity identifier to resolve.
   * @returns {string} Resolved and sanitized entity name or fallback.
   */
  resolveEntityName(entityId) {
    if (!entityId) {
      return 'Unknown entity';
    }

    const cachedName = this.#cacheManager.get('entityName', entityId);
    if (cachedName) {
      return cachedName;
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);

      if (!entity) {
        this.#logger.debug(
          `Failed to resolve entity name for ${entityId}: entity not found`
        );
        const fallbackName = this.sanitizeEntityName(entityId);
        this.#cacheManager.set('entityName', entityId, fallbackName);
        return fallbackName;
      }

      // Entities use core:name component for their names
      let resolvedName;
      try {
        const nameComponent = entity?.getComponentData?.('core:name');
        resolvedName = nameComponent?.text ?? entity?.id ?? entityId;
      } catch (error) {
        this.#logger.debug(
          `Failed to access name component for entity ${entityId}`,
          error
        );
        resolvedName = entity?.id ?? entityId;
      }

      const sanitisedName = this.sanitizeEntityName(resolvedName);

      this.#cacheManager.set('entityName', entityId, sanitisedName);
      return sanitisedName;
    } catch (error) {
      this.#logger.debug(
        `Failed to resolve entity name for ${entityId}`,
        error
      );
      const fallbackName = this.sanitizeEntityName(entityId);
      this.#cacheManager.set('entityName', entityId, fallbackName);
      return fallbackName;
    }
  }

  /**
   * Determine whether pronouns should be used when referencing a target entity.
   *
   * @description Restrict pronoun usage to sentient targets such as actors or
   * entities with explicit gender metadata to avoid misgendering inanimate
   * objects like furniture.
   * @param {string} targetEntityId - Identifier of the target entity.
   * @returns {boolean} True if pronouns should be used for the target entity.
   */
  shouldUsePronounForTarget(targetEntityId) {
    if (!targetEntityId) {
      return false;
    }

    try {
      const targetEntity =
        this.#entityManager?.getEntityInstance?.(targetEntityId);

      if (!targetEntity) {
        return false;
      }

      if (typeof targetEntity.hasComponent === 'function') {
        if (targetEntity.hasComponent(ACTOR_COMPONENT_ID)) {
          return true;
        }

        if (targetEntity.hasComponent(GENDER_COMPONENT_ID)) {
          const genderComponent =
            targetEntity.getComponentData?.(GENDER_COMPONENT_ID);
          if (genderComponent?.value) {
            return true;
          }
        }
      }

      const actorComponent =
        targetEntity.getComponentData?.(ACTOR_COMPONENT_ID);
      if (actorComponent) {
        return true;
      }

      const genderData = targetEntity.getComponentData?.(GENDER_COMPONENT_ID);
      return Boolean(genderData?.value);
    } catch (error) {
      if (this.#logger && typeof this.#logger.debug === 'function') {
        this.#logger.debug(
          `Skipping pronoun usage for unresolved target ${targetEntityId}`,
          error
        );
      }
      return false;
    }
  }

  // ============================================================================
  // Pronoun Resolution Methods (Self-Contained!)
  // ============================================================================

  /**
   * Detect entity gender for pronoun resolution.
   *
   * CRITICAL: Self-contained implementation using EntityManager to query core:gender component.
   * NO dependency on AnatomyFormattingService.
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Gender: 'male', 'female', 'neutral', or 'unknown'
   */
  detectEntityGender(entityId) {
    if (!entityId) {
      return 'unknown';
    }

    const cachedGender = this.#cacheManager.get('gender', entityId);
    if (cachedGender) {
      return cachedGender;
    }

    let resolvedGender = 'neutral';

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        resolvedGender = 'unknown';
      } else {
        // Check for explicit gender component via EntityManager
        const genderComponent = entity.getComponentData?.(GENDER_COMPONENT_ID);
        if (genderComponent?.value) {
          resolvedGender = genderComponent.value; // 'male', 'female', 'neutral'
        } else {
          resolvedGender = 'neutral';
        }
      }
    } catch (error) {
      this.#logger.warn(
        `Failed to detect gender for entity ${entityId}`,
        error
      );
      resolvedGender = 'neutral';
    }

    this.#cacheManager.set('gender', entityId, resolvedGender);
    return resolvedGender;
  }

  /**
   * Get pronoun set for entity based on gender.
   *
   * @param {string} gender - Gender value ('male', 'female', 'neutral', 'unknown')
   * @returns {object} Pronoun set with subject, object, possessive, possessivePronoun
   */
  getPronounSet(gender) {
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

  /**
   * Resolve the reflexive pronoun for a given pronoun set.
   *
   * @description Map subject pronouns to their reflexive equivalents for self-targeting activities.
   * @param {object} pronouns - Pronoun set containing subject/object forms.
   * @returns {string} Reflexive pronoun suitable for self-references.
   */
  getReflexivePronoun(pronouns) {
    const subject = pronouns?.subject?.toLowerCase?.() ?? '';

    switch (subject) {
      case 'he':
        return 'himself';
      case 'she':
        return 'herself';
      case 'it':
        return 'itself';
      case 'i':
        return 'myself';
      case 'you':
        return 'yourself';
      case 'we':
        return 'ourselves';
      default:
        return 'themselves';
    }
  }

  // ============================================================================
  // Phrase Generation Methods
  // ============================================================================

  /**
   * Generate a single activity phrase for the actor and optional target.
   *
   * Enhanced with pronoun support for target entities including self-targeting reflexive pronouns.
   *
   * @description Generate an activity phrase and optionally return decomposed components.
   * @param {string} actorRef - Actor name or pronoun
   * @param {object} activity - Activity object
   * @param {boolean} usePronounsForTarget - Whether to use pronouns for target (default: false)
   * @param {object} [options] - Additional generation options
   * @param {boolean} [options.omitActor] - When true, return decomposed phrases for grouping
   * @param {string} [options.actorId] - Actor entity identifier for self-target detection.
   * @param {string} [options.actorName] - Actor display name for fallback references.
   * @param {object} [options.actorPronouns] - Pre-resolved pronoun set for the actor.
   * @param {boolean} [options.preferReflexivePronouns] - Whether self-targets should use reflexive pronouns.
   * @param {boolean} [options.forceReflexivePronoun] - Force reflexive pronoun usage for self-targeting activities.
   * @returns {string|object} Activity phrase or decomposed components when omitActor is true
   */
  generateActivityPhrase(
    actorRef,
    activity,
    usePronounsForTarget = false,
    options = {}
  ) {
    // Handle multi-target activities (e.g., wielding multiple items)
    if (activity.isMultiTarget && Array.isArray(activity.targetEntityIds)) {
      const names = activity.targetEntityIds
        .map((id) => this.resolveEntityName(id))
        .filter((name) => name && name.trim());

      const formattedList = this.#formatListWithConjunction(names, 'and');

      if (activity.template) {
        const rawPhrase = activity.template
          .replace(/\{actor\}/g, actorRef)
          .replace(/\{targets\}/g, formattedList);
        return rawPhrase.trim();
      }

      // Fallback if no template
      return formattedList
        ? `${actorRef} is with ${formattedList}`.trim()
        : actorRef.trim();
    }

    // Single-target handling (existing logic)
    const targetEntityId = activity.targetEntityId || activity.targetId;
    const actorId = options?.actorId ?? null;
    const actorName = options?.actorName ?? null;
    const actorPronouns = options?.actorPronouns ?? null;
    const preferReflexivePronouns = options?.preferReflexivePronouns !== false;
    const forceReflexivePronoun = options?.forceReflexivePronoun === true;

    // Resolve target reference (name or pronoun)
    let targetRef = '';
    if (targetEntityId) {
      const isSelfTarget = actorId && targetEntityId === actorId;

      if (isSelfTarget) {
        const pronounSource =
          actorPronouns ?? this.getPronounSet(this.detectEntityGender(actorId));

        if (
          (usePronounsForTarget || forceReflexivePronoun) &&
          preferReflexivePronouns
        ) {
          targetRef = this.getReflexivePronoun(pronounSource);
        } else if (usePronounsForTarget) {
          targetRef = pronounSource.object;
        } else {
          targetRef =
            actorName && typeof actorName === 'string'
              ? actorName
              : this.resolveEntityName(actorId);
        }
      } else if (
        usePronounsForTarget &&
        this.shouldUsePronounForTarget(targetEntityId)
      ) {
        const targetGender = this.detectEntityGender(targetEntityId);
        const targetPronouns = this.getPronounSet(targetGender);
        const pronounCandidate = targetPronouns?.object;
        targetRef = pronounCandidate
          ? pronounCandidate
          : this.resolveEntityName(targetEntityId);
      } else {
        targetRef = this.resolveEntityName(targetEntityId);
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
   * Formats an array of items as a natural language list with conjunction.
   *
   * @description Formats an array of items as a natural language list with conjunction.
   * Uses Oxford comma for lists of 3+ items (e.g., "a, b, and c").
   * @param {string[]} items - Array of items to format
   * @param {string} [conjunction] - Conjunction to use ('and', 'or')
   * @returns {string} Formatted list, or empty string if items is empty/invalid
   * @example
   * #formatListWithConjunction(['sword'], 'and') // 'sword'
   * #formatListWithConjunction(['sword', 'dagger'], 'and') // 'sword and dagger'
   * #formatListWithConjunction(['sword', 'dagger', 'staff'], 'and') // 'sword, dagger, and staff'
   */
  #formatListWithConjunction(items, conjunction = 'and') {
    if (!Array.isArray(items) || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
  }

  /**
   * Sanitize verb phrases to prevent duplicate copulas when grouping activities.
   *
   * @description Sanitize verb phrases to prevent duplicate copulas when grouping activities.
   * @param {string} phrase - Raw verb phrase with potential leading copula.
   * @returns {string} Cleaned phrase suitable for conjunction usage.
   */
  sanitizeVerbPhrase(phrase) {
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
   * Build the fragment used to connect related activities to the primary activity.
   *
   * @description Build the fragment used to connect related activities to the primary activity.
   * @param {string} conjunction - Conjunction used to join the phrase ("and" or "while").
   * @param {object} phraseComponents - Generated phrase components for the related activity.
   * @param {object} context - Actor context for pronoun and naming logic.
   * @param {string} context.actorName - Resolved actor name.
   * @param {string} context.actorReference - Reference used for the primary activity (name or pronoun).
   * @param {object} context.actorPronouns - Pronoun set for the actor.
   * @param {boolean} context.pronounsEnabled - Whether pronouns are enabled in configuration.
   * @returns {string} Fragment to append to the primary phrase.
   */
  buildRelatedActivityFragment(
    conjunction,
    phraseComponents,
    { actorName, actorReference, actorPronouns, pronounsEnabled }
  ) {
    if (!phraseComponents) {
      return '';
    }

    const rawVerbPhrase = phraseComponents.verbPhrase?.trim() ?? '';
    const sanitizedVerbPhrase = this.sanitizeVerbPhrase(rawVerbPhrase);
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
    }

    const phraseBody = sanitizedVerbPhrase || fallbackPhrase;

    return `${safeConjunction} ${phraseBody}`;
  }

  // ============================================================================
  // Tone Modifier Methods
  // ============================================================================

  /**
   * Merge contextual adverbs without duplicating descriptors.
   *
   * @description Merge contextual adverbs without duplicating descriptors.
   * @param {string} currentAdverb - Existing adverb string.
   * @param {string} injected - Contextual adverb to merge.
   * @returns {string} Merged adverb string.
   */
  mergeAdverb(currentAdverb, injected) {
    const normalizedInjected =
      typeof injected === 'string' ? injected.trim() : '';
    const normalizedCurrent =
      typeof currentAdverb === 'string' ? currentAdverb.trim() : '';

    if (!normalizedInjected) {
      return normalizedCurrent;
    }

    if (!normalizedCurrent) {
      return normalizedInjected;
    }

    const lowerCurrent = normalizedCurrent.toLowerCase();
    if (lowerCurrent.includes(normalizedInjected.toLowerCase())) {
      return normalizedCurrent;
    }

    return `${normalizedCurrent} ${normalizedInjected}`.trim();
  }

  /**
   * Inject contextual descriptors into templates referencing targets.
   *
   * @description Inject contextual descriptors into templates that reference {target}.
   * @param {string} template - Activity template string.
   * @param {string} descriptor - Descriptor to inject (e.g. 'tenderly').
   * @returns {string} Updated template string.
   */
  injectSoftener(template, descriptor) {
    if (!descriptor || typeof template !== 'string') {
      return template;
    }

    const trimmedDescriptor = descriptor.trim();
    if (!trimmedDescriptor) {
      return template;
    }

    if (!template.includes('{target}')) {
      return template;
    }

    const existingDescriptor = `${trimmedDescriptor} {target}`.toLowerCase();
    if (template.toLowerCase().includes(existingDescriptor)) {
      return template;
    }

    return template.replace('{target}', `${trimmedDescriptor} {target}`);
  }

  // ============================================================================
  // Composition Methods
  // ============================================================================

  /**
   * Truncate a composed activity description to avoid UI overflow.
   *
   * @description Trim the supplied description and enforce a configurable maximum length, preferring natural sentence boundaries.
   * @param {string} description - Full activity description to truncate.
   * @param {number} maxLength - Maximum allowed character length.
   * @returns {string} Truncated description respecting the configured limit.
   */
  truncateDescription(description, maxLength = 500) {
    if (typeof description !== 'string') {
      return '';
    }

    const trimmed = description.trim();

    if (!trimmed) {
      return '';
    }

    if (!Number.isFinite(maxLength) || maxLength <= 0) {
      return trimmed;
    }

    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    const lastPeriodIndex = trimmed.lastIndexOf('.', maxLength);

    if (lastPeriodIndex > 0) {
      const sentence = trimmed.slice(0, lastPeriodIndex + 1).trim();
      if (sentence) {
        return sentence;
      }
    }

    const sliceLength = Math.max(0, maxLength - 3);
    return `${trimmed.slice(0, sliceLength).trimEnd()}...`;
  }

  // ============================================================================
  // Test Hooks (White-box testing support)
  // ============================================================================

  /**
   * Provide controlled access to all NLG methods for white-box unit testing.
   *
   * @description Provide controlled access to all NLG methods for white-box unit testing.
   * @returns {object} All public NLG methods bound to the current instance.
   */
  /**
   * Format activity groups into a final description string.
   *
   * This is the main composition method that takes grouped activities and produces
   * a formatted, human-readable description with proper separators and truncation.
   *
   * @param {Array<object>} groups - Activity groups from ActivityGroupingSystem
   * @param {object} [options] - Formatting options
   * @param {string} [options.prefix] - Text to prepend to description
   * @param {string} [options.suffix] - Text to append to description  
   * @param {string} [options.separator] - Separator between activity groups (default: ". ")
   * @param {number} [options.maxLength] - Maximum description length (default: 500)
   * @returns {string} Formatted activity description
   */
  formatActivityDescription(groups, options = {}) {
    if (!Array.isArray(groups) || groups.length === 0) {
      return '';
    }

    const prefix = options.prefix ?? '';
    const suffix = options.suffix ?? '';
    const separator = options.separator ?? '. ';
    const maxLength = options.maxLength ?? 500;

    // Extract descriptions from groups - expecting each group to have a description
    const descriptions = groups
      .map((group) => {
        if (!group) return null;
        // Groups may already be formatted strings, or have a description property
        if (typeof group === 'string') return group;
        return group.description ?? null;
      })
      .filter((desc) => desc && desc.trim());

    if (descriptions.length === 0) {
      return '';
    }

    const activityText = descriptions.join(separator);
    const composedDescription = `${prefix}${activityText}${suffix}`.trim();

    return this.truncateDescription(composedDescription, maxLength);
  }

  getTestHooks() {
    return {
      // Name resolution
      resolveEntityName: (...args) => this.resolveEntityName(...args),
      sanitizeEntityName: (...args) => this.sanitizeEntityName(...args),
      shouldUsePronounForTarget: (...args) =>
        this.shouldUsePronounForTarget(...args),

      // Pronoun resolution
      detectEntityGender: (...args) => this.detectEntityGender(...args),
      getPronounSet: (...args) => this.getPronounSet(...args),
      getReflexivePronoun: (...args) => this.getReflexivePronoun(...args),

      // Phrase generation
      generateActivityPhrase: (...args) => this.generateActivityPhrase(...args),
      sanitizeVerbPhrase: (...args) => this.sanitizeVerbPhrase(...args),
      buildRelatedActivityFragment: (...args) =>
        this.buildRelatedActivityFragment(...args),

      // Tone modifiers
      mergeAdverb: (...args) => this.mergeAdverb(...args),
      injectSoftener: (...args) => this.injectSoftener(...args),

      // Composition
      truncateDescription: (...args) => this.truncateDescription(...args),
    };
  }

  // ============================================================================
  // Private Utility Methods
  // ============================================================================

  /**
   * Escape special characters within a string for safe RegExp usage.
   *
   * @description Escape special characters within a string for safe RegExp usage.
   * @param {string} value - Raw string to escape.
   * @returns {string} Escaped string.
   * @private
   */
  #escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default ActivityNLGSystem;
