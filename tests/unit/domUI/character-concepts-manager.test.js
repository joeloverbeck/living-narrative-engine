/**
 * @file Unit tests for Character Concepts Manager HTML structure
 * @see ../../../character-concepts-manager.html
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Character Concepts Manager HTML Structure', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Load the HTML file
    const htmlPath = path.join(
      process.cwd(),
      'character-concepts-manager.html'
    );
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Create JSDOM instance
    dom = new JSDOM(htmlContent, {
      contentType: 'text/html',
      pretendToBeVisual: true,
    });

    document = dom.window.document;
    window = dom.window;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Document Structure', () => {
    it('should have valid HTML5 doctype', () => {
      expect(dom.serialize()).toMatch(/^<!DOCTYPE html>/i);
    });

    it('should have proper meta tags', () => {
      const charset = document.querySelector('meta[charset]');
      expect(charset?.getAttribute('charset')).toBe('UTF-8');

      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport?.getAttribute('content')).toBe(
        'width=device-width, initial-scale=1.0'
      );
    });

    it('should have correct title', () => {
      expect(document.title).toBe(
        'Character Concepts Manager - Living Narrative Engine'
      );
    });

    it('should include required stylesheets', () => {
      const stylesheets = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
      );
      const hrefs = stylesheets.map((link) => link.getAttribute('href'));

      expect(hrefs).toContain('css/style.css');
      expect(hrefs).toContain('css/components.css');
      expect(hrefs).toContain('css/character-concepts-manager.css');
    });

    it('should include favicon links', () => {
      const favicon32 = document.querySelector('link[sizes="32x32"]');
      const favicon16 = document.querySelector('link[sizes="16x16"]');
      const appleTouch = document.querySelector('link[rel="apple-touch-icon"]');

      expect(favicon32).toBeTruthy();
      expect(favicon16).toBeTruthy();
      expect(appleTouch).toBeTruthy();
    });

    it('should include script tag for JavaScript', () => {
      const script = document.querySelector(
        'script[src="character-concepts-manager.js"]'
      );
      expect(script).toBeTruthy();
    });
  });

  describe('Page Container', () => {
    it('should have main container with proper classes', () => {
      const container = document.getElementById(
        'character-concepts-manager-container'
      );
      expect(container).toBeTruthy();
      expect(container.classList.contains('cb-page-container')).toBe(true);
    });

    it('should have header with proper structure', () => {
      const header = document.querySelector('.cb-page-header');
      expect(header).toBeTruthy();

      const headerContent = header.querySelector('.header-content');
      expect(headerContent).toBeTruthy();

      const title = headerContent.querySelector('h1');
      expect(title?.textContent).toBe('Character Concepts Manager');

      const subtitle = headerContent.querySelector('.header-subtitle');
      expect(subtitle?.textContent.trim()).toBe(
        'Create, organize, and manage your character concepts'
      );
    });

    it('should have main content with proper structure', () => {
      const main = document.querySelector('.cb-page-main');
      expect(main).toBeTruthy();
      expect(main.classList.contains('character-concepts-manager-main')).toBe(
        true
      );
    });

    it('should have footer with proper structure', () => {
      const footer = document.querySelector('.cb-page-footer');
      expect(footer).toBeTruthy();

      const footerContent = footer.querySelector('.footer-content');
      expect(footerContent).toBeTruthy();

      const backButton = footerContent.querySelector('#back-to-menu-btn');
      expect(backButton).toBeTruthy();
      expect(backButton.classList.contains('cb-button-secondary')).toBe(true);
    });
  });

  describe('Left Panel - Controls', () => {
    let controlsPanel;

    beforeEach(() => {
      controlsPanel = document.querySelector('.concept-controls-panel');
    });

    it('should have controls panel with proper classes', () => {
      expect(controlsPanel).toBeTruthy();
      expect(controlsPanel.classList.contains('cb-input-panel')).toBe(true);
    });

    it('should have panel title', () => {
      const title = controlsPanel.querySelector('.cb-panel-title');
      expect(title?.textContent).toBe('Concept Management');
    });

    it('should have create concept button', () => {
      const createBtn = controlsPanel.querySelector('#create-concept-btn');
      expect(createBtn).toBeTruthy();
      expect(createBtn.classList.contains('cb-button-primary')).toBe(true);
      expect(createBtn.textContent.trim()).toBe('➕ New Concept');
    });

    it('should have search input with proper attributes', () => {
      const searchInput = controlsPanel.querySelector('#concept-search');
      expect(searchInput).toBeTruthy();
      expect(searchInput.classList.contains('cb-input')).toBe(true);
      expect(searchInput.getAttribute('placeholder')).toBe(
        'Search by content...'
      );

      const label = controlsPanel.querySelector('label[for="concept-search"]');
      expect(label?.textContent).toBe('Search Concepts:');
    });

    it('should have statistics display', () => {
      const statsDisplay = controlsPanel.querySelector('.stats-display');
      expect(statsDisplay).toBeTruthy();

      const statsTitle = statsDisplay.querySelector('h3');
      expect(statsTitle?.textContent).toBe('Statistics');

      // Check stat items
      const totalConcepts = document.getElementById('total-concepts');
      const conceptsWithDirections = document.getElementById(
        'concepts-with-directions'
      );
      const totalDirections = document.getElementById('total-directions');

      expect(totalConcepts).toBeTruthy();
      expect(conceptsWithDirections).toBeTruthy();
      expect(totalDirections).toBeTruthy();
    });
  });

  describe('Right Panel - Concepts Display', () => {
    let displayPanel;

    beforeEach(() => {
      displayPanel = document.querySelector('.concepts-display-panel');
    });

    it('should have display panel with proper classes', () => {
      expect(displayPanel).toBeTruthy();
      expect(displayPanel.classList.contains('cb-results-panel')).toBe(true);
    });

    it('should have panel title', () => {
      const title = displayPanel.querySelector('.cb-panel-title');
      expect(title?.textContent).toBe('Character Concepts');
    });

    it('should have concepts container', () => {
      const container = document.getElementById('concepts-container');
      expect(container).toBeTruthy();
      expect(container.classList.contains('cb-state-container')).toBe(true);
    });
  });

  describe('State Containers', () => {
    it('should have empty state container', () => {
      const emptyState = document.getElementById('empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.classList.contains('cb-empty-state')).toBe(true);

      const createFirstBtn = emptyState.querySelector('#create-first-btn');
      expect(createFirstBtn).toBeTruthy();
      expect(createFirstBtn.classList.contains('cb-button-primary')).toBe(true);
    });

    it('should have loading state container', () => {
      const loadingState = document.getElementById('loading-state');
      expect(loadingState).toBeTruthy();
      expect(loadingState.classList.contains('cb-loading-state')).toBe(true);
      expect(loadingState.style.display).toBe('none');

      const spinner = loadingState.querySelector('.spinner.large');
      expect(spinner).toBeTruthy();
    });

    it('should have error state container', () => {
      const errorState = document.getElementById('error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.classList.contains('cb-error-state')).toBe(true);
      expect(errorState.style.display).toBe('none');

      const retryBtn = errorState.querySelector('#retry-btn');
      expect(retryBtn).toBeTruthy();
      expect(retryBtn.classList.contains('cb-button-secondary')).toBe(true);
    });

    it('should have results state container', () => {
      const resultsState = document.getElementById('results-state');
      expect(resultsState).toBeTruthy();
      expect(resultsState.style.display).toBe('none');

      const conceptsGrid = resultsState.querySelector('#concepts-results');
      expect(conceptsGrid).toBeTruthy();
      expect(conceptsGrid.classList.contains('concepts-grid')).toBe(true);
    });
  });

  describe('Create/Edit Concept Modal', () => {
    let modal;

    beforeEach(() => {
      modal = document.getElementById('concept-modal');
    });

    it('should have modal with proper accessibility attributes', () => {
      expect(modal).toBeTruthy();
      expect(modal.classList.contains('modal')).toBe(true);
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-labelledby')).toBe('concept-modal-title');
      expect(modal.style.display).toBe('none');
    });

    it('should have modal header with title and close button', () => {
      const header = modal.querySelector('.modal-header');
      expect(header).toBeTruthy();

      const title = header.querySelector('#concept-modal-title');
      expect(title?.textContent).toBe('Create Character Concept');

      const closeBtn = header.querySelector('#close-concept-modal');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn.classList.contains('close-modal')).toBe(true);
      expect(closeBtn.getAttribute('aria-label')).toBe('Close modal');
    });

    it('should have concept form with proper structure', () => {
      const form = modal.querySelector('#concept-form');
      expect(form).toBeTruthy();
      expect(form.getAttribute('novalidate')).toBe('');
    });

    it('should have concept textarea with validation attributes', () => {
      const textarea = modal.querySelector('#concept-text');
      expect(textarea).toBeTruthy();
      expect(textarea.classList.contains('cb-textarea')).toBe(true);
      expect(textarea.getAttribute('name')).toBe('conceptText');
      expect(textarea.getAttribute('minlength')).toBe('10');
      expect(textarea.getAttribute('maxlength')).toBe('6000');
      expect(textarea.getAttribute('required')).toBe('');
      expect(textarea.getAttribute('aria-describedby')).toBe(
        'concept-help concept-error'
      );

      const label = modal.querySelector('label[for="concept-text"]');
      expect(label).toBeTruthy();
      expect(label.textContent).toContain('Character Concept:');
    });

    it('should have help text and character counter', () => {
      const helpText = modal.querySelector('#concept-help');
      expect(helpText).toBeTruthy();
      expect(helpText.classList.contains('input-help')).toBe(true);

      const charCount = modal.querySelector('#char-count');
      expect(charCount).toBeTruthy();
      expect(charCount.classList.contains('char-count')).toBe(true);
      expect(charCount.textContent).toBe('0/6000');

      const errorDiv = modal.querySelector('#concept-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('polite');
    });

    it('should have modal action buttons', () => {
      const actions = modal.querySelector('.modal-actions');
      expect(actions).toBeTruthy();

      const saveBtn = actions.querySelector('#save-concept-btn');
      expect(saveBtn).toBeTruthy();
      expect(saveBtn.classList.contains('cb-button-primary')).toBe(true);
      expect(saveBtn.getAttribute('type')).toBe('submit');
      expect(saveBtn.hasAttribute('disabled')).toBe(true);

      const cancelBtn = actions.querySelector('#cancel-concept-btn');
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn.classList.contains('cb-button-secondary')).toBe(true);
      expect(cancelBtn.getAttribute('type')).toBe('button');
    });
  });

  describe('Delete Confirmation Modal', () => {
    let deleteModal;

    beforeEach(() => {
      deleteModal = document.getElementById('delete-confirmation-modal');
    });

    it('should have delete modal with proper accessibility attributes', () => {
      expect(deleteModal).toBeTruthy();
      expect(deleteModal.classList.contains('modal')).toBe(true);
      expect(deleteModal.getAttribute('role')).toBe('dialog');
      expect(deleteModal.getAttribute('aria-labelledby')).toBe(
        'delete-modal-title'
      );
      expect(deleteModal.style.display).toBe('none');
    });

    it('should have delete modal header', () => {
      const header = deleteModal.querySelector('.modal-header');
      expect(header).toBeTruthy();

      const title = header.querySelector('#delete-modal-title');
      expect(title?.textContent).toBe('Confirm Deletion');

      const closeBtn = header.querySelector('#close-delete-modal');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn.classList.contains('close-modal')).toBe(true);
    });

    it('should have delete modal action buttons', () => {
      const actions = deleteModal.querySelector('.modal-actions');
      expect(actions).toBeTruthy();

      const confirmBtn = actions.querySelector('#confirm-delete-btn');
      expect(confirmBtn).toBeTruthy();
      expect(confirmBtn.classList.contains('cb-button-danger')).toBe(true);
      expect(confirmBtn.textContent.trim()).toBe('Delete');

      const cancelBtn = actions.querySelector('#cancel-delete-btn');
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn.classList.contains('cb-button-secondary')).toBe(true);
      expect(cancelBtn.textContent.trim()).toBe('Cancel');
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have unique IDs for all elements with IDs', () => {
      const elementsWithIds = Array.from(document.querySelectorAll('[id]'));
      const ids = elementsWithIds.map((el) => el.id);
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should have labels for all form inputs', () => {
      const inputs = Array.from(
        document.querySelectorAll('input, textarea, select')
      );

      inputs.forEach((input) => {
        const id = input.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          expect(label).toBeTruthy();
        }
      });
    });

    it('should have proper ARIA attributes on modals', () => {
      const modals = Array.from(document.querySelectorAll('.modal'));

      modals.forEach((modal) => {
        expect(modal.getAttribute('role')).toBe('dialog');
        expect(modal.getAttribute('aria-labelledby')).toBeTruthy();
      });
    });

    it('should have proper button types', () => {
      const buttons = Array.from(document.querySelectorAll('button'));

      buttons.forEach((button) => {
        const type = button.getAttribute('type');
        expect(['button', 'submit', 'reset']).toContain(type);
      });
    });

    it('should have semantic HTML structure', () => {
      expect(document.querySelector('header')).toBeTruthy();
      expect(document.querySelector('main')).toBeTruthy();
      expect(document.querySelector('footer')).toBeTruthy();
      expect(document.querySelectorAll('section').length).toBeGreaterThan(0);
    });

    it('should have required indicators with proper accessibility', () => {
      const requiredIndicators = Array.from(
        document.querySelectorAll('.required')
      );

      requiredIndicators.forEach((indicator) => {
        expect(indicator.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });

  describe('Form Validation Structure', () => {
    it('should have proper validation attributes matching character concept model', () => {
      const conceptTextarea = document.getElementById('concept-text');

      expect(conceptTextarea.getAttribute('minlength')).toBe('10');
      expect(conceptTextarea.getAttribute('maxlength')).toBe('6000');
      expect(conceptTextarea.hasAttribute('required')).toBe(true);
    });

    it('should have error containers with proper attributes', () => {
      const errorContainer = document.getElementById('concept-error');

      expect(errorContainer.getAttribute('role')).toBe('alert');
      expect(errorContainer.getAttribute('aria-live')).toBe('polite');
      expect(errorContainer.classList.contains('error-message')).toBe(true);
    });
  });

  describe('CSS Class Validation', () => {
    it('should have correct CSS classes for page layout', () => {
      const main = document.querySelector('.cb-page-main');
      expect(main.classList.contains('character-concepts-manager-main')).toBe(
        true
      );

      const controlsPanel = document.querySelector('.concept-controls-panel');
      expect(controlsPanel.classList.contains('cb-input-panel')).toBe(true);

      const displayPanel = document.querySelector('.concepts-display-panel');
      expect(displayPanel.classList.contains('cb-results-panel')).toBe(true);
    });

    it('should have correct CSS classes for concept grid and cards', () => {
      const conceptsGrid = document.getElementById('concepts-results');
      expect(conceptsGrid.classList.contains('concepts-grid')).toBe(true);
    });

    it('should have correct CSS classes for statistics display', () => {
      const statsDisplay = document.querySelector('.stats-display');
      expect(statsDisplay).toBeTruthy();

      const statItems = document.querySelectorAll('.stat-item');
      expect(statItems.length).toBeGreaterThan(0);

      statItems.forEach((item) => {
        const label = item.querySelector('.stat-label');
        const value = item.querySelector('.stat-value');
        expect(label).toBeTruthy();
        expect(value).toBeTruthy();
      });
    });

    it('should have correct CSS classes for action buttons', () => {
      const createBtn = document.getElementById('create-concept-btn');
      expect(createBtn.classList.contains('cb-button-primary')).toBe(true);

      const actionButtons = document.querySelector('.action-buttons');
      expect(actionButtons).toBeTruthy();
    });

    it('should have correct CSS classes for search input', () => {
      const searchInput = document.getElementById('concept-search');
      expect(searchInput.classList.contains('cb-input')).toBe(true);
    });

    it('should have correct CSS classes for modals', () => {
      const conceptModal = document.getElementById('concept-modal');
      expect(conceptModal.classList.contains('modal')).toBe(true);

      const deleteModal = document.getElementById('delete-confirmation-modal');
      expect(deleteModal.classList.contains('modal')).toBe(true);

      const dangerBtn = document.getElementById('confirm-delete-btn');
      expect(dangerBtn.classList.contains('cb-button-danger')).toBe(true);
    });

    it('should have correct CSS classes for state containers', () => {
      const emptyState = document.getElementById('empty-state');
      expect(emptyState.classList.contains('cb-empty-state')).toBe(true);

      const loadingState = document.getElementById('loading-state');
      expect(loadingState.classList.contains('cb-loading-state')).toBe(true);

      const errorState = document.getElementById('error-state');
      expect(errorState.classList.contains('cb-error-state')).toBe(true);

      const spinner = loadingState.querySelector('.spinner.large');
      expect(spinner).toBeTruthy();
    });
  });

  describe('Responsive Design Structure', () => {
    beforeEach(() => {
      // Mock window.matchMedia for responsive testing
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

    it('should have responsive-friendly structure for main layout', () => {
      const main = document.querySelector('.character-concepts-manager-main');
      expect(main).toBeTruthy();

      // Should use CSS Grid which is responsive-friendly
      const styles = window.getComputedStyle(main);
      // Note: JSDOM doesn't compute actual CSS styles, but structure should be correct
      expect(main.classList.contains('character-concepts-manager-main')).toBe(
        true
      );
    });

    it('should have flexible concept grid structure', () => {
      const conceptsGrid = document.getElementById('concepts-results');
      expect(conceptsGrid.classList.contains('concepts-grid')).toBe(true);
    });

    it('should have proper modal structure for mobile', () => {
      const modals = document.querySelectorAll('.modal');
      modals.forEach((modal) => {
        const content = modal.querySelector('.modal-content');
        expect(content).toBeTruthy();
      });
    });

    it('should have action buttons structured for responsive layout', () => {
      const actionContainer = document.querySelector('.action-buttons');
      expect(actionContainer).toBeTruthy();
    });
  });

  describe('Animation and Interaction Structure', () => {
    it('should have elements ready for animations', () => {
      const conceptsGrid = document.getElementById('concepts-results');
      expect(conceptsGrid).toBeTruthy();

      // Grid should be ready to contain animated concept cards
      expect(conceptsGrid.classList.contains('concepts-grid')).toBe(true);
    });

    it('should have interactive elements with proper structure', () => {
      const searchInput = document.getElementById('concept-search');
      expect(searchInput).toBeTruthy();
      expect(searchInput.type).toBe('text');

      const buttons = document.querySelectorAll('button');
      buttons.forEach((button) => {
        expect(button.getAttribute('type')).toBeTruthy();
      });
    });

    it('should have hover-ready card structure (when cards are added)', () => {
      const conceptsContainer = document.getElementById('concepts-container');
      expect(conceptsContainer).toBeTruthy();
      expect(conceptsContainer.classList.contains('cb-state-container')).toBe(
        true
      );
    });
  });
});
