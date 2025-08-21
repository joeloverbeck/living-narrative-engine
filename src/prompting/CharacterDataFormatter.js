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
   * Format speech patterns as markdown list
   *
   * @param {Array|string} speechPatterns - Speech pattern data
   * @returns {string} Markdown formatted speech patterns section
   */
  formatSpeechPatterns(speechPatterns) {
    if (!speechPatterns) {
      this.#logger.debug('CharacterDataFormatter: No speech patterns provided');
      return '';
    }

    let result = '## Your Speech Patterns\n';

    if (Array.isArray(speechPatterns)) {
      speechPatterns.forEach((pattern) => {
        if (pattern && typeof pattern === 'string') {
          result += `- ${pattern.trim()}\n`;
        }
      });
    } else if (typeof speechPatterns === 'string') {
      // Handle existing format where patterns might be in text
      const patterns = this.#extractSpeechPatterns(speechPatterns);
      patterns.forEach((pattern) => {
        result += `- ${pattern}\n`;
      });
    }

    this.#logger.debug(
      'CharacterDataFormatter: Formatted speech patterns section'
    );
    return result;
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
      secrets,
      fears,
      speechPatterns,
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

    const likesSection = this.formatOptionalSection('Likes', likes);
    if (likesSection) {
      result += likesSection + '\n';
    }

    const dislikesSection = this.formatOptionalSection('Dislikes', dislikes);
    if (dislikesSection) {
      result += dislikesSection + '\n';
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
