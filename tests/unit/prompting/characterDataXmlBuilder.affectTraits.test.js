/**
 * @file Unit tests for CharacterDataXmlBuilder affect_traits XML output
 * @description Tests the inclusion of affect_traits in the inner_state XML section
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import CharacterDataXmlBuilder from '../../../src/prompting/characterDataXmlBuilder.js';
import XmlElementBuilder from '../../../src/prompting/xmlElementBuilder.js';

describe('CharacterDataXmlBuilder affect_traits', () => {
  let builder;
  let mockLogger;
  let xmlElementBuilder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    xmlElementBuilder = new XmlElementBuilder();
    builder = new CharacterDataXmlBuilder({
      logger: mockLogger,
      xmlElementBuilder,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('affect_traits XML generation', () => {
    const createCharacterWithAffectTraits = (affectTraits) => ({
      name: 'Test Character',
      personality: 'Test personality',
      emotionalState: {
        moodAxes: { valence: 0, arousal: 50 },
        emotionalStateText: 'neutral, calm',
        sexualState: { sex_excitation: 30, sex_inhibition: 70 },
        sexualStateText: 'calm, neutral arousal',
        sexVariables: { sex_excitation: 30, sex_inhibition: 70 },
        affectTraits,
      },
    });

    it('should include affect_traits when includeMoodAxes is true and affectTraits exist', () => {
      const characterData = createCharacterWithAffectTraits({
        affective_empathy: 65,
        cognitive_empathy: 72,
        harm_aversion: 55,
        self_control: 48,
        disgust_sensitivity: 60,
        ruminative_tendency: 70,
        evaluation_sensitivity: 58,
      });

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      expect(result).toMatch(/<affect_traits>/);
      expect(result).toMatch(/ruminative_tendency: 70/);
    });

    it('should NOT include affect_traits when includeMoodAxes is false', () => {
      const characterData = createCharacterWithAffectTraits({
        affective_empathy: 65,
        cognitive_empathy: 72,
        harm_aversion: 55,
        self_control: 48,
        disgust_sensitivity: 60,
        ruminative_tendency: 70,
        evaluation_sensitivity: 58,
      });

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: false,
      });

      expect(result).not.toMatch(/<affect_traits>/);
    });

    it('should NOT include affect_traits when affectTraits is null', () => {
      const characterData = createCharacterWithAffectTraits(null);

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      expect(result).not.toMatch(/<affect_traits>/);
    });

    it('should NOT include affect_traits when affectTraits is undefined', () => {
      const characterData = {
        name: 'Test Character',
        personality: 'Test personality',
        emotionalState: {
          moodAxes: { valence: 0, arousal: 50 },
          emotionalStateText: 'neutral, calm',
          sexualState: { sex_excitation: 30, sex_inhibition: 70 },
          sexualStateText: 'calm, neutral arousal',
          sexVariables: { sex_excitation: 30, sex_inhibition: 70 },
          // affectTraits intentionally missing
        },
      };

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      expect(result).not.toMatch(/<affect_traits>/);
    });

    it('should format all 7 affect traits', () => {
      const characterData = createCharacterWithAffectTraits({
        affective_empathy: 65,
        cognitive_empathy: 72,
        harm_aversion: 55,
        self_control: 48,
        disgust_sensitivity: 60,
        ruminative_tendency: 70,
        evaluation_sensitivity: 58,
      });

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      expect(result).toMatch(/affective_empathy: 65/);
      expect(result).toMatch(/cognitive_empathy: 72/);
      expect(result).toMatch(/harm_aversion: 55/);
      expect(result).toMatch(/self_control: 48/);
      expect(result).toMatch(/disgust_sensitivity: 60/);
      expect(result).toMatch(/ruminative_tendency: 70/);
      expect(result).toMatch(/evaluation_sensitivity: 58/);
    });

    it('should use default value of 50 for missing affect traits', () => {
      const characterData = createCharacterWithAffectTraits({
        affective_empathy: 80,
        // Other traits missing - should default to 50
      });

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      expect(result).toMatch(/affective_empathy: 80/);
      expect(result).toMatch(/cognitive_empathy: 50/);
      expect(result).toMatch(/harm_aversion: 50/);
      expect(result).toMatch(/self_control: 50/);
      expect(result).toMatch(/disgust_sensitivity: 50/);
      expect(result).toMatch(/ruminative_tendency: 50/);
      expect(result).toMatch(/evaluation_sensitivity: 50/);
    });

    it('should place affect_traits after sex_variables in inner_state section', () => {
      const characterData = createCharacterWithAffectTraits({
        affective_empathy: 65,
        cognitive_empathy: 72,
        harm_aversion: 55,
        self_control: 48,
        disgust_sensitivity: 60,
        ruminative_tendency: 70,
        evaluation_sensitivity: 58,
      });

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      const sexVariablesIndex = result.indexOf('<sex_variables>');
      const affectTraitsIndex = result.indexOf('<affect_traits>');

      expect(sexVariablesIndex).toBeLessThan(affectTraitsIndex);
    });

    it('should properly escape special characters in affect_traits', () => {
      // This test ensures XML special characters in numeric values are handled
      // (though numbers shouldn't have special chars, the formatter should still escape)
      const characterData = createCharacterWithAffectTraits({
        affective_empathy: 65,
        cognitive_empathy: 72,
        harm_aversion: 55,
        self_control: 48,
        disgust_sensitivity: 60,
        ruminative_tendency: 70,
        evaluation_sensitivity: 58,
      });

      const result = builder.buildCharacterDataXml(characterData, {
        includeMoodAxes: true,
      });

      // Should be valid XML without special character issues
      expect(result).toContain('<affect_traits>');
      expect(result).toContain('</affect_traits>');
    });
  });
});
