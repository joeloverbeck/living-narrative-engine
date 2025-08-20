/**
 * @file Integration tests for Core Motivations Generator HTML structure
 * Validates that the HTML page has all required elements and attributes
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

describe('Core Motivations Generator - HTML Structure', () => {
  let dom;
  let document;

  beforeAll(() => {
    // Read the HTML file
    const htmlPath = path.join(
      process.cwd(),
      'core-motivations-generator.html'
    );
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Parse HTML with JSDOM
    dom = new JSDOM(htmlContent);
    document = dom.window.document;
  });

  afterAll(() => {
    // Cleanup
    if (dom) {
      dom.window.close();
    }
  });

  describe('Document Structure', () => {
    it('should have correct DOCTYPE', () => {
      expect(dom.window.document.doctype.name).toBe('html');
    });

    it('should have lang attribute set to "en"', () => {
      const html = document.querySelector('html');
      expect(html.getAttribute('lang')).toBe('en');
    });

    it('should have correct title', () => {
      const title = document.querySelector('title');
      expect(title.textContent).toBe(
        'Core Motivations Generator - Living Narrative Engine'
      );
    });

    it('should have viewport meta tag', () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport).toBeTruthy();
      expect(viewport.getAttribute('content')).toContain('width=device-width');
    });

    it('should have description meta tag', () => {
      const description = document.querySelector('meta[name="description"]');
      expect(description).toBeTruthy();
      expect(description.getAttribute('content')).toContain('core motivations');
    });
  });

  describe('CSS Links', () => {
    it('should link to required CSS files', () => {
      const cssFiles = [
        'css/style.css',
        'css/components.css',
        'css/core-motivations-generator.css',
      ];

      cssFiles.forEach((file) => {
        const link = document.querySelector(`link[href="${file}"]`);
        expect(link).toBeTruthy();
        expect(link.getAttribute('rel')).toBe('stylesheet');
      });
    });
  });

  describe('JavaScript Module', () => {
    it('should have script tag for JavaScript bundle', () => {
      const script = document.querySelector(
        'script[src="core-motivations-generator.js"]'
      );
      expect(script).toBeTruthy();
      expect(script.getAttribute('type')).toBe('module');
    });
  });

  describe('Header Section', () => {
    it('should have header with correct structure', () => {
      const header = document.querySelector('.cb-page-header');
      expect(header).toBeTruthy();

      const h1 = header.querySelector('h1');
      expect(h1.textContent).toBe('Core Motivations Generator');

      const subtitle = header.querySelector('.header-subtitle');
      expect(subtitle).toBeTruthy();
      expect(subtitle.textContent).toContain('core motivations');
    });
  });

  describe('Main Content Structure', () => {
    it('should have main element with correct class', () => {
      const main = document.querySelector('main.core-motivations-main');
      expect(main).toBeTruthy();
    });

    it('should have direction selection panel', () => {
      const panel = document.querySelector('.direction-selection-panel');
      expect(panel).toBeTruthy();

      const title = panel.querySelector('.cb-panel-title');
      expect(title.textContent).toBe('Select Thematic Direction');
    });

    it('should have motivations display panel', () => {
      const panel = document.querySelector('.motivations-display-panel');
      expect(panel).toBeTruthy();

      const title = panel.querySelector('.cb-panel-title');
      expect(title.textContent).toBe('Core Motivations');
    });
  });

  describe('Direction Selector', () => {
    it('should have direction selector dropdown', () => {
      const selector = document.querySelector('#direction-selector');
      expect(selector).toBeTruthy();
      expect(selector.tagName).toBe('SELECT');
      expect(selector.getAttribute('aria-label')).toBe(
        'Select thematic direction'
      );
    });

    it('should have no directions message element', () => {
      const message = document.querySelector('#no-directions-message');
      expect(message).toBeTruthy();
      expect(message.style.display).toBe('none');
      expect(message.getAttribute('role')).toBe('alert');
    });

    it('should have link to clichés generator', () => {
      const link = document.querySelector('a[href="cliches-generator.html"]');
      expect(link).toBeTruthy();
    });
  });

  describe('Generation Controls', () => {
    it('should have generate button with correct attributes', () => {
      const btn = document.querySelector('#generate-btn');
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-label')).toBe('Generate core motivations');

      const text = btn.querySelector('.button-text');
      expect(text.textContent).toBe('Generate Motivations');
    });

    it('should have keyboard shortcut hint', () => {
      const hint = document.querySelector('.shortcut-hint');
      expect(hint).toBeTruthy();

      const kbds = hint.querySelectorAll('kbd');
      expect(kbds).toHaveLength(8);

      // Validate all keyboard shortcuts are present
      const kbdTexts = Array.from(kbds).map((kbd) => kbd.textContent);
      expect(kbdTexts).toEqual([
        'Ctrl',
        'Enter',
        'Ctrl',
        'E',
        'Ctrl',
        'Shift',
        'Del',
        'Esc',
      ]);
    });
  });

  describe('Panel Actions', () => {
    it('should have clear all button', () => {
      const btn = document.querySelector('#clear-all-btn');
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-label')).toBe('Clear all motivations');
    });

    it('should have export button', () => {
      const btn = document.querySelector('#export-btn');
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-label')).toBe('Export motivations to text');
    });
  });

  describe('Display States', () => {
    it('should have loading indicator', () => {
      const loading = document.querySelector('#loading-indicator');
      expect(loading).toBeTruthy();
      expect(loading.style.display).toBe('none');
      expect(loading.getAttribute('role')).toBe('status');

      const spinner = loading.querySelector('.spinner');
      expect(spinner).toBeTruthy();
    });

    it('should have motivations container', () => {
      const container = document.querySelector('#motivations-container');
      expect(container).toBeTruthy();
      expect(container.getAttribute('role')).toBe('region');
      expect(container.getAttribute('aria-label')).toBe(
        'Generated motivations'
      );
    });

    it('should have empty state', () => {
      const empty = document.querySelector('#empty-state');
      expect(empty).toBeTruthy();

      const text = empty.querySelector('.empty-state-text');
      expect(text.textContent).toContain('Generate Motivations');
    });
  });

  describe('Modal', () => {
    it('should have confirmation modal', () => {
      const modal = document.querySelector('#confirmation-modal');
      expect(modal).toBeTruthy();
      expect(modal.style.display).toBe('none');
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
    });

    it('should have modal title and actions', () => {
      const modal = document.querySelector('#confirmation-modal');

      const title = modal.querySelector('#modal-title');
      expect(title.textContent).toBe('Clear All Motivations?');

      const confirmBtn = modal.querySelector('#confirm-clear');
      expect(confirmBtn).toBeTruthy();

      const cancelBtn = modal.querySelector('#cancel-clear');
      expect(cancelBtn).toBeTruthy();
    });
  });

  describe('Toast Notification', () => {
    it('should have copy success toast', () => {
      const toast = document.querySelector('#copy-toast');
      expect(toast).toBeTruthy();
      expect(toast.style.display).toBe('none');
      expect(toast.getAttribute('role')).toBe('status');

      const message = toast.querySelector('.toast-message');
      expect(message.textContent).toBe('Copied to clipboard!');
    });
  });

  describe('Footer', () => {
    it('should have footer with navigation', () => {
      const footer = document.querySelector('.cb-page-footer');
      expect(footer).toBeTruthy();

      const backBtn = footer.querySelector('#back-btn');
      expect(backBtn).toBeTruthy();
      expect(backBtn.getAttribute('aria-label')).toBe(
        'Back to Character Builder'
      );
    });

    it('should have motivation count display', () => {
      const count = document.querySelector('#motivation-count');
      expect(count).toBeTruthy();
      expect(count.textContent.trim()).toBe('0 motivations generated');
    });
  });

  describe('Accessibility', () => {
    it('should have ARIA labels on all interactive elements', () => {
      const interactiveElements = document.querySelectorAll('button, select');

      interactiveElements.forEach((element) => {
        const hasAriaLabel =
          element.hasAttribute('aria-label') ||
          element.querySelector('[aria-label]') ||
          element.textContent.trim().length > 0;
        expect(hasAriaLabel).toBe(true);
      });
    });

    it('should have ARIA live regions for dynamic content', () => {
      const liveRegions = document.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);

      // Check specific live regions
      const noDirections = document.querySelector('#no-directions-message');
      expect(noDirections.getAttribute('aria-live')).toBe('polite');

      const loading = document.querySelector('#loading-indicator');
      expect(loading.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Favicon Links', () => {
    it('should have all favicon links', () => {
      const faviconLinks = [
        { sizes: '32x32', href: '/favicon-32x32.png' },
        { sizes: '16x16', href: '/favicon-16x16.png' },
      ];

      faviconLinks.forEach(({ sizes, href }) => {
        const link = document.querySelector(`link[sizes="${sizes}"]`);
        expect(link).toBeTruthy();
        expect(link.getAttribute('href')).toBe(href);
      });

      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      expect(appleIcon).toBeTruthy();

      const manifest = document.querySelector('link[rel="manifest"]');
      expect(manifest).toBeTruthy();
    });
  });
});
