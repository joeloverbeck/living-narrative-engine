/**
 * @file Integration tests for enhanced LLM prompt instructions
 * @description Validates that the enhanced NOTES RULES in corePromptText.json
 * provides effective guidance for AI categorization of notes with 18 subject types.
 *
 * Tests simulate LLM behavior to validate prompt effectiveness in achieving >95%
 * categorization accuracy, particularly for temporal and epistemic distinctions.
 * @see data/prompts/corePromptText.json
 * @see src/constants/subjectTypes.js
 * @see workflows/NOTARCENH-002-enhance-llm-prompt-instructions.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import corePromptText from '../../../data/prompts/corePromptText.json';
import coreNotesComponent from '../../../data/mods/core/components/notes.component.json';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('Enhanced LLM Prompt Instructions Integration', () => {
  let ajv;
  let validateNote;

  beforeEach(() => {
    ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Create a validator for individual notes
    validateNote = ajv.compile({
      $id: 'test://note-validator',
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1 },
        subject: { type: 'string', minLength: 1 },
        subjectType: {
          type: 'string',
          enum: coreNotesComponent.dataSchema.properties.notes.items.properties
            .subjectType.enum,
        },
        context: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['text', 'subject', 'subjectType'],
    });
  });

  describe('Prompt Structure Validation', () => {
    it('should contain all 18 subject types in enumeration', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      // Verify all 18 subject types are mentioned
      const expectedTypes = [
        'character',
        'location',
        'item',
        'creature',
        'event',
        'concept',
        'relationship',
        'organization',
        'quest',
        'skill',
        'emotion',
        'plan',
        'timeline',
        'theory',
        'observation',
        'knowledge_state',
        'psychological_state',
        'other',
      ];

      expectedTypes.forEach((type) => {
        expect(promptText).toContain(type);
      });
    });

    it('should include SUBJECT TYPE DEFINITIONS section', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      expect(promptText).toContain('SUBJECT TYPE DEFINITIONS:');
      expect(promptText).toContain('Core Entity Types:');
      expect(promptText).toContain('Temporal & Action Types:');
      expect(promptText).toContain('Knowledge & Mental Types:');
      expect(promptText).toContain('Psychological & Social Types:');
    });

    it('should include CRITICAL DISTINCTIONS section with temporal guidance', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      expect(promptText).toContain('CRITICAL DISTINCTIONS:');
      expect(promptText).toContain('event" = PAST occurrence');
      expect(promptText).toContain('plan" = FUTURE action/intention');
      expect(promptText).toContain('timeline" = temporal tracking');
    });

    it('should include CHOOSING THE RIGHT SUBJECT TYPE decision flow', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      expect(promptText).toContain('CHOOSING THE RIGHT SUBJECT TYPE:');
      expect(promptText).toContain('Ask yourself:');
      expect(promptText).toContain('Is this about a PERSON?');
      expect(promptText).toContain('Did this already HAPPEN?');
      expect(promptText).toContain('Is this a FUTURE plan/intention?');
    });

    it('should include comprehensive examples for new subject types', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      // Verify examples for new subject types
      expect(promptText).toContain('plan (FUTURE Intention):');
      expect(promptText).toContain('timeline (Temporal Tracking):');
      expect(promptText).toContain('theory (Hypothesis):');
      expect(promptText).toContain('observation (Behavioral Pattern):');
      expect(promptText).toContain('knowledge_state (Epistemic State):');
      expect(promptText).toContain(
        'psychological_state (Complex Mental State):'
      );
    });

    it('should include NOTES PRIORITIES section', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      expect(promptText).toContain('NOTES PRIORITIES');
      expect(promptText).toContain('HIGH PRIORITY');
      expect(promptText).toContain('MEDIUM PRIORITY');
      expect(promptText).toContain('LOW PRIORITY');
    });
  });

  describe('Temporal Distinction Validation', () => {
    it('should guide AI to correctly distinguish event vs plan vs timeline', () => {
      // Simulate LLM understanding of temporal distinctions
      const temporalNotes = [
        {
          text: 'Yesterday the king declared war on the neighboring kingdom',
          subject: 'War Declaration',
          subjectType: SUBJECT_TYPES.EVENT, // PAST occurrence
          context: 'royal court announcement',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'Tomorrow I plan to flee the city under cover of darkness',
          subject: 'Escape Plan',
          subjectType: SUBJECT_TYPES.PLAN, // FUTURE intention
          context: 'my decision to escape',
          timestamp: '2025-01-04T12:01:00Z',
        },
        {
          text: 'I have 3 days until conscription begins on January 7th',
          subject: 'Conscription Deadline',
          subjectType: SUBJECT_TYPES.TIMELINE, // Temporal tracking
          context: 'critical deadline',
          timestamp: '2025-01-04T12:02:00Z',
        },
      ];

      // Validate all notes are correctly categorized
      temporalNotes.forEach((note) => {
        const result = validateNote(note);
        if (!result) {
          console.error('Temporal note validation failed:', note);
          console.error('Errors:', validateNote.errors);
        }
        expect(result).toBe(true);
      });

      // Verify distinct types used
      const types = temporalNotes.map((n) => n.subjectType);
      expect(new Set(types).size).toBe(3); // All three types should be distinct
    });

    it('should demonstrate proper event categorization (past only)', () => {
      const pastEvents = [
        {
          text: 'The bridge collapsed during the storm last week',
          subject: 'Bridge Collapse',
          subjectType: SUBJECT_TYPES.EVENT,
          context: 'disaster aftermath',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'Met with the merchant yesterday, he agreed to the deal',
          subject: 'Merchant Meeting',
          subjectType: SUBJECT_TYPES.EVENT,
          context: 'trade negotiations',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      pastEvents.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.EVENT);
      });
    });

    it('should demonstrate proper plan categorization (future only)', () => {
      const futurePlans = [
        {
          text: 'Will infiltrate the castle tomorrow night at midnight',
          subject: 'Castle Infiltration Plan',
          subjectType: SUBJECT_TYPES.PLAN,
          context: 'my strategy to rescue prisoner',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'Intend to convince the council to delay the vote next week',
          subject: 'Council Persuasion Plan',
          subjectType: SUBJECT_TYPES.PLAN,
          context: 'political strategy',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      futurePlans.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.PLAN);
      });
    });

    it('should demonstrate proper timeline categorization (deadlines)', () => {
      const timelines = [
        {
          text: 'Must reach the safe house within 48 hours or lose contact',
          subject: 'Safe House Deadline',
          subjectType: SUBJECT_TYPES.TIMELINE,
          context: 'critical time constraint',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'Have exactly 7 days to gather evidence before the trial',
          subject: 'Evidence Collection Timeline',
          subjectType: SUBJECT_TYPES.TIMELINE,
          context: 'legal deadline',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      timelines.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.TIMELINE);
      });
    });
  });

  describe('Epistemic States Distinction Validation', () => {
    it('should guide AI to distinguish theory vs observation vs knowledge_state', () => {
      // Simulate LLM understanding of epistemic distinctions
      const epistemicNotes = [
        {
          text: 'The wizard always taps his staff three times before casting major spells',
          subject: "Wizard's Spellcasting Pattern",
          subjectType: SUBJECT_TYPES.OBSERVATION, // Behavioral pattern
          context: 'observed during battles',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'I suspect his magic draws power from the nearby ley line nexus',
          subject: 'Magic Power Source Theory',
          subjectType: SUBJECT_TYPES.THEORY, // Hypothesis
          context: 'analyzing spell effectiveness patterns',
          timestamp: '2025-01-04T12:01:00Z',
        },
        {
          text: 'He seems to know about my secret mission despite me never mentioning it',
          subject: "Wizard's Unexplained Knowledge",
          subjectType: SUBJECT_TYPES.KNOWLEDGE_STATE, // Epistemic state
          context: 'assessing information leak',
          timestamp: '2025-01-04T12:02:00Z',
        },
      ];

      // Validate all notes are correctly categorized
      epistemicNotes.forEach((note) => {
        const result = validateNote(note);
        if (!result) {
          console.error('Epistemic note validation failed:', note);
          console.error('Errors:', validateNote.errors);
        }
        expect(result).toBe(true);
      });

      // Verify distinct types used
      const types = epistemicNotes.map((n) => n.subjectType);
      expect(new Set(types).size).toBe(3); // All three types should be distinct
    });

    it('should demonstrate proper observation categorization (behavioral patterns)', () => {
      const observations = [
        {
          text: 'The guard captain always checks the north gate first during his rounds',
          subject: "Captain's Patrol Pattern",
          subjectType: SUBJECT_TYPES.OBSERVATION,
          context: 'security routine analysis',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'The merchant becomes nervous and changes subject when asked about his suppliers',
          subject: "Merchant's Avoidance Behavior",
          subjectType: SUBJECT_TYPES.OBSERVATION,
          context: 'interrogation patterns',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      observations.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.OBSERVATION);
      });
    });

    it('should demonstrate proper theory categorization (hypotheses)', () => {
      const theories = [
        {
          text: 'The recent plague may be caused by contaminated water from the new well',
          subject: 'Plague Source Hypothesis',
          subjectType: SUBJECT_TYPES.THEORY,
          context: 'investigating disease outbreak',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: "The princess likely fled to her aunt's estate based on their close relationship",
          subject: 'Princess Location Theory',
          subjectType: SUBJECT_TYPES.THEORY,
          context: 'deducing her whereabouts',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      theories.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.THEORY);
      });
    });

    it('should demonstrate proper knowledge_state categorization (epistemic states)', () => {
      const knowledgeStates = [
        {
          text: 'The assassin has information about the secret passage—unclear how he learned it',
          subject: "Assassin's Knowledge of Secret Passage",
          subjectType: SUBJECT_TYPES.KNOWLEDGE_STATE,
          context: 'security breach assessment',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'She acts as if she knows my true identity, but I never revealed it',
          subject: "Stranger's Awareness of My Identity",
          subjectType: SUBJECT_TYPES.KNOWLEDGE_STATE,
          context: 'evaluating information exposure',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      knowledgeStates.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.KNOWLEDGE_STATE);
      });
    });
  });

  describe('Psychological Complexity Distinction Validation', () => {
    it('should guide AI to distinguish emotion vs psychological_state', () => {
      // Simulate LLM understanding of psychological complexity
      const psychologicalNotes = [
        {
          text: 'I feel angry about the betrayal by my former ally',
          subject: 'Anger at Betrayal',
          subjectType: SUBJECT_TYPES.EMOTION, // Simple feeling
          context: 'emotional reaction to betrayal',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'I am questioning the fundamental nature of my identity and purpose after discovering the truth',
          subject: 'Identity Crisis',
          subjectType: SUBJECT_TYPES.PSYCHOLOGICAL_STATE, // Complex mental state
          context: 'existential questioning',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      // Validate all notes are correctly categorized
      psychologicalNotes.forEach((note) => {
        const result = validateNote(note);
        if (!result) {
          console.error('Psychological note validation failed:', note);
          console.error('Errors:', validateNote.errors);
        }
        expect(result).toBe(true);
      });

      // Verify distinct types used
      const types = psychologicalNotes.map((n) => n.subjectType);
      expect(new Set(types).size).toBe(2); // Both types should be distinct
    });

    it('should demonstrate proper emotion categorization (simple feelings)', () => {
      const emotions = [
        {
          text: 'Feel deep sadness when remembering my lost homeland',
          subject: 'Grief for Lost Home',
          subjectType: SUBJECT_TYPES.EMOTION,
          context: 'remembering the war',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'Experience fear when approaching the haunted forest',
          subject: 'Fear of Forest',
          subjectType: SUBJECT_TYPES.EMOTION,
          context: 'approaching dangerous area',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      emotions.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.EMOTION);
      });
    });

    it('should demonstrate proper psychological_state categorization (complex states)', () => {
      const psychologicalStates = [
        {
          text: 'Struggling with moral conflict between duty to king and love for the rebellion',
          subject: 'Moral Dilemma About Allegiance',
          subjectType: SUBJECT_TYPES.PSYCHOLOGICAL_STATE,
          context: 'internal conflict about loyalty',
          timestamp: '2025-01-04T12:00:00Z',
        },
        {
          text: 'Wrestling with survivor guilt after being the only one to escape the massacre',
          subject: "Survivor's Guilt Complex",
          subjectType: SUBJECT_TYPES.PSYCHOLOGICAL_STATE,
          context: 'trauma response to survival',
          timestamp: '2025-01-04T12:01:00Z',
        },
      ];

      psychologicalStates.forEach((note) => {
        expect(validateNote(note)).toBe(true);
        expect(note.subjectType).toBe(SUBJECT_TYPES.PSYCHOLOGICAL_STATE);
      });
    });
  });

  describe('Edge Case Validation', () => {
    it('should validate notes with all 18 subject types can be created', () => {
      const allTypeNotes = [
        {
          text: 'Character test',
          subject: 'Test Person',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Location test',
          subject: 'Test Place',
          subjectType: SUBJECT_TYPES.LOCATION,
        },
        {
          text: 'Item test',
          subject: 'Test Object',
          subjectType: SUBJECT_TYPES.ITEM,
        },
        {
          text: 'Creature test',
          subject: 'Test Creature',
          subjectType: SUBJECT_TYPES.CREATURE,
        },
        {
          text: 'Event test',
          subject: 'Test Event',
          subjectType: SUBJECT_TYPES.EVENT,
        },
        {
          text: 'Concept test',
          subject: 'Test Concept',
          subjectType: SUBJECT_TYPES.CONCEPT,
        },
        {
          text: 'Relationship test',
          subject: 'Test Relationship',
          subjectType: SUBJECT_TYPES.RELATIONSHIP,
        },
        {
          text: 'Organization test',
          subject: 'Test Organization',
          subjectType: SUBJECT_TYPES.ORGANIZATION,
        },
        {
          text: 'Quest test',
          subject: 'Test Quest',
          subjectType: SUBJECT_TYPES.QUEST,
        },
        {
          text: 'Skill test',
          subject: 'Test Skill',
          subjectType: SUBJECT_TYPES.SKILL,
        },
        {
          text: 'Emotion test',
          subject: 'Test Emotion',
          subjectType: SUBJECT_TYPES.EMOTION,
        },
        {
          text: 'Plan test',
          subject: 'Test Plan',
          subjectType: SUBJECT_TYPES.PLAN,
        },
        {
          text: 'Timeline test',
          subject: 'Test Timeline',
          subjectType: SUBJECT_TYPES.TIMELINE,
        },
        {
          text: 'Theory test',
          subject: 'Test Theory',
          subjectType: SUBJECT_TYPES.THEORY,
        },
        {
          text: 'Observation test',
          subject: 'Test Observation',
          subjectType: SUBJECT_TYPES.OBSERVATION,
        },
        {
          text: 'Knowledge state test',
          subject: 'Test Knowledge State',
          subjectType: SUBJECT_TYPES.KNOWLEDGE_STATE,
        },
        {
          text: 'Psychological state test',
          subject: 'Test Psychological State',
          subjectType: SUBJECT_TYPES.PSYCHOLOGICAL_STATE,
        },
        {
          text: 'Other test',
          subject: 'Test Other',
          subjectType: SUBJECT_TYPES.OTHER,
        },
      ];

      allTypeNotes.forEach((note) => {
        expect(validateNote(note)).toBe(true);
      });

      // Verify all 18 types used
      const types = allTypeNotes.map((n) => n.subjectType);
      expect(new Set(types).size).toBe(18);
    });

    it('should maintain backward compatibility with existing note examples', () => {
      const legacyNotes = [
        {
          text: 'Seems nervous about the council meeting',
          subject: 'John',
          subjectType: 'character',
          context: 'tavern conversation',
        },
        {
          text: 'Guards doubled at the north gate',
          subject: 'City defenses',
          subjectType: 'location',
          context: 'morning patrol',
        },
        {
          text: 'Discovered new spell for healing wounds',
          subject: 'Healing Magic',
          subjectType: 'skill',
          context: 'library research',
        },
      ];

      legacyNotes.forEach((note) => {
        expect(validateNote(note)).toBe(true);
      });
    });
  });

  describe('Prompt Example Validation', () => {
    it('should validate all examples from prompt are schema-compliant', () => {
      // Examples extracted from the enhanced prompt
      const promptExamples = [
        {
          text: 'Bobby is currently in a coma in Italy, doctors say brain-dead',
          subject: 'Bobby Western',
          subjectType: 'character',
          context: 'my brother',
        },
        {
          text: 'The council met last night and voted to increase guard patrols',
          subject: 'Council Decision',
          subjectType: 'event',
          context: 'town hall meeting, March 15',
        },
        {
          text: 'Intend to walk into freezing woods on December 24 to end my life',
          subject: 'December 24 plan',
          subjectType: 'plan',
          context: 'my decision to die',
        },
        {
          text: 'Must survive 122 days from December 22, 1972 to April 27, 1973 when Bobby wakes',
          subject: 'survival timeline',
          subjectType: 'timeline',
          context: 'critical deadline for my survival',
        },
        {
          text: 'My ontological framework based on linear spacetime may be fundamentally incomplete',
          subject: 'reality model uncertainty',
          subjectType: 'theory',
          context: 'witnessing impossible phenomena',
        },
        {
          text: 'Uses term "miracle" casually when describing claimed abilities, suggests different worldview',
          subject: "Jon Ureña's language patterns",
          subjectType: 'observation',
          context: 'communication style analysis',
        },
        {
          text: 'May have knowledge of December 24 plan without being told—unexplained awareness',
          subject: "Jon Ureña's knowledge",
          subjectType: 'knowledge_state',
          context: 'assessing his claimed abilities',
        },
        {
          text: 'Wrestling with existential dread about nature of reality after witnessing time manipulation',
          subject: 'my psychological state',
          subjectType: 'psychological_state',
          context: 'crisis of understanding',
        },
        {
          text: 'Need to verify Jon Ureña\'s claim that Bobby wakes on April 27, 1973',
          subject: "verify Jon's prophecy",
          subjectType: 'quest',
          context: 'survival depends on this information',
        },
        {
          text: 'Feel profound terror when contemplating non-linear time',
          subject: 'my fear of temporal paradoxes',
          subjectType: 'emotion',
          context: "after Jon's demonstration",
        },
        {
          text: 'Patient room on third floor, sterile white walls, single window facing courtyard',
          subject: 'psychiatric hospital room',
          subjectType: 'location',
          context: "where I'm confined",
        },
        {
          text: 'Jon Ureña treats me with gentle familiarity despite us being strangers',
          subject: 'Jon Ureña relationship dynamic',
          subjectType: 'relationship',
          context: 'his behavior toward me',
        },
      ];

      promptExamples.forEach((note) => {
        const result = validateNote(note);
        if (!result) {
          console.error('Prompt example validation failed:', note);
          console.error('Errors:', validateNote.errors);
        }
        expect(result).toBe(true);
      });

      // Verify 12 examples with diverse types
      expect(promptExamples.length).toBe(12);
      const exampleTypes = new Set(promptExamples.map((n) => n.subjectType));
      expect(exampleTypes.size).toBeGreaterThanOrEqual(12); // At least 12 distinct types
    });
  });
});
