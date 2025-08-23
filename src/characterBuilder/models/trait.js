/**
 * @file Trait model
 * @description Represents a comprehensive character trait with multiple categories
 * @see coreMotivation.js
 * @see characterConcept.js
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {object} LLMMetadata
 * @property {string} model - LLM model used for generation
 * @property {number} temperature - Temperature setting used
 * @property {number} tokens - Token count for generation
 * @property {number} responseTime - Generation time in ms
 * @property {string} promptVersion - Version of prompt used
 * @property {string} generationPrompt - The prompt used for generation (for debugging)
 */

/**
 * @typedef {object} NameItem
 * @property {string} name - The character name
 * @property {string} justification - Justification for the name choice
 */

/**
 * @typedef {object} PersonalityItem
 * @property {string} trait - The personality trait
 * @property {string} explanation - Explanation of how this trait manifests
 */

/**
 * @typedef {object} Goals
 * @property {string[]} shortTerm - Array of 1-2 short-term goals
 * @property {string} longTerm - Long-term goal description
 */

/**
 * @typedef {object} TraitData
 * @property {string} [id] - Unique identifier (auto-generated if not provided)
 * @property {NameItem[]} names - 3-5 name options with justifications
 * @property {string} physicalDescription - Physical description (100-500 characters)
 * @property {PersonalityItem[]} personality - 3-5 personality traits with explanations
 * @property {string[]} strengths - 2-4 character strengths
 * @property {string[]} weaknesses - 2-4 character weaknesses
 * @property {string[]} likes - 3-5 things the character likes
 * @property {string[]} dislikes - 3-5 things the character dislikes
 * @property {string[]} fears - 1-2 character fears
 * @property {Goals} goals - Short-term and long-term goals
 * @property {string[]} notes - 2-3 additional notes
 * @property {string} profile - Character profile summary (200-800 characters)
 * @property {string[]} secrets - 1-2 character secrets
 * @property {string} [generatedAt] - ISO timestamp (auto-generated if not provided)
 * @property {LLMMetadata} [metadata] - LLM generation metadata
 */

/**
 * Represents a comprehensive character trait with multiple categories
 */
export class Trait {
  /**
   * Create a new Trait instance
   *
   * @param {TraitData} data - Trait data
   * @returns {Trait} Validated trait instance
   */
  constructor(data) {
    this.#validate(data);

    // Set core properties
    this.id = data?.id || uuidv4();
    this.names = data?.names || [];
    this.physicalDescription = (data?.physicalDescription || '').trim();
    this.personality = data?.personality || [];
    this.strengths = data?.strengths || [];
    this.weaknesses = data?.weaknesses || [];
    this.likes = data?.likes || [];
    this.dislikes = data?.dislikes || [];
    this.fears = data?.fears || [];
    this.goals = data?.goals !== undefined ? data.goals : { shortTerm: [], longTerm: '' };
    this.notes = data?.notes || [];
    this.profile = (data?.profile || '').trim();
    this.secrets = data?.secrets || [];
    this.generatedAt = data?.generatedAt || new Date().toISOString();

    // Optional metadata
    this.metadata = data?.metadata || {};

    // Freeze to prevent mutation
    Object.freeze(this);
    Object.freeze(this.names);
    Object.freeze(this.personality);
    Object.freeze(this.strengths);
    Object.freeze(this.weaknesses);
    Object.freeze(this.likes);
    Object.freeze(this.dislikes);
    Object.freeze(this.fears);
    Object.freeze(this.goals);
    if (this.goals && this.goals.shortTerm) {
      Object.freeze(this.goals.shortTerm);
    }
    Object.freeze(this.notes);
    Object.freeze(this.secrets);
    Object.freeze(this.metadata);
  }

  /**
   * Validate required fields and structure
   *
   * @param {TraitData} data - Data to validate
   * @private
   */
  #validate(data) {
    if (data === null || data === undefined) {
      throw new Error('Trait data is required');
    }

