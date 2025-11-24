/**
 * @file Character Data Formatter Service
 * @description Transforms character component data into markdown-structured format
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { validateDependency } from '../utils/dependencyUtils.js';
import { DEFAULT_FALLBACK_CHARACTER_NAME } from '../constants/textDefaults.js';
import { AgeUtils } from '../utils/ageUtils.js';

/**
 * @class CharacterDataFormatter
 * @description Formats character data into markdown-structured character persona content
 */
export class CharacterDataFormatter {
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('CharacterDataFormatter initialized');
  }

  /**
   * Capitalizes the first letter of a string
   *
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  #capitalizeFirst(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Format section header by capitalizing first letter
   *
   * @param {string} sectionName - Name of the section
   * @returns {string} Formatted section header
   */
  #formatSectionHeader(sectionName) {
    return this.#capitalizeFirst(sectionName);
  }

  /**
   * Detects speech pattern format type
   *
   * @private
   * @param {Array} patterns - Array of patterns
   * @returns {'string'|'object'|'mixed'} Detected format
   */
  #detectPatternFormat(patterns) {
    if (!patterns || patterns.length === 0) {
      return 'string'; // Default to legacy for empty arrays
    }

    const hasStrings = patterns.some(p => typeof p === 'string');
    const hasObjects = patterns.some(p => typeof p === 'object' && p !== null);

    if (hasStrings && hasObjects) {
      this.#logger.warn('Mixed speech pattern formats detected. Consider consolidating to structured format.');
      return 'mixed';
    }

    return hasObjects ? 'object' : 'string';
  }

  /**
   * Extract speech patterns from text format (legacy support)
   *
   * @param {string} speechText - Text containing speech patterns
   * @returns {string[]} Array of extracted patterns
   */
  #extractSpeechPatterns(speechText) {
    if (!speechText || typeof speechText !== 'string') return [];

    // Split by common delimiters and clean up
    const patterns = speechText
      .split(/[-•\n]/)
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern.length > 0);

    return patterns;
  }

  /**
   * Parse physical description attributes from description text
   *
   * @param {string} description - Raw description text
   * @returns {Object<string, string>} Parsed attributes map
   */
  #parseDescriptionAttributes(description) {
    if (!description || typeof description !== 'string') return {};

    const attributes = {};

    // Split by common delimiters (semicolons, newlines) but preserve pipes in clothing
    const parts = description.split(/[;\n]/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (key && value) {
          attributes[key] = value;
        }
      }
    }

    return attributes;
  }

  /**
   * Format physical description with markdown structure
   *
   * @param {object} characterData - Character component data containing description
   * @returns {string} Markdown formatted description section
   */
  formatPhysicalDescription(characterData) {
    if (!characterData || !characterData.description) {
      this.#logger.debug(
        'CharacterDataFormatter: No description data provided'
      );
      return '';
    }

    const description = characterData.description;
    let result = '## Your Description\n';

    // Add apparent age first if available
    if (characterData.apparentAge) {
      const ageDescription = AgeUtils.formatAgeDescription(
        characterData.apparentAge
      );
      result += `**Apparent age**: ${ageDescription}\n\n`;
    }

    // Handle both structured object and text descriptions
    if (typeof description === 'object') {
      // Direct attribute object
      Object.entries(description).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          const formattedKey = this.#capitalizeFirst(key);
          result += `**${formattedKey}**: ${value}\n`;
        }
      });
    } else if (typeof description === 'string') {
      // Parse text-based description
      const attributes = this.#parseDescriptionAttributes(description);

      if (Object.keys(attributes).length > 0) {
        // Use parsed attributes
        Object.entries(attributes).forEach(([key, value]) => {
          const formattedKey = this.#capitalizeFirst(key);
          result += `**${formattedKey}**: ${value}\n`;
        });
      } else {
        // Fallback: treat entire description as general description
        result += `**Description**: ${description}\n`;
      }
    }

    this.#logger.debug(
      'CharacterDataFormatter: Formatted physical description section'
    );
    return result;
  }

  /**
   * Format personality section with proper markdown headers
   *
   * @param {string} personalityText - Personality description
   * @returns {string} Markdown formatted personality section
   */
  formatPersonalitySection(personalityText) {
    if (!personalityText || typeof personalityText !== 'string') {
      this.#logger.debug(
        'CharacterDataFormatter: No personality text provided'
      );
      return '';
    }

    const trimmedText = personalityText.trim();
    if (trimmedText.length === 0) {
      this.#logger.debug(
        'CharacterDataFormatter: Empty personality text after trimming'
      );
      return '';
    }

    const result = `## Your Personality\n${trimmedText}\n`;
    this.#logger.debug('CharacterDataFormatter: Formatted personality section');
    return result;
  }

  /**
   * Format profile/background section
   *
   * @param {string} profileText - Profile description
   * @returns {string} Markdown formatted profile section
   */
  formatProfileSection(profileText) {
    if (!profileText || typeof profileText !== 'string') {
      this.#logger.debug('CharacterDataFormatter: No profile text provided');
      return '';
    }

    const trimmedText = profileText.trim();
    if (trimmedText.length === 0) {
      this.#logger.debug(
        'CharacterDataFormatter: Empty profile text after trimming'
      );
      return '';
    }

    const result = `## Your Profile\n${trimmedText}\n`;
    this.#logger.debug('CharacterDataFormatter: Formatted profile section');
    return result;
  }

  /**
   * Get usage guidance text for speech patterns
   *
   * @private
   * @returns {string} Usage guidance in XML comment format
   */
  #getUsageGuidance() {
    return `<!-- Use these patterns naturally in conversation. Don't force every pattern into every response. -->`;
  }

  /**
   * Format structured (object) speech patterns
   *
   * @private
   * @param {Array} patterns - Array of pattern objects
   * @returns {string} XML formatted structured patterns
   */
  #formatStructuredPatterns(patterns) {
    const objectPatterns = patterns.filter(p => typeof p === 'object' && p !== null);

    if (objectPatterns.length === 0) {
      return '';
    }

    let result = '<speech_patterns>\n';
    result += this.#getUsageGuidance() + '\n\n';

    objectPatterns.forEach((pattern, index) => {
      result += `${index + 1}. **${pattern.type}**\n`;

      if (pattern.contexts && Array.isArray(pattern.contexts) && pattern.contexts.length > 0) {
        result += `   Contexts: ${pattern.contexts.join(', ')}\n`;
      }

      if (pattern.examples && Array.isArray(pattern.examples)) {
        result += `   Examples:\n`;
        pattern.examples.forEach(example => {
          result += `   - "${example}"\n`;
        });
      }

      if (index < objectPatterns.length - 1) {
        result += '\n';
      }
    });

    result += '</speech_patterns>';
    return result;
  }

  /**
   * Format legacy (string) speech patterns
   *
   * @private
   * @param {Array} patterns - Array of string patterns
   * @returns {string} XML formatted legacy patterns
   */
  #formatLegacyPatterns(patterns) {
    const stringPatterns = patterns.filter(p => typeof p === 'string' && p.trim().length > 0);

    if (stringPatterns.length === 0) {
      return '';
    }

    let result = '<speech_patterns>\n';
    result += this.#getUsageGuidance() + '\n\n';

    stringPatterns.forEach(pattern => {
      result += `- ${pattern.trim()}\n`;
    });

    result += '</speech_patterns>';
    return result;
  }

  /**
   * Format mixed (object + string) speech patterns
   *
   * @private
   * @param {Array} patterns - Array of mixed pattern types
   * @returns {string} XML formatted mixed patterns
   */
  #formatMixedPatterns(patterns) {
    const objectPatterns = patterns.filter(p => typeof p === 'object' && p !== null);
    const stringPatterns = patterns.filter(p => typeof p === 'string' && p.trim().length > 0);

    let result = '<speech_patterns>\n';
    result += this.#getUsageGuidance() + '\n\n';

    // Structured patterns first
    objectPatterns.forEach((pattern, index) => {
      result += `${index + 1}. **${pattern.type}**\n`;

      if (pattern.contexts && Array.isArray(pattern.contexts) && pattern.contexts.length > 0) {
        result += `   Contexts: ${pattern.contexts.join(', ')}\n`;
      }

      if (pattern.examples && Array.isArray(pattern.examples)) {
        result += `   Examples:\n`;
        pattern.examples.forEach(example => {
          result += `   - "${example}"\n`;
        });
      }

      result += '\n';
    });

    // Additional legacy patterns
    if (stringPatterns.length > 0) {
      result += 'Additional Patterns:\n';
      stringPatterns.forEach(pattern => {
        result += `- ${pattern.trim()}\n`;
      });
    }

    result += '</speech_patterns>';
    return result;
  }

  /**
   * Format speech patterns based on detected format type
   *
   * @param {Array|string|object} speechPatterns - Speech pattern data (array/string) or entity object
   * @returns {string} XML formatted speech patterns section
   */
  formatSpeechPatterns(speechPatterns) {
    // Handle both direct patterns array and entity object for backward compatibility
    let patterns;
    if (speechPatterns && typeof speechPatterns.getComponent === 'function') {
      // Entity object provided (new behavior for future use)
      patterns = speechPatterns.getComponent('core:speech_patterns')?.patterns;
    } else if (Array.isArray(speechPatterns)) {
      // Direct patterns array (existing behavior)
      patterns = speechPatterns;
    } else if (typeof speechPatterns === 'string') {
      // Legacy text format (existing behavior)
      patterns = this.#extractSpeechPatterns(speechPatterns);
    } else {
      patterns = null;
    }

    if (!patterns || patterns.length === 0) {
      return '';
    }

    const format = this.#detectPatternFormat(patterns);

    switch (format) {
      case 'object':
        return this.#formatStructuredPatterns(patterns);
      case 'mixed':
        return this.#formatMixedPatterns(patterns);
      case 'string':
      default:
        return this.#formatLegacyPatterns(patterns);
    }
  }

  /**
   * Format optional sections (likes, dislikes, secrets, fears)
   *
   * @param {string} sectionName - Name of the section
   * @param {string} content - Section content
   * @returns {string} Markdown formatted section
   */
  formatOptionalSection(sectionName, content) {
    if (!content || typeof content !== 'string') {
      this.#logger.debug(
        `CharacterDataFormatter: No content provided for ${sectionName} section`
      );
      return '';
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      this.#logger.debug(
        `CharacterDataFormatter: Empty content for ${sectionName} section after trimming`
      );
      return '';
    }

    const headerName = this.#formatSectionHeader(sectionName);
    const result = `## Your ${headerName}\n${trimmedContent}\n`;
    this.#logger.debug(
      `CharacterDataFormatter: Formatted ${sectionName} section`
    );
    return result;
  }

  /**
   * Format motivations section
   *
   * @param {string} motivationsText - Core psychological motivations
   * @returns {string} Markdown formatted motivations section
   */
  formatMotivationsSection(motivationsText) {
    if (!motivationsText || typeof motivationsText !== 'string') {
      this.#logger.debug('CharacterDataFormatter: No motivations text provided');
      return '';
    }

    const trimmedText = motivationsText.trim();
    if (trimmedText.length === 0) {
      this.#logger.debug('CharacterDataFormatter: Empty motivations text after trimming');
      return '';
    }

    const result = `## Your Core Motivations
${trimmedText}
`;
    this.#logger.debug('CharacterDataFormatter: Formatted motivations section', {
      textLength: trimmedText.length
    });
    return result;
  }

  /**
   * Format internal tensions section
   *
   * @param {string} tensionsText - Internal conflicts and competing desires
   * @returns {string} Markdown formatted tensions section
   */
  formatInternalTensionsSection(tensionsText) {
    if (!tensionsText || typeof tensionsText !== 'string') {
      this.#logger.debug('CharacterDataFormatter: No internal tensions text provided');
      return '';
    }

    const trimmedText = tensionsText.trim();
    if (trimmedText.length === 0) {
      this.#logger.debug('CharacterDataFormatter: Empty tensions text after trimming');
      return '';
    }

    const result = `## Your Internal Tensions
${trimmedText}
`;
    this.#logger.debug('CharacterDataFormatter: Formatted internal tensions section', {
      textLength: trimmedText.length
    });
    return result;
  }

  /**
   * Format core dilemmas section
   *
   * @param {string} dilemmasText - Fundamental questions the character grapples with
   * @returns {string} Markdown formatted dilemmas section
   */
  formatCoreDilemmasSection(dilemmasText) {
    if (!dilemmasText || typeof dilemmasText !== 'string') {
      this.#logger.debug('CharacterDataFormatter: No core dilemmas text provided');
      return '';
    }

    const trimmedText = dilemmasText.trim();
    if (trimmedText.length === 0) {
      this.#logger.debug('CharacterDataFormatter: Empty dilemmas text after trimming');
      return '';
    }

    const result = `## Your Core Dilemmas
${trimmedText}
`;
    this.#logger.debug('CharacterDataFormatter: Formatted core dilemmas section', {
      textLength: trimmedText.length
    });
    return result;
  }

  /**
   * Main formatting method that assembles complete character persona
   *
   * @param {object} characterData - Complete character data from actorPromptData
   * @returns {string} Complete markdown formatted character persona
   */
  formatCharacterPersona(characterData) {
    if (!characterData || typeof characterData !== 'object') {
      this.#logger.warn(
        'CharacterDataFormatter: Invalid character data provided to formatCharacterPersona'
      );
      return '';
    }

    const {
      name,
      description,
      personality,
      profile,
      likes,
      dislikes,
      strengths,
      weaknesses,
      secrets,
      fears,
      speechPatterns,
      motivations,
      internalTensions,
      coreDilemmas,
    } = characterData;

    let result = '';

    // Add character identity header
    const characterName = name || DEFAULT_FALLBACK_CHARACTER_NAME;
    result += `YOU ARE ${characterName}.\n`;
    result += `This is your identity. All thoughts, actions, and words must stem from this core truth.\n\n`;

    // Add each section if data exists
    const descriptionSection = this.formatPhysicalDescription(characterData);
    if (descriptionSection) {
      result += descriptionSection + '\n';
    }

    const personalitySection = this.formatPersonalitySection(personality);
    if (personalitySection) {
      result += personalitySection + '\n';
    }

    const profileSection = this.formatProfileSection(profile);
    if (profileSection) {
      result += profileSection + '\n';
    }

    // Psychological components (place after profile, before likes)
    const motivationsSection = this.formatMotivationsSection(motivations);
    if (motivationsSection) {
      result += motivationsSection + '\n';
    }

    const tensionsSection = this.formatInternalTensionsSection(internalTensions);
    if (tensionsSection) {
      result += tensionsSection + '\n';
    }

    const dilemmasSection = this.formatCoreDilemmasSection(coreDilemmas);
    if (dilemmasSection) {
      result += dilemmasSection + '\n';
    }

    const likesSection = this.formatOptionalSection('Likes', likes);
    if (likesSection) {
      result += likesSection + '\n';
    }

    const dislikesSection = this.formatOptionalSection('Dislikes', dislikes);
    if (dislikesSection) {
      result += dislikesSection + '\n';
    }

    const strengthsSection = this.formatOptionalSection('Strengths', strengths);
    if (strengthsSection) {
      result += strengthsSection + '\n';
    }

    const weaknessesSection = this.formatOptionalSection(
      'Weaknesses',
      weaknesses
    );
    if (weaknessesSection) {
      result += weaknessesSection + '\n';
    }

    const secretsSection = this.formatOptionalSection('Secrets', secrets);
    if (secretsSection) {
      result += secretsSection + '\n';
    }

    const fearsSection = this.formatOptionalSection('Fears', fears);
    if (fearsSection) {
      result += fearsSection + '\n';
    }

    const speechSection = this.formatSpeechPatterns(speechPatterns);
    if (speechSection) {
      result += speechSection;
    }

    const trimmedResult = result.trim();
    this.#logger.debug(
      'CharacterDataFormatter: Successfully formatted complete character persona'
    );
    return trimmedResult;
  }
}

export default CharacterDataFormatter;
