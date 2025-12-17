/**
 * @file Tests for mod-manager.html structure validation
 * @description Validates the HTML entry point structure, accessibility attributes,
 * and required elements for the Mod Manager page.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('mod-manager.html structure', () => {
  let htmlContent;

  beforeAll(() => {
    const htmlPath = join(process.cwd(), 'mod-manager.html');
    htmlContent = readFileSync(htmlPath, 'utf-8');
  });

  describe('HTML document structure', () => {
    it('should have HTML5 doctype', () => {
      expect(htmlContent).toMatch(/^<!doctype html>/i);
    });

    it('should have lang attribute on html element', () => {
      expect(htmlContent).toMatch(/<html\s+lang="en">/);
    });

    it('should have required meta charset', () => {
      expect(htmlContent).toContain('charset="UTF-8"');
    });

    it('should have viewport meta tag', () => {
      expect(htmlContent).toContain('name="viewport"');
      expect(htmlContent).toContain('width=device-width');
    });

    it('should have description meta tag', () => {
      expect(htmlContent).toContain('name="description"');
      expect(htmlContent).toContain('Mod Manager - Living Narrative Engine');
    });

    it('should have proper title', () => {
      expect(htmlContent).toMatch(/<title>Mod Manager - Living Narrative Engine<\/title>/);
    });
  });

  describe('favicon and manifest links', () => {
    it('should have apple-touch-icon', () => {
      expect(htmlContent).toContain('apple-touch-icon');
    });

    it('should have favicon links', () => {
      expect(htmlContent).toContain('favicon-32x32.png');
      expect(htmlContent).toContain('favicon-16x16.png');
    });

    it('should have webmanifest link', () => {
      expect(htmlContent).toContain('site.webmanifest');
    });
  });

  describe('CSS references', () => {
    it('should link to base style.css', () => {
      expect(htmlContent).toContain('href="css/style.css"');
    });

    it('should link to mod-manager specific CSS', () => {
      expect(htmlContent).toContain('href="css/mod-manager.css"');
    });
  });

  describe('required element IDs', () => {
    const requiredIds = [
      'mod-manager-root',
      'back-button',
      'save-config-btn',
      'mod-search',
      'mod-list',
      'world-list',
      'summary-content',
      'active-mod-count',
      'explicit-mod-count',
      'dependency-mod-count',
      'conflict-count',
      'selected-world',
      'status-message',
      'error-modal',
      'error-title',
      'error-message',
      'error-close-btn',
    ];

    it.each(requiredIds)('should have element with id="%s"', (id) => {
      expect(htmlContent).toContain(`id="${id}"`);
    });
  });

  describe('accessibility attributes', () => {
    it('should have aria-labelledby for mod list section', () => {
      expect(htmlContent).toContain('aria-labelledby="mods-heading"');
    });

    it('should have aria-labelledby for world section', () => {
      expect(htmlContent).toContain('aria-labelledby="worlds-heading"');
    });

    it('should have aria-labelledby for summary section', () => {
      expect(htmlContent).toContain('aria-labelledby="summary-heading"');
    });

    it('should have aria-label on search input', () => {
      expect(htmlContent).toContain('aria-label="Search mods"');
    });

    it('should have aria-live regions for dynamic content', () => {
      expect(htmlContent).toContain('aria-live="polite"');
    });

    it('should have role="list" on mod list', () => {
      expect(htmlContent).toContain('role="list"');
    });

    it('should have role="listbox" on world list', () => {
      expect(htmlContent).toContain('role="listbox"');
    });

    it('should have role="dialog" on error modal', () => {
      expect(htmlContent).toContain('role="dialog"');
    });

    it('should have aria-modal on error modal', () => {
      expect(htmlContent).toContain('aria-modal="true"');
    });
  });

  describe('button attributes', () => {
    it('should have type="button" on interactive buttons', () => {
      // All buttons should have explicit type to prevent form submission
      const buttonMatches = htmlContent.match(/<button[^>]*>/g) || [];
      const buttonsWithType = buttonMatches.filter((b) =>
        b.includes('type="button"')
      );
      expect(buttonsWithType.length).toBe(buttonMatches.length);
    });

    it('should have disabled attribute on save button initially', () => {
      expect(htmlContent).toMatch(
        /id="save-config-btn"[^>]*disabled/
      );
    });
  });

  describe('script reference', () => {
    it('should reference mod-manager.js as module', () => {
      expect(htmlContent).toContain('type="module"');
      expect(htmlContent).toContain('src="mod-manager.js"');
    });

    it('should have script at end of body', () => {
      // Script should be just before closing body tag
      expect(htmlContent).toMatch(/<script[^>]*>.*<\/script>\s*<\/body>/s);
    });
  });

  describe('modal structure', () => {
    it('should have error modal hidden by default', () => {
      expect(htmlContent).toMatch(
        /id="error-modal"[^>]*style="display:\s*none"/
      );
    });

    it('should have modal-overlay class on error modal', () => {
      expect(htmlContent).toMatch(/id="error-modal"[^>]*class="modal-overlay"/);
    });
  });

  describe('semantic structure', () => {
    it('should have header element', () => {
      expect(htmlContent).toContain('<header');
      expect(htmlContent).toContain('</header>');
    });

    it('should have main element', () => {
      expect(htmlContent).toContain('<main');
      expect(htmlContent).toContain('</main>');
    });

    it('should have footer element', () => {
      expect(htmlContent).toContain('<footer');
      expect(htmlContent).toContain('</footer>');
    });

    it('should have aside element for side panel', () => {
      expect(htmlContent).toContain('<aside');
      expect(htmlContent).toContain('</aside>');
    });

    it('should use section elements with headings', () => {
      expect(htmlContent).toContain('<section');
      expect(htmlContent).toContain('</section>');
    });

    it('should use dl/dt/dd for summary content', () => {
      expect(htmlContent).toContain('<dl');
      expect(htmlContent).toContain('<dt>');
      expect(htmlContent).toContain('<dd');
    });
  });
});
