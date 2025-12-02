/**
 * @file Main orchestrator for building character XML from ActorPromptDataDTO
 * @description Transforms character data into LLM-optimized XML format with
 * semantic sections, decorated comments for attention priming, and strategic
 * ordering for primacy/recency effects.
 * @see xmlElementBuilder.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { AgeUtils } from '../utils/ageUtils.js';

/** @typedef {import('../types/ILogger.js').ILogger} ILogger */
/** @typedef {import('./xmlElementBuilder.js').default} XmlElementBuilder */

/**
 * Default character name when none provided
 *
 * @type {string}
 */
const DEFAULT_FALLBACK_CHARACTER_NAME = 'Unknown Character';

/**
 * Main orchestrator class that builds complete character XML from character data.
 *
 * Section ordering follows LLM attention optimization:
 * 1. Identity (primacy effect - highest attention)
 * 2. Core Self (background context)
 * 3. Psychology (deep drivers)
 * 4. Traits (reference material)
 * 5. Speech Patterns (immediate use in generation)
 * 6. Current State (recency effect - highest recall)
 */
class CharacterDataXmlBuilder {
  /** @type {ILogger} */
  #logger;

  /** @type {XmlElementBuilder} */
  #xmlBuilder;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {XmlElementBuilder} dependencies.xmlElementBuilder - XML element builder utility
   */
  constructor({ logger, xmlElementBuilder }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(xmlElementBuilder, 'XmlElementBuilder', console, {
      requiredMethods: ['escape', 'wrap', 'wrapIfPresent', 'comment', 'decoratedComment'],
    });

    this.#logger = logger;
    this.#xmlBuilder = xmlElementBuilder;

    this.#logger.debug('CharacterDataXmlBuilder initialized');
  }