    // Basic type checks
    if (typeof data !== 'object') {
      throw new Error('Trait data must be an object');
    }
  }

  /**
   * Create a Trait from raw LLM response data
   *
   * @param {object} rawTraits - Raw traits from LLM
   * @param {LLMMetadata} [metadata] - Generation metadata
   * @returns {Trait} Trait instance
   */
  static fromLLMResponse(rawTraits, metadata = {}) {
    if (!rawTraits || typeof rawTraits !== 'object') {
      throw new Error('Raw traits data is required and must be an object');
    }

    // Transform LLM response to trait structure
    const traitData = {
      names: rawTraits.names || [],
      physicalDescription: rawTraits.physicalDescription || rawTraits.physical || '',
      personality: rawTraits.personality || [],
      strengths: rawTraits.strengths || [],
      weaknesses: rawTraits.weaknesses || [],
      likes: rawTraits.likes || [],
      dislikes: rawTraits.dislikes || [],
      fears: rawTraits.fears || [],
      goals: rawTraits.goals || { shortTerm: [], longTerm: '' },
      notes: rawTraits.notes || [],
      profile: rawTraits.profile || rawTraits.summary || '',
      secrets: rawTraits.secrets || [],
      metadata,
    };

    return new Trait(traitData);
  }

  /**
   * Create Trait from stored data
   *
   * @param {object} data - Data from storage
   * @returns {Trait} Trait instance
   */
  static fromRawData(data) {
    return new Trait(data);
  }

  /**
   * Convert to plain object for storage
   *
   * @returns {object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      names: [...this.names],
      physicalDescription: this.physicalDescription,
      personality: [...this.personality],
      strengths: [...this.strengths],
      weaknesses: [...this.weaknesses],
      likes: [...this.likes],
      dislikes: [...this.dislikes],
      fears: [...this.fears],
      goals: {
        shortTerm: [...this.goals.shortTerm],
        longTerm: this.goals.longTerm,
      },
      notes: [...this.notes],
      profile: this.profile,
      secrets: [...this.secrets],
      generatedAt: this.generatedAt,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Validate trait content meets quality standards
   *
   * @returns {object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validate names
    if (!Array.isArray(this.names) || this.names.length < 3 || this.names.length > 5) {
      errors.push('Names must be an array with 3-5 items');
    } else {
      this.names.forEach((nameItem, index) => {
        if (!nameItem || typeof nameItem !== 'object') {
          errors.push(`Names[${index}] must be an object with name and justification`);
        } else {
          if (!nameItem.name || typeof nameItem.name !== 'string' || nameItem.name.trim() === '') {
            errors.push(`Names[${index}].name is required and must be a non-empty string`);
          }
          if (!nameItem.justification || typeof nameItem.justification !== 'string' || nameItem.justification.trim() === '') {
            errors.push(`Names[${index}].justification is required and must be a non-empty string`);
          }
        }
      });
    }

    // Validate physical description
    if (!this.physicalDescription || typeof this.physicalDescription !== 'string') {
      errors.push('Physical description is required and must be a string');
    } else if (this.physicalDescription.length < 100) {
      errors.push('Physical description is too short (min 100 characters)');
    } else if (this.physicalDescription.length > 500) {
      warnings.push('Physical description is very long (max recommended 500 characters)');
    }

    // Validate personality
    if (!Array.isArray(this.personality) || this.personality.length < 3 || this.personality.length > 5) {
      errors.push('Personality must be an array with 3-5 items');
    } else {
      this.personality.forEach((personalityItem, index) => {
        if (!personalityItem || typeof personalityItem !== 'object') {
          errors.push(`Personality[${index}] must be an object with trait and explanation`);
        } else {
          if (!personalityItem.trait || typeof personalityItem.trait !== 'string' || personalityItem.trait.trim() === '') {
            errors.push(`Personality[${index}].trait is required and must be a non-empty string`);
          }
          if (!personalityItem.explanation || typeof personalityItem.explanation !== 'string' || personalityItem.explanation.trim() === '') {
            errors.push(`Personality[${index}].explanation is required and must be a non-empty string`);
          }
        }
      });
    }

    // Validate strengths
    if (!Array.isArray(this.strengths) || this.strengths.length < 2 || this.strengths.length > 4) {
      errors.push('Strengths must be an array with 2-4 items');
    } else {
      this.strengths.forEach((strength, index) => {
        if (!strength || typeof strength !== 'string' || strength.trim() === '') {
          errors.push(`Strengths[${index}] must be a non-empty string`);
        }
      });
    }

    // Validate weaknesses
    if (!Array.isArray(this.weaknesses) || this.weaknesses.length < 2 || this.weaknesses.length > 4) {
      errors.push('Weaknesses must be an array with 2-4 items');
    } else {
      this.weaknesses.forEach((weakness, index) => {
        if (!weakness || typeof weakness !== 'string' || weakness.trim() === '') {
          errors.push(`Weaknesses[${index}] must be a non-empty string`);
        }
      });
    }

    // Validate likes
    if (!Array.isArray(this.likes) || this.likes.length < 3 || this.likes.length > 5) {
      errors.push('Likes must be an array with 3-5 items');
    } else {
      this.likes.forEach((like, index) => {
        if (!like || typeof like !== 'string' || like.trim() === '') {
          errors.push(`Likes[${index}] must be a non-empty string`);
        }
      });
    }

    // Validate dislikes
    if (!Array.isArray(this.dislikes) || this.dislikes.length < 3 || this.dislikes.length > 5) {
      errors.push('Dislikes must be an array with 3-5 items');
    } else {
      this.dislikes.forEach((dislike, index) => {
        if (!dislike || typeof dislike !== 'string' || dislike.trim() === '') {
          errors.push(`Dislikes[${index}] must be a non-empty string`);
        }
      });
    }

    // Validate fears
    if (!Array.isArray(this.fears) || this.fears.length < 1 || this.fears.length > 2) {
      errors.push('Fears must be an array with 1-2 items');
    } else {
      this.fears.forEach((fear, index) => {
        if (!fear || typeof fear !== 'string' || fear.trim() === '') {
          errors.push(`Fears[${index}] must be a non-empty string`);
        }
      });
    }

    // Validate goals
    if (!this.goals || typeof this.goals !== 'object' || Array.isArray(this.goals)) {
      errors.push('Goals must be an object with shortTerm and longTerm properties');
    } else {
      if (!Array.isArray(this.goals.shortTerm) || this.goals.shortTerm.length < 1 || this.goals.shortTerm.length > 2) {
        errors.push('Goals.shortTerm must be an array with 1-2 items');
      } else {
        this.goals.shortTerm.forEach((goal, index) => {
          if (!goal || typeof goal !== 'string' || goal.trim() === '') {
            errors.push(`Goals.shortTerm[${index}] must be a non-empty string`);
          }
        });
      }
      
      if (!this.goals.longTerm || typeof this.goals.longTerm !== 'string' || this.goals.longTerm.trim() === '') {
        errors.push('Goals.longTerm is required and must be a non-empty string');
      }
    }

    // Validate notes
    if (!Array.isArray(this.notes) || this.notes.length < 2 || this.notes.length > 3) {
      errors.push('Notes must be an array with 2-3 items');
    } else {
      this.notes.forEach((note, index) => {
        if (!note || typeof note !== 'string' || note.trim() === '') {
          errors.push(`Notes[${index}] must be a non-empty string`);
        }
      });
    }

    // Validate profile
    if (!this.profile || typeof this.profile !== 'string') {
      errors.push('Profile is required and must be a string');
    } else if (this.profile.length < 200) {
      errors.push('Profile is too short (min 200 characters)');
    } else if (this.profile.length > 800) {
      warnings.push('Profile is very long (max recommended 800 characters)');
    }

    // Validate secrets
    if (!Array.isArray(this.secrets) || this.secrets.length < 1 || this.secrets.length > 2) {
      errors.push('Secrets must be an array with 1-2 items');
    } else {
      this.secrets.forEach((secret, index) => {
        if (!secret || typeof secret !== 'string' || secret.trim() === '') {
          errors.push(`Secrets[${index}] must be a non-empty string`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format trait for human-readable export
   *
   * @returns {string} Formatted string representation
   */
  toExportText() {
    let text = '';
    
    // Names section
    text += 'CHARACTER NAMES:\n';
    this.names.forEach((nameItem, index) => {
      text += `  ${index + 1}. ${nameItem.name}\n`;
      text += `     Justification: ${nameItem.justification}\n`;
    });
    text += '\n';

    // Physical description
    text += 'PHYSICAL DESCRIPTION:\n';
    text += `${this.physicalDescription}\n\n`;

    // Personality
    text += 'PERSONALITY TRAITS:\n';
    this.personality.forEach((personalityItem, index) => {
      text += `  ${index + 1}. ${personalityItem.trait}\n`;
      text += `     ${personalityItem.explanation}\n`;
    });
    text += '\n';

    // Strengths
    text += 'STRENGTHS:\n';
    this.strengths.forEach((strength, index) => {
      text += `  ${index + 1}. ${strength}\n`;
    });
    text += '\n';

    // Weaknesses
    text += 'WEAKNESSES:\n';
    this.weaknesses.forEach((weakness, index) => {
      text += `  ${index + 1}. ${weakness}\n`;
    });
    text += '\n';

    // Likes
    text += 'LIKES:\n';
    this.likes.forEach((like, index) => {
      text += `  ${index + 1}. ${like}\n`;
    });
    text += '\n';

    // Dislikes
    text += 'DISLIKES:\n';
    this.dislikes.forEach((dislike, index) => {
      text += `  ${index + 1}. ${dislike}\n`;
    });
    text += '\n';

    // Fears
    text += 'FEARS:\n';
    this.fears.forEach((fear, index) => {
      text += `  ${index + 1}. ${fear}\n`;
    });
    text += '\n';

    // Goals
    text += 'GOALS:\n';
    text += 'Short-term:\n';
    this.goals.shortTerm.forEach((goal, index) => {
      text += `  ${index + 1}. ${goal}\n`;
    });
    text += `Long-term: ${this.goals.longTerm}\n\n`;

    // Notes
    text += 'ADDITIONAL NOTES:\n';
    this.notes.forEach((note, index) => {
      text += `  ${index + 1}. ${note}\n`;
    });
    text += '\n';

    // Profile
    text += 'CHARACTER PROFILE:\n';
    text += `${this.profile}\n\n`;

    // Secrets
    text += 'SECRETS:\n';
    this.secrets.forEach((secret, index) => {
      text += `  ${index + 1}. ${secret}\n`;
    });

    return text;
  }

  /**
   * Get a summary of the trait
   *
   * @param {number} maxLength - Maximum length for each field
   * @returns {object} Summary with truncated fields
   */
  getSummary(maxLength = 100) {
    const truncate = (str) => {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength - 3) + '...';
    };

    return {
      physicalDescription: truncate(this.physicalDescription),
      profile: truncate(this.profile),
      names: this.names.map(n => n.name).join(', '),
      personalityCount: this.personality.length,
      strengthsCount: this.strengths.length,
      weaknessesCount: this.weaknesses.length,
    };
  }

  /**
   * Clone the trait
   *
   * @returns {Trait} New Trait instance
   */
  clone() {
    return new Trait(this.toJSON());
  }

  /**
   * Check if trait matches search terms
   *
   * @param {string} searchTerm - Term to search for
   * @returns {boolean} True if any field contains the search term
   */
  matchesSearch(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    // Search in string fields
    if (this.physicalDescription.toLowerCase().includes(term) ||
        this.profile.toLowerCase().includes(term)) {
      return true;
    }

    // Search in array fields
    const searchArrays = [
      this.names.map(n => n.name + ' ' + n.justification),
      this.personality.map(p => p.trait + ' ' + p.explanation),
      this.strengths,
      this.weaknesses,
      this.likes,
      this.dislikes,
      this.fears,
      this.goals.shortTerm,
      [this.goals.longTerm],
      this.notes,
      this.secrets,
    ];

    return searchArrays.some(array => 
      array.some(item => item.toLowerCase().includes(term))
    );
  }
}

export default Trait;