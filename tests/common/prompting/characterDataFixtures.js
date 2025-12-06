/**
 * @file Test fixtures for CharacterDataXmlBuilder unit tests
 * @description Provides standardized character data objects for testing XML generation
 *
 * IMPORTANT NOTES ON DATA SOURCES:
 * - ActorPromptDataDTO: Core character data from ActorDataExtractor
 * - Extended data (goals, notes, shortTermMemory): Extracted separately by AIPromptContentProvider
 * - apparentAge: Object format {minAge, maxAge, bestGuess?} when present
 * - speechPatterns: ActorDataExtractor produces string[], but structured objects can be passed
 */

/**
 * Minimal character data - only the required name field
 */
export const MINIMAL_CHARACTER_DATA = {
  name: 'Test Character',
};

/**
 * Complete character data with all fields populated including extended data.
 * This simulates the combined data object passed by AIPromptContentProvider.
 */
export const COMPLETE_CHARACTER_DATA = {
  name: 'Vespera Nightwhisper',
  apparentAge: { minAge: 25, maxAge: 27, bestGuess: 26 },
  description: "5'6\" dancer's build with lean muscle and feline grace",
  personality:
    'A cat-girl bard, ruthlessly ambitious and calculating beneath her charming exterior',
  profile:
    'I grew up in the back alleys of the merchant district, learning to survive by wit alone',
  motivations:
    'I need to create something that matters, something that outlasts my mortal span',
  internalTensions:
    'The performer vs the person - am I the mask or what lies beneath?',
  coreDilemmas: 'Is authenticity possible when performance is survival?',
  strengths: 'Combat composure that unsettles my allies and enemies alike',
  weaknesses:
    'Impatient with incompetence and dismissive of those I deem beneath me',
  likes: 'Classical music, fine wine, witty banter',
  dislikes: 'Dishonesty, rudeness, small talk',
  fears: 'Genuine emotional intimacy, being truly seen',
  secrets: 'I write poetry I have never shown anyone',
  // NOTE: ActorDataExtractor produces string arrays, but structured objects
  // can also be passed if the caller provides them
  speechPatterns: [
    {
      type: 'Feline Verbal Tics',
      contexts: ['casual', 'manipulative'],
      examples: ['Oh meow-y goodness...', 'Purrfect, just purrfect.'],
    },
    {
      type: 'Theatrical Affectations',
      contexts: ['performance', 'formal'],
      examples: ['Darling, you simply must...', 'How delightfully tragic!'],
    },
  ],
  // NOTE: These are NOT part of base ActorPromptDataDTO but may be passed
  // by the integration layer (AIPromptContentProvider) in CHADATXMLREW-004
  goals: [
    {
      text: 'Compose three masterpieces before the winter solstice',
      timestamp: '2024-01-15T08:00:00Z',
    },
    { text: 'Find the emotional depth I have been avoiding' },
  ],
  notes: [
    {
      text: 'The lute is my only genuine relationship',
      subject: 'instrument',
      subjectType: 'entity',
    },
    {
      text: 'Marcus seems trustworthy but I must verify',
      subject: 'Marcus',
      subjectType: 'actor',
    },
  ],
  shortTermMemory: {
    thoughts: [
      {
        text: 'That look she gave me was unexpected',
        timestamp: '2024-01-15T10:30:00Z',
      },
      {
        text: 'I should not have revealed so much',
        timestamp: '2024-01-15T10:35:00Z',
      },
    ],
  },
};

/**
 * Character data with XML special characters requiring escaping
 */
export const CHARACTER_WITH_SPECIAL_CHARS = {
  name: 'Test <Character> & "Friends"',
  description: "Quote's here with <brackets> & ampersands",
  personality: 'Uses "air quotes" frequently & speaks in <whispers>',
  profile: "Born in the < realm > of symbols & 'punctuation'",
};

/**
 * Character with legacy string array speech patterns (as produced by ActorDataExtractor)
 */
export const CHARACTER_WITH_LEGACY_SPEECH = {
  name: 'Legacy Character',
  personality: 'Simple and straightforward',
  speechPatterns: [
    '(when happy) Big smile and wave',
    '(when sad) Quiet and withdrawn',
    '(when angry) Clenched fists and short sentences',
  ],
};

/**
 * Character with empty/null sections to test omission behavior
 */
