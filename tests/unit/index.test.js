/**
 * @file Tests for main index.html page
 * @see index.html
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Index.html - Main Menu', () => {
  let dom;
  let document;

  beforeEach(() => {
    // Read the actual HTML file
    const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

    // Create DOM without running scripts
    dom = new JSDOM(html);
    document = dom.window.document;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Mod Manager Button', () => {
    it('should have Mod Manager button', () => {
      const button = document.getElementById('mod-manager-button');
      expect(button).not.toBeNull();
      // Check for text content within button-text span
      const buttonText = button.querySelector('.button-text');
      expect(buttonText).not.toBeNull();
      expect(buttonText.textContent.trim()).toBe('Mod Manager');
      expect(button.classList.contains('menu-button')).toBe(true);
    });

    it('should position Mod Manager button before Start New Game', () => {
      const buttons = document.querySelectorAll('.menu-button');
      const buttonTexts = Array.from(buttons).map((btn) => {
        const textSpan = btn.querySelector('.button-text');
        return textSpan ? textSpan.textContent.trim() : btn.textContent.trim();
      });

      const modManagerIndex = buttonTexts.indexOf('Mod Manager');
      const startNewGameIndex = buttonTexts.indexOf('Start New Game');

      expect(modManagerIndex).toBeGreaterThan(-1);
      expect(startNewGameIndex).toBeGreaterThan(-1);
      expect(modManagerIndex).toBeLessThan(startNewGameIndex);
    });

    it('should have correct event listener setup in script for Mod Manager', () => {
      // Get the second script tag which contains the inline event listeners
      const scripts = document.querySelectorAll('script');
      const scriptContent = scripts[1] ? scripts[1].textContent : '';

      // Check that the script contains the event listener for mod-manager-button
      expect(scriptContent).toContain("getElementById('mod-manager-button')");
      expect(scriptContent).toContain("addEventListener('click'");
      expect(scriptContent).toContain(
        "window.location.href = 'mod-manager.html'"
      );
    });
  });

  describe('Character Concepts Manager Button', () => {
    it('should have Character Concepts Manager button', () => {
      const button = document.getElementById('character-concepts-button');
      expect(button).not.toBeNull();
      // Check for text content within button-text span
      const buttonText = button.querySelector('.button-text');
      expect(buttonText).not.toBeNull();
      expect(buttonText.textContent.trim()).toBe('Character Concepts Manager');
      expect(button.classList.contains('menu-button')).toBe(true);
    });

    it('should position Character Concepts Manager button above Thematic Direction Generator', () => {
      const buttons = document.querySelectorAll('.menu-button');
      const buttonTexts = Array.from(buttons).map((btn) => {
        const textSpan = btn.querySelector('.button-text');
        return textSpan ? textSpan.textContent.trim() : btn.textContent.trim();
      });

      const characterConceptsIndex = buttonTexts.indexOf(
        'Character Concepts Manager'
      );
      const thematicDirectionIndex = buttonTexts.indexOf(
        'Thematic Direction Generator'
      );

      expect(characterConceptsIndex).toBeGreaterThan(-1);
      expect(thematicDirectionIndex).toBeGreaterThan(-1);
      expect(characterConceptsIndex).toBeLessThan(thematicDirectionIndex);
    });

    it('should have correct event listener setup in script', () => {
      // Get the second script tag which contains the inline event listeners
      const scripts = document.querySelectorAll('script');
      const scriptContent = scripts[1] ? scripts[1].textContent : '';

      // Check that the script contains the event listener for character-concepts-button
      expect(scriptContent).toContain(
        "getElementById('character-concepts-button')"
      );
      expect(scriptContent).toContain("addEventListener('click'");
      expect(scriptContent).toContain(
        "window.location.href = 'character-concepts-manager.html'"
      );
    });
  });

  describe('All Menu Buttons', () => {
    it('should have all expected menu buttons in correct order', () => {
      const buttons = document.querySelectorAll('.menu-button');
      const expectedButtons = [
        'Mod Manager',
        'Start New Game',
        'Load Game',
        'Anatomy Visualizer',
        'Change LLM',
        'Character Concepts Manager',
        'Thematic Direction Generator',
        'Thematic Directions Manager',
        'Clichés Generator',
        'Core Motivations Generator',
        'Traits Generator',
        'Speech Patterns Generator',
        'Traits Rewriter',
      ];

      const actualButtons = Array.from(buttons).map((btn) => {
        const textSpan = btn.querySelector('.button-text');
        return textSpan ? textSpan.textContent.trim() : btn.textContent.trim();
      });
      expect(actualButtons).toEqual(expectedButtons);
    });

    it('should have correct button IDs', () => {
      const buttonConfigs = [
        { id: 'mod-manager-button', text: 'Mod Manager' },
        { id: 'start-button', text: 'Start New Game' },
        { id: 'load-button', text: 'Load Game' },
        { id: 'anatomy-button', text: 'Anatomy Visualizer' },
        { id: 'change-llm-button', text: 'Change LLM' },
        { id: 'character-concepts-button', text: 'Character Concepts Manager' },
        {
          id: 'thematic-direction-button',
          text: 'Thematic Direction Generator',
        },
        {
          id: 'thematic-directions-manager-button',
          text: 'Thematic Directions Manager',
        },
        { id: 'cliches-generator-button', text: 'Clichés Generator' },
        { id: 'core-motivations-button', text: 'Core Motivations Generator' },
        { id: 'traits-generator-button', text: 'Traits Generator' },
        {
          id: 'speech-patterns-generator-button',
          text: 'Speech Patterns Generator',
        },
        { id: 'traits-rewriter-button', text: 'Traits Rewriter' },
      ];

      buttonConfigs.forEach(({ id, text }) => {
        const button = document.getElementById(id);
        expect(button).not.toBeNull();
        const buttonText = button.querySelector('.button-text');
        if (buttonText) {
          expect(buttonText.textContent.trim()).toBe(text);
        } else {
          expect(button.textContent.trim()).toBe(text);
        }
      });
    });

    it('should have event listeners for all buttons in script', () => {
      // Get the second script tag which contains the inline event listeners
      const scripts = document.querySelectorAll('script');
      const scriptContent = scripts[1] ? scripts[1].textContent : '';

      const buttonConfigs = [
        { id: 'mod-manager-button', href: 'mod-manager.html' },
        { id: 'start-button', href: 'game.html' },
        { id: 'load-button', href: 'game.html?load=true' },
        { id: 'anatomy-button', href: 'anatomy-visualizer.html' },
        {
          id: 'character-concepts-button',
          href: 'character-concepts-manager.html',
        },
        {
          id: 'thematic-direction-button',
          href: 'thematic-direction-generator.html',
        },
        {
          id: 'thematic-directions-manager-button',
          href: 'thematic-directions-manager.html',
        },
        { id: 'cliches-generator-button', href: 'cliches-generator.html' },
        {
          id: 'core-motivations-button',
          href: 'core-motivations-generator.html',
        },
        { id: 'traits-generator-button', href: 'traits-generator.html' },
        {
          id: 'speech-patterns-generator-button',
          href: 'speech-patterns-generator.html',
        },
        { id: 'traits-rewriter-button', href: 'traits-rewriter.html' },
        // Note: change-llm-button is handled by the external module, not inline script
      ];

      buttonConfigs.forEach(({ id, href }) => {
        expect(scriptContent).toContain(`getElementById('${id}')`);
        expect(scriptContent).toContain(`window.location.href = '${href}'`);
      });
    });
  });

  describe('UI Redesign Elements', () => {
    it('should have header with logo and tagline', () => {
      const header = document.querySelector('.main-header');
      expect(header).not.toBeNull();

      const logo = header.querySelector('.logo');
      expect(logo).not.toBeNull();
      expect(logo.getAttribute('src')).toBe('android-chrome-192x192.png');

      const title = header.querySelector('.main-title');
      expect(title).not.toBeNull();
      expect(title.textContent.trim()).toBe('Living Narrative Engine');

      const tagline = header.querySelector('.tagline');
      expect(tagline).not.toBeNull();
      expect(tagline.textContent.trim()).toBe('Create immersive narratives');
    });

    it('should have categorized sections', () => {
      const gameSection = document.querySelector('.button-category--game');
      expect(gameSection).not.toBeNull();

      const anatomySection = document.querySelector(
        '.button-category--anatomy'
      );
      expect(anatomySection).not.toBeNull();

      const characterSection = document.querySelector(
        '.button-category--character'
      );
      expect(characterSection).not.toBeNull();
    });

    it('should have icons for all buttons', () => {
      const buttons = document.querySelectorAll('.menu-button');
      buttons.forEach((button) => {
        const icon = button.querySelector('.button-icon');
        expect(icon).not.toBeNull();
        expect(icon.textContent.trim()).not.toBe('');
      });
    });

    it('should have proper ARIA labels', () => {
      const sections = document.querySelectorAll('.button-category');
      sections.forEach((section) => {
        const ariaLabel = section.getAttribute('aria-labelledby');
        expect(ariaLabel).not.toBeNull();
        const labelElement = document.getElementById(ariaLabel);
        expect(labelElement).not.toBeNull();
      });
    });
  });
});
