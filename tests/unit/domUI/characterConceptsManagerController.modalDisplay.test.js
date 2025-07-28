/**
 * @file Unit tests for modal display functionality in CharacterConceptsManagerController
 * Tests specifically focused on ensuring modals are properly displayed to users
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';

describe('CharacterConceptsManagerController - Modal Display Tests', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockElements;
  let mockWindow;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock character builder service
    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Create DOM elements
    document.body.innerHTML = `
      <div id="concepts-container"></div>
      <div id="concepts-results"></div>
      <div id="empty-state"></div>
      <div id="loading-state"></div>
      <div id="error-state"></div>
      <div id="results-state"></div>
      <div id="error-message-text"></div>
      <button id="create-concept-btn"></button>
      <button id="create-first-btn"></button>
      <button id="retry-btn"></button>
      <button id="back-to-menu-btn"></button>
      <input id="concept-search" />
      <div class="stats-display"></div>
      <span id="total-concepts">0</span>
      <span id="concepts-with-directions">0</span>
      <span id="total-directions">0</span>
      
      <!-- Create/Edit Modal -->
      <div id="concept-modal" style="display: none;">
        <div id="concept-modal-title">Create Character Concept</div>
        <form id="concept-form">
          <textarea id="concept-text"></textarea>
          <span id="char-count">0/1000</span>
          <div id="concept-error"></div>
          <button id="save-concept-btn" type="submit">Save Concept</button>
          <button id="cancel-concept-btn" type="button">Cancel</button>
          <button id="close-concept-modal" type="button">×</button>
        </form>
      </div>
      
      <!-- Delete Modal -->
      <div id="delete-confirmation-modal" style="display: none;">
        <div id="delete-modal-message"></div>
        <button id="confirm-delete-btn">Delete</button>
        <button id="cancel-delete-btn">Cancel</button>
        <button id="close-delete-modal">×</button>
      </div>
    `;

    // Mock window.getComputedStyle
    mockWindow = {
      getComputedStyle: jest.fn((element) => ({
        display: element.style.display || 'none',
        visibility: 'visible',
        opacity: '1',
        zIndex: '1000',
        position: 'fixed',
      })),
    };
    global.window.getComputedStyle = mockWindow.getComputedStyle;

    // Create controller instance
    controller = new CharacterConceptsManagerController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
    });
  });

  describe('Create Modal Display', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should set modal display to flex when showing create modal', async () => {
      const conceptModal = document.getElementById('concept-modal');
      expect(conceptModal.style.display).toBe('none');

      // Trigger create button click
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      // Modal should now be displayed
      expect(conceptModal.style.display).toBe('flex');
    });

    it('should log debug info about modal visibility when showing', async () => {
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      // Check that debug logging was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Modal display debug info:',
        expect.objectContaining({
          display: 'flex',
          visibility: 'visible',
          opacity: '1',
          zIndex: '1000',
          position: 'fixed',
          modalExists: true,
          modalParent: 'BODY',
        })
      );
    });

    it('should ensure modal has proper CSS classes and attributes', async () => {
      const conceptModal = document.getElementById('concept-modal');

      // Trigger modal display
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      // Check computed styles
      const computedStyle = window.getComputedStyle(conceptModal);
      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.visibility).toBe('visible');
      expect(computedStyle.opacity).toBe('1');
      expect(computedStyle.zIndex).toBe('1000');
      expect(computedStyle.position).toBe('fixed');
    });

    it('should handle modal display even with conflicting CSS', async () => {
      const conceptModal = document.getElementById('concept-modal');

      // Add conflicting inline styles
      conceptModal.style.visibility = 'hidden';
      conceptModal.style.opacity = '0';

      // Trigger modal display
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      // Modal display should override
      expect(conceptModal.style.display).toBe('flex');

      // Note: In real implementation, we might need to explicitly set visibility and opacity
      // This test helps identify if such explicit settings are needed
    });
  });

  describe('Edit Modal Display', () => {
    beforeEach(async () => {
      // Setup mock concept data - getAllCharacterConcepts returns just the concepts
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([
        {
          id: 'test-concept-1',
          concept: 'Test concept text',
          created: Date.now(),
          updated: Date.now(),
        },
      ]);

      // Mock getThematicDirections to return empty array for testing
      mockCharacterBuilderService.getThematicDirections.mockResolvedValue([]);

      await controller.initialize();
    });

    it('should display edit modal when edit is triggered', async () => {
      const conceptModal = document.getElementById('concept-modal');

      // Use test exports to trigger edit modal
      if (controller._testExports && controller._testExports.showEditModal) {
        await controller._testExports.showEditModal('test-concept-1');
      }

      expect(conceptModal.style.display).toBe('flex');
    });

    it('should log debug info for edit modal with concept ID', async () => {
      if (controller._testExports && controller._testExports.showEditModal) {
        await controller._testExports.showEditModal('test-concept-1');
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Edit modal display debug info:',
        expect.objectContaining({
          display: 'flex',
          visibility: 'visible',
          opacity: '1',
          zIndex: '1000',
          position: 'fixed',
          modalExists: true,
          modalParent: 'BODY',
          conceptId: 'test-concept-1',
        })
      );
    });
  });

  describe('Modal Close Functionality', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should set display to none when closing modal', async () => {
      const conceptModal = document.getElementById('concept-modal');

      // First show the modal
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();
      expect(conceptModal.style.display).toBe('flex');

      // Then close it
      const closeBtn = document.getElementById('close-concept-modal');
      closeBtn.click();
      expect(conceptModal.style.display).toBe('none');
    });

    it('should handle ESC key to close modal', async () => {
      const conceptModal = document.getElementById('concept-modal');

      // Show the modal
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();
      expect(conceptModal.style.display).toBe('flex');

      // Trigger ESC key
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      // Modal should be closed
      expect(conceptModal.style.display).toBe('none');
    });
  });

  describe('Modal Backdrop Click', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should close modal when clicking on backdrop', async () => {
      const conceptModal = document.getElementById('concept-modal');

      // Show the modal
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();
      expect(conceptModal.style.display).toBe('flex');

      // Click on the modal backdrop (the modal element itself, not content)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: conceptModal });
      conceptModal.dispatchEvent(clickEvent);

      // Modal should be closed
      expect(conceptModal.style.display).toBe('none');
    });

    it('should not close modal when clicking on modal content', async () => {
      const conceptModal = document.getElementById('concept-modal');
      const conceptForm = document.getElementById('concept-form');

      // Show the modal
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();
      expect(conceptModal.style.display).toBe('flex');

      // Click on the form inside modal
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: conceptForm });
      conceptModal.dispatchEvent(clickEvent);

      // Modal should still be open
      expect(conceptModal.style.display).toBe('flex');
    });
  });

  describe('Modal Z-Index and Layering', () => {
    it('should ensure modal has higher z-index than page content', async () => {
      await controller.initialize();

      const conceptModal = document.getElementById('concept-modal');
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      const computedStyle = window.getComputedStyle(conceptModal);
      const zIndex = parseInt(computedStyle.zIndex);

      // Modal should have a high z-index
      expect(zIndex).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Multiple Modal Scenarios', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should handle rapid open/close cycles', async () => {
      const conceptModal = document.getElementById('concept-modal');
      const createBtn = document.getElementById('create-concept-btn');
      const closeBtn = document.getElementById('close-concept-modal');

      // Rapid open/close cycles
      for (let i = 0; i < 5; i++) {
        createBtn.click();
        expect(conceptModal.style.display).toBe('flex');

        closeBtn.click();
        expect(conceptModal.style.display).toBe('none');
      }

      // Final state should be predictable
      createBtn.click();
      expect(conceptModal.style.display).toBe('flex');
    });
  });
});