export const CHARACTER_WITH_EMPTY_SECTIONS = {
  name: 'Minimal Character',
  personality: 'Quiet and reserved',
  // All psychology fields empty/null/undefined
  motivations: '',
  internalTensions: null,
  coreDilemmas: undefined,
  // Some traits present, some empty
  strengths: 'Good listener',
  weaknesses: '',
  likes: null,
  dislikes: undefined,
  fears: '',
  secrets: '',
};

/**
 * Character data WITHOUT current_state fields (basic ActorPromptDataDTO only).
 * Tests that <current_state> section is omitted when no goals/notes/shortTermMemory.
 */
export const CHARACTER_WITHOUT_CURRENT_STATE = {
  name: 'Static Character',
  description: 'A simple character without mutable state',
  personality: 'Stoic and reserved, unchanging',
  profile: 'My history is written, my future predetermined',
  // No goals, notes, or shortTermMemory
};

/**
 * Character with mixed speech pattern formats (both string and structured)
 */
export const CHARACTER_WITH_MIXED_SPEECH = {
  name: 'Mixed Pattern Character',
  speechPatterns: [
    '(casual) Uses relaxed language',
    {
      type: 'Formal Speech',
      contexts: ['official', 'diplomatic'],
      examples: ['I hereby declare...', 'With all due respect...'],
    },
    '(emotional) Expressive and dramatic',
  ],
};

/**
 * Character with only identity section populated
 */
export const CHARACTER_IDENTITY_ONLY = {
  name: 'Identity Only Character',
  apparentAge: { minAge: 30, maxAge: 35 },
  description: 'Tall and imposing figure',
};

/**
 * Character with apparent age as string (edge case - should handle gracefully)
 */
export const CHARACTER_WITH_STRING_AGE = {
  name: 'String Age Character',
  apparentAge: 'mid-twenties',
  description: 'Youthful appearance',
};

/**
 * Character with partial apparent age object (missing bestGuess)
 */
export const CHARACTER_WITH_PARTIAL_AGE = {
  name: 'Partial Age Character',
  apparentAge: { minAge: 40, maxAge: 50 },
  description: 'Weathered features',
};

/**
 * Character with empty goals/notes/shortTermMemory arrays
 */
export const CHARACTER_WITH_EMPTY_CURRENT_STATE = {
  name: 'Empty State Character',
  personality: 'Forgetful and aimless',
  goals: [],
  notes: [],
  shortTermMemory: { thoughts: [] },
};

/**
 * Character with notes missing optional fields
 */
export const CHARACTER_WITH_PARTIAL_NOTES = {
  name: 'Partial Notes Character',
  notes: [
    { text: 'Note without subject or type' },
    { text: 'Note with subject only', subject: 'Something' },
    { text: 'Note with type only', subjectType: 'concept' },
    { text: 'Complete note', subject: 'Topic', subjectType: 'entity' },
  ],
};

/**
 * Character with all psychology fields populated
 */
export const CHARACTER_FULL_PSYCHOLOGY = {
  name: 'Psychological Character',
  motivations: 'I seek power above all else, to never feel helpless again',
  internalTensions:
    'My desire for control conflicts with my need for connection',
  coreDilemmas: 'Can one truly love another while seeking to dominate them?',
};

/**
 * Character with all traits fields populated
 */
export const CHARACTER_FULL_TRAITS = {
  name: 'Trait-Rich Character',
  strengths:
    'Natural leadership ability, strategic thinking, unwavering loyalty',
  weaknesses: 'Pride that borders on arrogance, difficulty admitting mistakes',
  likes: 'Chess, thunderstorms, ancient texts, solitude',
  dislikes: 'Incompetence, betrayal, unnecessary cruelty, small talk',
  fears: 'Losing those I protect, becoming what I fight against',
  secrets: 'I once abandoned someone who trusted me to save myself',
};

/**
 * Create a character data object with specified fields only
 *
 * @param {Partial<typeof COMPLETE_CHARACTER_DATA>} overrides
 * @returns {object}
 */
export function createCharacterData(overrides = {}) {
  return {
    name: 'Generated Character',
    ...overrides,
  };
}

/**
 * Create goals array with specified count
 *
 * @param {number} count
 * @returns {Array<{text: string, timestamp?: string}>}
 */
export function createGoals(count) {
  return Array.from({ length: count }, (_, i) => ({
    text: `Goal ${i + 1}: Complete objective ${i + 1}`,
    timestamp: i % 2 === 0 ? new Date().toISOString() : undefined,
  }));
}

