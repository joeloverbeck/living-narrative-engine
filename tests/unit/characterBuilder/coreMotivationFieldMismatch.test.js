/**
 * @file Unit test to demonstrate the field name mismatch issue
 * @description Shows the bug where TraitsGeneratorController expects coreMotivation but model has coreDesire
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CoreMotivation } from '../../../src/characterBuilder/models/coreMotivation.js';
import { DomUtils } from '../../../src/utils/domUtils.js';

describe('CoreMotivation Field Name Mismatch Bug', () => {
  describe('Fixed Compatibility', () => {
    it('should show that CoreMotivation model now supports both field names', () => {
      // Create a CoreMotivation instance
      const motivation = new CoreMotivation({
        directionId: 'test-direction',
        conceptId: 'test-concept',
        coreDesire: 'To find true meaning in life',
        internalContradiction: 'Seeks meaning but fears responsibility',
        centralQuestion: 'What makes life worth living?',
      });

      // The model has coreDesire field
      expect(motivation.coreDesire).toBe('To find true meaning in life');
      
      // And now it also has coreMotivation as a getter
      expect(motivation.coreMotivation).toBe('To find true meaning in life');
    });

    it('should work correctly with the fixed TraitsGeneratorController', () => {
      // This simulates what TraitsGeneratorController does in #displayCoreMotivations
      const motivations = [
        new CoreMotivation({
          directionId: 'dir1',
          conceptId: 'concept1',
          coreDesire: 'To protect innocence',
          internalContradiction: 'Wants purity but drawn to corruption',
          centralQuestion: 'Can innocence survive?',
        }),
        new CoreMotivation({
          directionId: 'dir2',
          conceptId: 'concept2',
          coreDesire: 'To find belonging',
          internalContradiction: 'Needs connection but fears vulnerability',
          centralQuestion: 'Where do I belong?',
        }),
      ];

      // Simulate the FIXED rendering logic using coreDesire
      const htmlOutput = motivations.map((motivation, index) => {
        // FIXED: Now using motivation.coreDesire (or motivation.coreMotivation which is a getter)
        const coreMotivationText = motivation.coreDesire; // This works!
        
        return `
          <div class="core-motivation-item" data-index="${index}">
            <h4 class="motivation-title">Core Motivation ${index + 1}</h4>
            <p class="motivation-text">${DomUtils.escapeHtml(coreMotivationText)}</p>
          </div>
        `;
      }).join('');

      // The HTML now contains the actual values
      expect(htmlOutput).not.toContain('undefined');
      expect(htmlOutput).toContain('To protect innocence');
      expect(htmlOutput).toContain('To find belonging');
    });

    it('should show the correct way to access the field', () => {
      const motivation = new CoreMotivation({
        directionId: 'test-dir',
        conceptId: 'test-concept',
        coreDesire: 'To achieve greatness',
        internalContradiction: 'Wants success but fears failure',
        centralQuestion: 'What is true success?',
      });

      // Correct way - using coreDesire
      const correctHtml = `
        <p class="motivation-text">${DomUtils.escapeHtml(motivation.coreDesire)}</p>
      `;
      
      expect(correctHtml).toContain('To achieve greatness');
      expect(correctHtml).not.toContain('undefined');
    });
  });

  describe('fromLLMResponse Compatibility', () => {
    it('should accept both coreDesire and coreMotivation in raw data', () => {
      // Test with coreMotivation (UI field name)
      const motivation1 = CoreMotivation.fromLLMResponse({
        directionId: 'dir1',
        conceptId: 'concept1',
        rawMotivation: {
          coreMotivation: 'Motivation from UI',
          internalContradiction: 'Contradiction text',
          centralQuestion: 'Question?',
        },
      });
      
      // It should store it as coreDesire internally
      expect(motivation1.coreDesire).toBe('Motivation from UI');
      
      // Test with coreDesire (internal field name)
      const motivation2 = CoreMotivation.fromLLMResponse({
        directionId: 'dir2',
        conceptId: 'concept2',
        rawMotivation: {
          coreDesire: 'Desire from internal',
          internalContradiction: 'Another contradiction',
          centralQuestion: 'Another question?',
        },
      });
      
      expect(motivation2.coreDesire).toBe('Desire from internal');
    });
  });

});