  /**
   * Main entry point - builds complete character XML
   *
   * @param {object} characterData - Character data (ActorPromptDataDTO with optional extended fields)
   * @returns {string} Complete XML string with decorated comments and semantic sections
   * @throws {TypeError} If characterData is null or undefined
   */
  buildCharacterDataXml(characterData) {
    if (characterData === null || characterData === undefined) {
      throw new TypeError('characterData is required and cannot be null or undefined');
    }

    if (typeof characterData !== 'object') {
      throw new TypeError('characterData must be an object');
    }

    this.#logger.debug('CharacterDataXmlBuilder: Building character XML', {
      hasName: !!characterData.name,
      hasDescription: !!characterData.description,
    });

    const parts = [];

    // Root opening tag
    parts.push('<character_data>');

    // Identity priming comment (primacy effect)
    parts.push(this.#buildIdentityPrimingComment());

    // Section 1: Identity
    const identitySection = this.#buildIdentitySection(characterData);
    parts.push('');
    parts.push(this.#buildSectionComment(1, 'ESSENTIAL IDENTITY', 'WHO YOU ARE', 'These define your fundamental self - read and internalize deeply.'));
    parts.push(identitySection);

    // Section 2: Core Self
    const coreSelfSection = this.#buildCoreSelfSection(characterData);
    if (coreSelfSection) {
      parts.push('');
      parts.push(this.#buildSectionComment(2, 'CORE SELF', 'YOUR HISTORY AND PERSONALITY', 'This is your background and how you approach the world.'));
      parts.push(coreSelfSection);
    }

    // Section 3: Psychology
    const psychologySection = this.#buildPsychologySection(characterData);
    if (psychologySection) {
      parts.push('');
      parts.push(this.#buildSectionComment(3, 'PSYCHOLOGY', 'YOUR INNER DEPTHS', 'These drive your actions even when you don\'t realize it.'));
      parts.push(psychologySection);
    }

    // Section 4: Traits
    const traitsSection = this.#buildTraitsSection(characterData);
    if (traitsSection) {
      parts.push('');
      parts.push(this.#buildSectionComment(4, 'CHARACTER TRAITS', 'YOUR QUALITIES', 'Observable patterns in how you engage with the world.'));
      parts.push(traitsSection);
    }

    // Section 5: Speech Patterns
    const speechSection = this.#buildSpeechPatternsSection(characterData.speechPatterns);
    if (speechSection) {
      parts.push('');
      parts.push(this.#buildSectionComment(5, 'EXPRESSION', 'HOW YOU COMMUNICATE', 'Use these patterns naturally in dialogue - don\'t force every one.'));
      parts.push(speechSection);
    }

    // Section 6: Current State (recency effect)
    const currentStateSection = this.#buildCurrentStateSection(characterData);
    if (currentStateSection) {
      parts.push('');
      parts.push(this.#buildSectionComment(6, 'CURRENT STATE', 'MUTABLE CONTEXT', 'These change over time - your active mental state.'));
      parts.push(currentStateSection);
    }

    // Root closing tag
    parts.push('</character_data>');

    const result = parts.join('\n');

    this.#logger.debug('CharacterDataXmlBuilder: Successfully built character XML', {
      length: result.length,
    });

    return result;
  }

  /**
   * Builds the identity priming comment with heavy visual decoration
   *
   * @returns {string} Decorated comment block
   */
  #buildIdentityPrimingComment() {
    return this.#xmlBuilder.decoratedComment(
      [
        'THIS IS YOUR IDENTITY. Every thought, action, and word stems from this.',
        'Embody this character completely. You ARE this person.',
      ],
      'primary',
      1
    );
  }

  /**
   * Builds a section introduction comment
   *
   * @param {number} number - Section number
   * @param {string} name - Section name in caps
   * @param {string} shortPhrase - Brief parenthetical description
   * @param {string} hint - Behavioral guidance
   * @returns {string} Formatted section comment
   */
  #buildSectionComment(number, name, shortPhrase, hint) {
    return this.#xmlBuilder.decoratedComment(
      [
        `SECTION ${number}: ${name} (${shortPhrase})`,
        hint,
      ],
      'secondary',
      1
    );
  }

  /**
   * Builds the identity section with name, age, and description
   *
   * @param {object} data - Character data
   * @returns {string} Identity section XML or empty string
   */
  #buildIdentitySection(data) {
    const name = data.name || DEFAULT_FALLBACK_CHARACTER_NAME;
    const nameXml = this.#xmlBuilder.wrap('name', this.#xmlBuilder.escape(name), 2);

    const elements = [nameXml];

    // Apparent age
    if (data.apparentAge) {
      const ageDescription = this.#formatApparentAge(data.apparentAge);
      if (ageDescription) {
        elements.push(this.#xmlBuilder.wrap('apparent_age', this.#xmlBuilder.escape(ageDescription), 2));
      }
    }

    // Description
    if (data.description && String(data.description).trim()) {
      elements.push(this.#xmlBuilder.wrap('description', this.#xmlBuilder.escape(data.description), 2));
    }

    return this.#wrapSection('identity', elements);
  }

  /**
   * Formats apparent age data into human-readable string
   *
   * @param {object|string} ageData - Age data (object with minAge/maxAge or string)
   * @returns {string} Formatted age description
   */
  #formatApparentAge(ageData) {
    // Handle string format directly
    if (typeof ageData === 'string') {
      return ageData.trim() || '';
    }

    // Use AgeUtils for object format
    if (typeof ageData === 'object' && ageData !== null) {
      return AgeUtils.formatAgeDescription(ageData);
    }

    return '';
  }

  /**
   * Builds the core_self section with profile and personality
   *
   * @param {object} data - Character data
   * @returns {string} Core self section XML or empty string
   */
  #buildCoreSelfSection(data) {
    const elements = [];

    if (data.profile && String(data.profile).trim()) {
      elements.push(this.#xmlBuilder.wrap('profile', this.#xmlBuilder.escape(data.profile), 2));
    }

    if (data.personality && String(data.personality).trim()) {
      elements.push(this.#xmlBuilder.wrap('personality', this.#xmlBuilder.escape(data.personality), 2));
    }

    if (elements.length === 0) {
      return '';
    }

    return this.#wrapSection('core_self', elements);
  }

  /**
   * Builds the psychology section with motivations, tensions, and dilemmas
   *
   * @param {object} data - Character data
   * @returns {string} Psychology section XML or empty string
   */
  #buildPsychologySection(data) {
    const elements = [];

    if (data.motivations && String(data.motivations).trim()) {
      elements.push(this.#xmlBuilder.wrap('core_motivations', this.#xmlBuilder.escape(data.motivations), 2));
    }

    if (data.internalTensions && String(data.internalTensions).trim()) {
      elements.push(this.#xmlBuilder.wrap('internal_tensions', this.#xmlBuilder.escape(data.internalTensions), 2));
    }

    if (data.coreDilemmas && String(data.coreDilemmas).trim()) {
      elements.push(this.#xmlBuilder.wrap('dilemmas', this.#xmlBuilder.escape(data.coreDilemmas), 2));
    }

    if (elements.length === 0) {
      return '';
    }

    return this.#wrapSection('psychology', elements);
  }

  /**
   * Builds the traits section with strengths, weaknesses, likes, dislikes, fears, secrets
   *
   * @param {object} data - Character data
   * @returns {string} Traits section XML or empty string
   */
  #buildTraitsSection(data) {
    const traitFields = [
      { key: 'strengths', tag: 'strengths' },
      { key: 'weaknesses', tag: 'weaknesses' },
      { key: 'likes', tag: 'likes' },
      { key: 'dislikes', tag: 'dislikes' },
      { key: 'fears', tag: 'fears' },
      { key: 'secrets', tag: 'secrets' },
    ];

    const elements = [];

    for (const { key, tag } of traitFields) {
      const value = data[key];
      if (value && String(value).trim()) {
        elements.push(this.#xmlBuilder.wrap(tag, this.#xmlBuilder.escape(value), 2));
      }
    }

    if (elements.length === 0) {
      return '';
    }

    return this.#wrapSection('traits', elements);
  }

  /**
   * Builds the speech patterns section
   *
   * @param {Array|null|undefined} patterns - Speech patterns array
   * @returns {string} Speech patterns section XML or empty string
   */
  #buildSpeechPatternsSection(patterns) {
    if (!patterns || !Array.isArray(patterns)) {
      return '';
    }

    const format = this.#detectPatternFormat(patterns);
    let content;

    switch (format) {
      case 'object':
        content = this.#formatStructuredPatterns(patterns);
        break;
      case 'mixed':
        content = this.#formatMixedPatterns(patterns);
        break;
      case 'string':
      default:
        content = this.#formatLegacyPatterns(patterns);
        break;
    }

    if (!content) {
      return '';
    }

    // Add enhanced usage guidance with anti-rigidity reminders
    const guidance = [
      this.#xmlBuilder.comment('REFERENCE: Use these patterns naturally, not mechanically', 2),
      this.#xmlBuilder.comment('USAGE GUIDANCE:', 2),
      this.#xmlBuilder.comment('- Apply patterns when appropriate to situation and emotion', 2),
      this.#xmlBuilder.comment('- DO NOT cycle through patterns mechanically', 2),
      this.#xmlBuilder.comment('- Absence of patterns is also authentic', 2)
    ].join('\n');

    return `  <speech_patterns>\n${guidance}\n\n${content}\n  </speech_patterns>`;
  }

  /**
   * Detects the format of speech patterns array
   *
   * @param {Array} patterns - Array of patterns
   * @returns {'string'|'object'|'mixed'} Detected format type
   */
  #detectPatternFormat(patterns) {
    const hasStrings = patterns.some((p) => typeof p === 'string');
    const hasObjects = patterns.some((p) => typeof p === 'object' && p !== null);

    if (hasStrings && hasObjects) {
      this.#logger.warn('CharacterDataXmlBuilder: Mixed speech pattern formats detected');
      return 'mixed';
    }

    return hasObjects ? 'object' : 'string';
  }

  /**
   * Formats structured (object) speech patterns
   *
   * @param {Array} patterns - Array of pattern objects
   * @returns {string} Formatted patterns content
   */
  #formatStructuredPatterns(patterns) {
    const objectPatterns = patterns.filter((p) => typeof p === 'object' && p !== null);

    const lines = [];

    objectPatterns.forEach((pattern, index) => {
      lines.push(`    ${index + 1}. **${this.#xmlBuilder.escape(pattern.type || 'Pattern')}**`);

      if (pattern.contexts && Array.isArray(pattern.contexts) && pattern.contexts.length > 0) {
        const contextsStr = pattern.contexts.map((c) => this.#xmlBuilder.escape(c)).join(', ');
        lines.push(`       Contexts: ${contextsStr}`);
      }

      if (pattern.examples && Array.isArray(pattern.examples) && pattern.examples.length > 0) {
        lines.push('       Examples:');
        pattern.examples.forEach((example) => {
          lines.push(`       - "${this.#xmlBuilder.escape(example)}"`);
        });
      }

      if (index < objectPatterns.length - 1) {
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * Formats legacy (string) speech patterns
   *
   * @param {Array} patterns - Array of string patterns
   * @returns {string} Formatted patterns content
   */
  #formatLegacyPatterns(patterns) {
    const stringPatterns = patterns
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .map((p) => `    - ${this.#xmlBuilder.escape(p.trim())}`);

    if (stringPatterns.length === 0) {
      return '';
    }

    return stringPatterns.join('\n');
  }

  /**
   * Formats mixed (object + string) speech patterns
   *
   * @param {Array} patterns - Array of mixed pattern types
   * @returns {string} Formatted patterns content
   */
  #formatMixedPatterns(patterns) {
    const lines = [];

    // Structured patterns first
    const objectPatterns = patterns.filter((p) => typeof p === 'object' && p !== null);
    objectPatterns.forEach((pattern, index) => {
      lines.push(`    ${index + 1}. **${this.#xmlBuilder.escape(pattern.type || 'Pattern')}**`);

      if (pattern.contexts && Array.isArray(pattern.contexts) && pattern.contexts.length > 0) {
        const contextsStr = pattern.contexts.map((c) => this.#xmlBuilder.escape(c)).join(', ');
        lines.push(`       Contexts: ${contextsStr}`);
      }

      if (pattern.examples && Array.isArray(pattern.examples) && pattern.examples.length > 0) {
        lines.push('       Examples:');
        pattern.examples.forEach((example) => {
          lines.push(`       - "${this.#xmlBuilder.escape(example)}"`);
        });
      }

      lines.push('');
    });

    // Additional legacy patterns
    const stringPatterns = patterns.filter((p) => typeof p === 'string' && p.trim().length > 0);
    if (stringPatterns.length > 0) {
      lines.push('    Additional Patterns:');
      stringPatterns.forEach((pattern) => {
        lines.push(`    - ${this.#xmlBuilder.escape(pattern.trim())}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Builds the current state section with physical condition, goals, notes, and recent thoughts.
   * Physical condition is placed first for prominence per spec section 8.3.
   *
   * @param {object} data - Character data
   * @returns {string} Current state section XML or empty string
   */
  #buildCurrentStateSection(data) {
    const elements = [];

    // Physical condition (placed first for prominence per spec)
    const physicalConditionContent = this.#buildPhysicalConditionSection(data.healthState);
    if (physicalConditionContent) {
      elements.push(physicalConditionContent);
    }

    // Goals
    const goalsContent = this.#formatGoalsList(data.goals);
    if (goalsContent) {
      elements.push(this.#xmlBuilder.wrap('goals', '\n' + goalsContent + '\n    ', 2));
    }

    // Notes
    const notesContent = this.#formatNotesList(data.notes);
    if (notesContent) {
      elements.push(this.#xmlBuilder.wrap('notes', '\n' + notesContent + '\n    ', 2));
    }

    // Recent thoughts
    const thoughtsContent = this.#formatRecentThoughts(data.shortTermMemory);
    if (thoughtsContent) {
      elements.push(this.#xmlBuilder.wrap('recent_thoughts', '\n' + thoughtsContent + '\n    ', 2));
    }

    if (elements.length === 0) {
      return '';
    }

    return this.#wrapSection('current_state', elements);
  }

  /**
   * Formats goals array into bullet list
   *
   * @param {Array|null|undefined} goals - Goals array
   * @returns {string} Formatted goals content or empty string
   */
  #formatGoalsList(goals) {
    if (!goals || !Array.isArray(goals) || goals.length === 0) {
      return '';
    }

    const lines = goals
      .filter((goal) => {
        if (typeof goal === 'string') {
          return goal.trim().length > 0;
        }
        if (typeof goal === 'object' && goal !== null) {
          return goal.text && String(goal.text).trim().length > 0;
        }
        return false;
      })
      .map((goal) => {
        const text = typeof goal === 'string' ? goal : goal.text;
        return `      - ${this.#xmlBuilder.escape(text.trim())}`;
      });

    return lines.length > 0 ? lines.join('\n') : '';
  }

  /**
   * Formats notes array with subject type prefixes
   *
   * @param {Array|null|undefined} notes - Notes array
   * @returns {string} Formatted notes content or empty string
   */
  #formatNotesList(notes) {
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return '';
    }

    const lines = notes
      .filter((note) => note && note.text && String(note.text).trim().length > 0)
      .map((note) => {
        const text = String(note.text).trim();
        const subject = note.subject || 'General';
        const subjectType = note.subjectType || 'other';

        // Format: [SubjectType: subject] text
        const capitalizedType = subjectType.charAt(0).toUpperCase() + subjectType.slice(1);
        return `      - [${capitalizedType}: ${this.#xmlBuilder.escape(subject)}] ${this.#xmlBuilder.escape(text)}`;
      });

    return lines.length > 0 ? lines.join('\n') : '';
  }

  /**
   * Formats recent thoughts from short-term memory
   *
   * @param {object|null|undefined} shortTermMemory - Short-term memory object with thoughts array
   * @returns {string} Formatted thoughts content or empty string
   */
  #formatRecentThoughts(shortTermMemory) {
    if (!shortTermMemory || !shortTermMemory.thoughts || !Array.isArray(shortTermMemory.thoughts)) {
      return '';
    }

    const lines = shortTermMemory.thoughts
      .filter((thought) => thought && thought.text && String(thought.text).trim().length > 0)
      .map((thought) => {
        const text = String(thought.text).trim();
        return `      - "${this.#xmlBuilder.escape(text)}"`;
      });

    return lines.length > 0 ? lines.join('\n') : '';
  }

  /**
   * Wraps child elements in a section tag
   *
   * @param {string} sectionName - Section tag name
   * @param {string[]} elements - Array of child XML elements
   * @returns {string} Section XML
   */
  #wrapSection(sectionName, elements) {
    const indent = '  ';
    return `${indent}<${sectionName}>\n${elements.join('\n')}\n${indent}</${sectionName}>`;
  }

  // ========================================================================
  // Physical Condition Section (INJREPANDUSEINT-012)
  // ========================================================================

  /**
   * Builds the physical condition section for injured characters.
   * Returns empty string for healthy characters (null healthState) to optimize tokens.
   *
   * @param {object|null} healthState - ActorHealthStateDTO or null
   * @returns {string} Physical condition section XML or empty string
   */
  #buildPhysicalConditionSection(healthState) {
    if (!healthState) {
      return '';
    }

    const parts = [];

    // Overall status with percentage
    const statusText = this.#getOverallStatusText(healthState.overallStatus);
    parts.push(
      this.#xmlBuilder.wrap(
        'overall_status',
        `${this.#xmlBuilder.escape(statusText)} (${healthState.overallHealthPercentage}%)`,
        2
      )
    );

    // Injuries list
    if (healthState.injuries && healthState.injuries.length > 0) {
      const injuryLines = healthState.injuries.map((injury) => {
        const effectsStr =
          injury.effects && injury.effects.length > 0
            ? this.#xmlBuilder.escape(injury.effects.join(', '))
            : '';
        const partAttr = this.#xmlBuilder.escape(injury.partName);
        return `      <injury part="${partAttr}" state="${injury.state}">${effectsStr}</injury>`;
      });
      parts.push(`    <injuries>\n${injuryLines.join('\n')}\n    </injuries>`);
    }

    // Active effects summary
    if (healthState.activeEffects && healthState.activeEffects.length > 0) {
      parts.push(
        this.#xmlBuilder.wrap(
          'active_effects',
          this.#xmlBuilder.escape(healthState.activeEffects.join(', ')),
          2
        )
      );
    }

    // Critical warning
    if (healthState.isDying) {
      parts.push(
        this.#xmlBuilder.wrap(
          'critical_warning',
          `You are dying! ${healthState.turnsUntilDeath} turns until death.`,
          2
        )
      );
    } else if (healthState.overallStatus === 'critical') {
      parts.push(
        this.#xmlBuilder.wrap(
          'critical_warning',
          'You are critically injured and may die soon.',
          2
        )
      );
    }

    // First-person narrative experience
    if (healthState.firstPersonNarrative) {
      parts.push(
        this.#xmlBuilder.wrap(
          'first_person_experience',
          this.#xmlBuilder.escape(healthState.firstPersonNarrative),
          2
        )
      );
    }

    return this.#wrapSection('physical_condition', parts);
  }

  /**
   * Maps overall status code to human-readable first-person text per spec section 8.3.
   *
   * @param {string} status - Status code (healthy, scratched, wounded, injured, critical, dying, dead)
   * @returns {string} Human-readable status text
   */
  #getOverallStatusText(status) {
    const statusMap = {
      healthy: 'You feel fine',
      scratched: 'You have minor scratches',
      wounded: 'You are wounded',
      injured: 'You are seriously injured',
      critical: 'You are critically injured',
      dying: 'You are dying',
      dead: 'You are dead',
    };
    return statusMap[status] || `Unknown status`;
  }
}

export default CharacterDataXmlBuilder;