/**
 * Create notes array with specified count
 *
 * @param {number} count
 * @returns {Array<{text: string, subject?: string, subjectType?: string}>}
 */
export function createNotes(count) {
  const subjectTypes = ['entity', 'actor', 'location', 'concept'];
  return Array.from({ length: count }, (_, i) => ({
    text: `Note ${i + 1}: Observation about something`,
    subject: `Subject${i + 1}`,
    subjectType: subjectTypes[i % subjectTypes.length],
  }));
}

/**
 * Create short-term memory object with specified thought count
 *
 * @param {number} count
 * @returns {{thoughts: Array<{text: string, timestamp?: string}>}}
 */
export function createShortTermMemory(count) {
  return {
    thoughts: Array.from({ length: count }, (_, i) => ({
      text: `Thought ${i + 1}: Internal reflection`,
      timestamp: i % 2 === 0 ? new Date().toISOString() : undefined,
    })),
  };
}

// ========================================================================
// Health State Fixtures (INJREPANDUSEINT-012)
// ========================================================================

/**
 * Character with injuries (injured status, multiple body parts affected)
 */
export const CHARACTER_WITH_INJURIES = {
  name: 'Wounded Warrior',
  personality: 'Stoic despite the pain',
  healthState: {
    overallHealthPercentage: 45,
    overallStatus: 'injured',
    injuries: [
      {
        partName: 'left arm',
        partType: 'arm',
        state: 'wounded',
        healthPercent: 30,
        effects: ['bleeding_moderate'],
      },
      {
        partName: 'torso',
        partType: 'torso',
        state: 'wounded',
        healthPercent: 60,
        effects: [],
      },
    ],
    activeEffects: ['bleeding'],
    isDying: false,
    turnsUntilDeath: null,
    firstPersonNarrative: 'Sharp pain radiates from my left arm.',
  },
};

/**
 * Character who is dying with turns until death countdown
 */
export const CHARACTER_DYING = {
  name: 'Near Death',
  personality: 'Fading consciousness',
  healthState: {
    overallHealthPercentage: 8,
    overallStatus: 'dying',
    injuries: [
      {
        partName: 'heart',
        partType: 'heart',
        state: 'critical',
        healthPercent: 10,
        effects: [],
      },
    ],
    activeEffects: ['bleeding'],
    isDying: true,
    turnsUntilDeath: 2,
    firstPersonNarrative: null,
  },
};

/**
 * Character who is critically injured but not dying
 */
export const CHARACTER_CRITICAL = {
  name: 'Critical Fighter',
  personality: 'Desperately holding on',
  healthState: {
    overallHealthPercentage: 15,
    overallStatus: 'critical',
    injuries: [
      {
        partName: 'chest',
        partType: 'torso',
        state: 'critical',
        healthPercent: 12,
        effects: ['bleeding_severe', 'fractured'],
      },
    ],
    activeEffects: ['bleeding', 'fractured'],
    isDying: false,
    turnsUntilDeath: null,
    firstPersonNarrative: 'Every breath feels like my last.',
  },
};

/**
 * Character with null healthState (healthy, no injuries)
 */
export const CHARACTER_HEALTHY = {
  name: 'Healthy Hero',
  personality: 'Full of vigor',
  healthState: null,
};

/**
 * Character with empty injuries array but has active effects
 */
export const CHARACTER_WITH_EFFECTS_ONLY = {
  name: 'Afflicted One',
  personality: 'Suffering silently',
  healthState: {
    overallHealthPercentage: 70,
    overallStatus: 'wounded',
    injuries: [],
    activeEffects: ['poisoned', 'burning'],
    isDying: false,
    turnsUntilDeath: null,
    firstPersonNarrative: 'The poison courses through my veins.',
  },
};

/**
 * Character with special characters in injury data (for XML escaping tests)
 */
export const CHARACTER_WITH_SPECIAL_CHARS_INJURY = {
  name: 'Test & Escape',
  healthState: {
    overallHealthPercentage: 50,
    overallStatus: 'wounded',
    injuries: [
      {
        partName: 'left "arm" & shoulder',
        partType: 'arm',
        state: 'wounded',
        healthPercent: 40,
        effects: ['bleeding <moderate>'],
      },
    ],
    activeEffects: ['bleeding'],
    isDying: false,
    turnsUntilDeath: null,
    firstPersonNarrative: 'Pain in my "arm" & shoulder <sharp>.',
  },
};
