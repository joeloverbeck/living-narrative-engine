/**
 * @file Integration test for character limit validation in Character Concepts Manager
 * @description Tests the character limit mismatch issue between frontend (3000) and backend
 * @see ../../../character-concepts-manager.html
 * @see ../../../src/domUI/characterConceptsManagerController.js
 * @see ../../../src/characterBuilder/models/characterConcept.js
 */

import { describe, it, expect } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';

describe('Character Concepts Manager - Character Limit Integration', () => {
  describe('Frontend HTML Validation', () => {
    it('should have maxlength=6000 in HTML', () => {
      // Load the HTML file
      const htmlPath = path.join(
        process.cwd(),
        'character-concepts-manager.html'
      );
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      // Create JSDOM instance
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;

      // Check the textarea
      const conceptTextarea = document.getElementById('concept-text');
      expect(conceptTextarea).toBeTruthy();
      expect(conceptTextarea.getAttribute('maxlength')).toBe('6000');
      expect(conceptTextarea.getAttribute('minlength')).toBe('10');

      // Check the character counter
      const charCount = document.getElementById('char-count');
      expect(charCount).toBeTruthy();
      expect(charCount.textContent).toBe('0/6000');

      dom.window.close();
    });
  });

  describe('Backend Model Validation', () => {
    it('should accept concepts up to 6000 characters matching frontend', () => {
      // Test various lengths up to the frontend limit
      const testCases = [
        { length: 10, description: 'minimum length' },
        { length: 1000, description: 'previous backend limit' },
        { length: 1157, description: 'problematic length from error log' },
        { length: 1500, description: 'mid-range length' },
        { length: 2000, description: 'higher length' },
        { length: 2500, description: 'near old maximum' },
        { length: 3000, description: 'old maximum' },
        { length: 4000, description: 'mid-range in new limit' },
        { length: 5000, description: 'near new maximum' },
        { length: 6000, description: 'exact maximum matching frontend' },
      ];

      testCases.forEach(({ length }) => {
        const concept = 'a'.repeat(length);
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(length);
        expect(result.id).toBeDefined();
        expect(result.status).toBe('draft');
      });
    });

    it('should reject concepts over 6000 characters', () => {
      const tooLongConcept = 'a'.repeat(6001);

      expect(() => createCharacterConcept(tooLongConcept)).toThrow(
        'CharacterConcept: concept must be no more than 6000 characters long'
      );
    });

    it('should reject concepts under 10 characters', () => {
      const tooShortConcept = 'a'.repeat(9);

      expect(() => createCharacterConcept(tooShortConcept)).toThrow(
        'CharacterConcept: concept must be at least 10 characters long'
      );
    });
  });

  describe('Real-world Scenario', () => {
    it('should handle the actual failing concept from error log', () => {
      // This simulates the real-world scenario from the error log
      const realWorldConcept = `a 20-year-old young woman with a shapely, athletic figure and a gorgeous ass. She lives in Donostia, 
      a beautiful coastal city where she works as a fitness instructor. Her passion for health and wellness 
      extends beyond her professional life, as she enjoys surfing at La Concha beach during sunrise and 
      practicing yoga in the evening. Despite her confident exterior, she struggles with the expectations 
      placed on her by her traditional family, who want her to pursue a more conventional career path. 
      She dreams of opening her own wellness retreat center someday, combining her love for fitness with 
      holistic healing practices she's been studying. Her apartment overlooks the bay, filled with plants 
      and natural light, reflecting her connection to nature. She speaks three languages fluently and has 
      a small tattoo of a wave on her ankle, symbolizing her free spirit and love for the ocean.`;

      // This concept should now be accepted
      const result = createCharacterConcept(realWorldConcept);

      expect(result).toBeDefined();
      expect(result.concept).toBe(realWorldConcept.trim());
      expect(result.concept.length).toBeLessThanOrEqual(6000);
      expect(result.concept.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Character Limit Consistency', () => {
    it('should have consistent limits between frontend and backend', () => {
      // Load HTML to get frontend limit
      const htmlPath = path.join(
        process.cwd(),
        'character-concepts-manager.html'
      );
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      const conceptTextarea = document.getElementById('concept-text');
      const frontendMaxLength = parseInt(
        conceptTextarea.getAttribute('maxlength')
      );

      // Test that backend accepts the frontend maximum
      const maxConcept = 'a'.repeat(frontendMaxLength);
      const result = createCharacterConcept(maxConcept);
      expect(result.concept.length).toBe(frontendMaxLength);

      // Test that backend rejects one character over frontend maximum
      const overMaxConcept = 'a'.repeat(frontendMaxLength + 1);
      expect(() => createCharacterConcept(overMaxConcept)).toThrow(
        `CharacterConcept: concept must be no more than ${frontendMaxLength} characters long`
      );

      dom.window.close();
    });
  });
});
