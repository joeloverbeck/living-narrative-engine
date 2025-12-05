/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/**
 * @file Integration tests for LLM prompt injuries narrative consistency.
 * Verifies that the <injuries> element in the LLM prompt contains the exact same
 * first-person narrative text used by the game.html Physical Condition panel.
 * @see src/prompting/characterDataXmlBuilder.js - XML generation for LLM prompts
 * @see src/domUI/injuryStatusPanel.js - game.html Physical Condition panel
 * @see src/anatomy/services/injuryNarrativeFormatterService.js - shared narrative formatting
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

import CharacterDataXmlBuilder from '../../../src/prompting/characterDataXmlBuilder.js';
import XmlElementBuilder from '../../../src/prompting/xmlElementBuilder.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';
const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'anatomy:gender';
const DISMEMBERED_COMPONENT_ID = 'anatomy:dismembered';

describe('LLM Prompt Injuries Narrative Consistency', () => {
  let logger;
  let entityManager;
  let bodyGraphService;
  let injuryAggregationService;
  let narrativeFormatterService;
  let characterDataXmlBuilder;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    entityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    bodyGraphService = {
      getAllParts: jest.fn(),
    };

    injuryAggregationService = new InjuryAggregationService({
      logger,
      entityManager,
      bodyGraphService,
    });

    narrativeFormatterService = new InjuryNarrativeFormatterService({
      logger,
    });

    const xmlElementBuilder = new XmlElementBuilder();
    characterDataXmlBuilder = new CharacterDataXmlBuilder({
      logger,
      xmlElementBuilder,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('narrative text consistency between game.html and LLM prompt', () => {
    it('should use identical text in LLM prompt injuries tag as InjuryNarrativeFormatterService.formatFirstPerson', () => {
      // Setup: Create an entity with injuries
      const entityId = 'test-entity';
      const armPartId = 'arm-part';
      const headPartId = 'head-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'female' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [armPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [headPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 60,
            maxHealth: 80,
            state: 'scratched',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([armPartId, headPartId]);

      // Step 1: Get the narrative from InjuryNarrativeFormatterService
      // (This is what game.html Physical Condition panel uses)
      const summary = injuryAggregationService.aggregateInjuries(entityId);
      const gameHtmlNarrative = narrativeFormatterService.formatFirstPerson(summary);

      // Step 2: Generate the LLM prompt XML
      const characterData = {
        name: 'Test Character',
        healthState: {
          overallHealthPercentage: summary.overallHealthPercentage,
          overallStatus: 'wounded',
          injuries: summary.injuredParts.map((part) => ({
            partName: part.partType,
            partType: part.partType,
            state: part.state,
            healthPercent: part.healthPercentage,
            effects: [],
          })),
          activeEffects: ['bleeding'],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: gameHtmlNarrative,
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Step 3: Extract the injuries element content from the XML
      const injuriesMatch = xmlResult.match(/<injuries>(.*?)<\/injuries>/s);
      expect(injuriesMatch).not.toBeNull();
      const llmPromptInjuriesText = injuriesMatch[1];

      // Step 4: Verify they are identical
      // (The XML builder escapes special characters, so we compare after unescaping)
      const unescapedLlmText = llmPromptInjuriesText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      expect(unescapedLlmText).toBe(gameHtmlNarrative);
    });

    it('should not include old technical <injury> elements', () => {
      const characterData = {
        name: 'Test Character',
        healthState: {
          overallHealthPercentage: 45,
          overallStatus: 'wounded',
          injuries: [
            { partName: 'left arm', partType: 'arm', state: 'wounded', healthPercent: 30, effects: ['bleeding'] },
          ],
          activeEffects: ['bleeding'],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: 'My left arm throbs painfully. Blood flows steadily from my left arm.',
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Should NOT contain old technical format
      expect(xmlResult).not.toContain('<injury part=');
      expect(xmlResult).not.toContain('</injury>');

      // Should contain new narrative format
      expect(xmlResult).toContain('<injuries>');
      expect(xmlResult).toContain('My left arm throbs painfully.');
      expect(xmlResult).toContain('</injuries>');
    });

    it('should not include redundant <active_effects> element', () => {
      const characterData = {
        name: 'Test Character',
        healthState: {
          overallHealthPercentage: 45,
          overallStatus: 'wounded',
          injuries: [],
          activeEffects: ['bleeding', 'poisoned'],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: 'The poison courses through my veins.',
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Should NOT contain active_effects element (info is in narrative)
      expect(xmlResult).not.toContain('<active_effects>');
      expect(xmlResult).not.toContain('</active_effects>');
    });

    it('should not include redundant <first_person_experience> element', () => {
      const characterData = {
        name: 'Test Character',
        healthState: {
          overallHealthPercentage: 45,
          overallStatus: 'wounded',
          injuries: [],
          activeEffects: [],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: 'Sharp pain radiates from my left arm.',
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Should NOT contain first_person_experience element (moved to injuries)
      expect(xmlResult).not.toContain('<first_person_experience>');
      expect(xmlResult).not.toContain('</first_person_experience>');

      // The narrative should be in injuries instead
      expect(xmlResult).toContain('<injuries>');
      expect(xmlResult).toContain('Sharp pain radiates from my left arm.');
    });
  });

  describe('edge cases', () => {
    it('should handle complex injury scenario with dismemberment and bleeding', () => {
      const entityId = 'complex-entity';
      const earPartId = 'ear-part';
      const torsoPartId = 'torso-part';
      const headPartId = 'head-part';
      const brainPartId = 'brain-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'male' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [earPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'ear',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 20,
            state: 'destroyed',
            turnsInState: 1,
          },
          [DISMEMBERED_COMPONENT_ID]: {
            dismemberedAt: Date.now(),
          },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 10,
            maxHealth: 100,
            state: 'critical',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [headPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            orientation: 'upper',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 40,
            maxHealth: 80,
            state: 'wounded',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [brainPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 90,
            maxHealth: 100,
            state: 'scratched',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([
        earPartId,
        torsoPartId,
        headPartId,
        brainPartId,
      ]);

      // Get game.html narrative
      const summary = injuryAggregationService.aggregateInjuries(entityId);
      const gameHtmlNarrative = narrativeFormatterService.formatFirstPerson(summary);

      // Build LLM prompt
      const characterData = {
        name: 'Test Character',
        healthState: {
          overallHealthPercentage: summary.overallHealthPercentage,
          overallStatus: 'critical',
          injuries: summary.injuredParts.map((part) => ({
            partName: part.partType,
            partType: part.partType,
            state: part.state,
            healthPercent: part.healthPercentage,
            effects: [],
          })),
          activeEffects: ['bleeding'],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: gameHtmlNarrative,
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Extract and verify
      const injuriesMatch = xmlResult.match(/<injuries>(.*?)<\/injuries>/s);
      expect(injuriesMatch).not.toBeNull();

      // The exact expected narrative
      const expectedNarrative = 'My right ear is missing. My torso screams with agony. My upper head throbs painfully. My brain stings slightly. Blood flows steadily from my torso and upper head.';

      expect(gameHtmlNarrative).toBe(expectedNarrative);

      // Verify XML contains the same text
      const llmPromptInjuriesText = injuriesMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      expect(llmPromptInjuriesText).toBe(expectedNarrative);
    });

    it('should handle dying state with critical warning', () => {
      const characterData = {
        name: 'Dying Character',
        healthState: {
          overallHealthPercentage: 5,
          overallStatus: 'dying',
          injuries: [],
          activeEffects: [],
          isDying: true,
          turnsUntilDeath: 2,
          firstPersonNarrative: null,
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Should include critical warning
      expect(xmlResult).toContain('<critical_warning>');
      expect(xmlResult).toContain('You are dying! 2 turns until death.');
      expect(xmlResult).toContain('</critical_warning>');

      // Should not have injuries element when no narrative
      expect(xmlResult).not.toContain('<injuries>');
    });

    it('should escape special XML characters in narrative', () => {
      const characterData = {
        name: 'Test Character',
        healthState: {
          overallHealthPercentage: 50,
          overallStatus: 'wounded',
          injuries: [],
          activeEffects: [],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: 'Pain in my "arm" & shoulder <sharp>.',
        },
      };

      const xmlResult = characterDataXmlBuilder.buildCharacterDataXml(characterData);

      // Should have escaped characters in injuries element
      expect(xmlResult).toContain('<injuries>');
      expect(xmlResult).toContain('&amp;');
      expect(xmlResult).toContain('&lt;sharp&gt;');
      expect(xmlResult).toContain('</injuries>');
    });
  });
});
