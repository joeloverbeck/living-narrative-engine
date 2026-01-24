/**
 * @file Schema validation tests for core mod components.
 * Tests that core component data schemas validate correctly with AJV.
 */

import { describe } from '@jest/globals';
import {
  createAjvInstance,
  loadComponentValidators,
  generateComponentTests,
  getModComponentsPath,
} from './schemaTestUtils.js';

const ajv = createAjvInstance();
const validators = loadComponentValidators(getModComponentsPath('core'), ajv);

/** @type {Record<string, unknown>} */
const validPayloads = {
  'core:actor': {},
  'core:apparent_age': { minAge: 25, maxAge: 35 },
  'core:armed': { equippedItemId: 'entity:weapon_123', readyState: 'drawn' },
  'core:current_actor': {},
  'core:player': {},
  'core:player_type': { type: 'human' },
  'core:description': { text: 'desc' },
  'core:dilemmas': { text: 'Am I doing the right thing?' },
  'core:dislikes': { text: 'dislike' },
  'core:fears': { text: 'fear' },
  'core:hungry': {
    severity: 40,
    since: '2024-05-05T12:00:00Z',
  },
  'core:internal_tensions': { text: 'I want freedom but crave security' },
  'core:known_to': { entities: [] },
  'core:likes': { text: 'like' },
  'core:motivations': { text: 'I need to prove my worth to myself' },
  'core:personality': { text: 'trait' },
  'core:profile': { text: 'profile' },
  'core:secrets': { text: 'secret' },
  'core:name': { text: 'Alice' },
  'core:following': { leaderId: 'core:leader' },
  'core:leading': { followers: ['core:follower'] },
  'core:movement': { locked: false },
  'core:mood': {
    valence: 0,
    arousal: 0,
    agency_control: 0,
    threat: 0,
    engagement: 0,
    future_expectancy: 0,
    temporal_orientation: 0,
    self_evaluation: 0,
    affiliation: 0,
    inhibitory_control: 0,
    uncertainty: 0,
  },
  'core:notes': { notes: [] },
  'core:goals': { goals: [] },
  'core:perception_log': { logEntries: [], maxEntries: 5 },
  'core:portrait': { imagePath: 'image.png', altText: 'desc' },
  'core:position': { locationId: 'core:room' },
  'core:progress_tracker': { value: 2 },
  'core:short_term_memory': { thoughts: [], maxEntries: 5 },
  'core:speech_patterns': { patterns: ['hello'] },
  'core:sexual_state': {
    sex_excitation: 0,
    sex_inhibition: 0,
    baseline_libido: 0,
  },
  'core:affect_traits': {
    affective_empathy: 50,
    cognitive_empathy: 50,
    harm_aversion: 50,
    self_control: 50,
  },
  'core:strengths': { text: 'I am good at problem solving' },
  'core:visible': { isVisible: true },
  'core:weaknesses': { text: 'I tend to be impatient' },
  'core:weight': { weight: 5.5 },
  'core:owned_by': { ownerId: 'entity-123' },
  'core:material': { material: 'cotton' },
  'core:mouth_engagement': { locked: false },
  'core:gender': { value: 'male' },
  'core:participation': { participating: true },
  'core:conspicuous': {},
  'core:cognitive_ledger': {
    settled_conclusions: [],
    open_questions: [],
  },
};

/** @type {Record<string, unknown>} */
const invalidPayloads = {
  'core:actor': { extra: true },
  'core:apparent_age': {},
  'core:armed': { readyState: 'holstered' },
  'core:current_actor': { extra: true },
  'core:player': { extra: true },
  'core:player_type': { type: 'invalid_type' },
  'core:description': {},
  'core:dilemmas': {},
  'core:dislikes': {},
  'core:fears': {},
  'core:hungry': { severity: 200 },
  'core:internal_tensions': {},
  'core:known_to': {},
  'core:likes': {},
  'core:motivations': {},
  'core:personality': {},
  'core:profile': {},
  'core:secrets': {},
  'core:name': {},
  'core:following': {},
  'core:leading': { followers: 'nope' },
  'core:movement': {},
  'core:mood': {},
  'core:notes': {},
  'core:goals': {},
  'core:perception_log': {},
  'core:portrait': {},
  'core:position': {},
  'core:progress_tracker': { value: -1 },
  'core:short_term_memory': {},
  'core:speech_patterns': {},
  'core:sexual_state': {},
  'core:affect_traits': {},
  'core:strengths': {},
  'core:visible': {},
  'core:weaknesses': {},
  'core:weight': { weight: -1 },
  'core:owned_by': {},
  'core:material': { material: 'invalid_material_not_in_enum' },
  'core:mouth_engagement': { locked: 'not-a-boolean' },
  'core:gender': {},
  'core:participation': {},
  'core:conspicuous': { extra: true },
  'core:cognitive_ledger': {
    settled_conclusions: [],
    open_questions: [''],
  },
};

describe('JSON-Schema – core component data contracts', () => {
  generateComponentTests(validators, validPayloads, invalidPayloads);
});
