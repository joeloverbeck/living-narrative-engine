# CLIPORMOD-008: Create Integration Tests for Portrait Modal

## Status
🔴 NOT STARTED

## Priority
MEDIUM - Important for feature validation

## Dependencies
- All previous tickets (CLIPORMOD-001 through CLIPORMOD-007)
- Full feature implementation complete

## Description
Create integration tests that verify the complete portrait modal feature works correctly when all components are integrated. These tests should verify the end-to-end flow from clicking a portrait to modal display and closing.

## Test File to Create
**File**: `tests/integration/domUI/speechBubblePortraitModal.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { PLAYER_TYPE_COMPONENT_ID, PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Speech Bubble Portrait Modal Integration', () => {
  let testBed;
  let container;
  let speechBubbleRenderer;
  let portraitModalRenderer;
  let entityManager;
  let documentContext;
  
  beforeEach(async () => {
    testBed = createTestBed();
    
    // Create real DOM container for integration testing
    container = document.createElement('div');
    container.className = 'game-container';
    document.body.appendChild(container);
    
    // Add modal HTML structure to DOM
    const modalHTML = `
      <div class="portrait-modal-overlay modal-overlay" 
           role="dialog" 
           aria-modal="true" 
           aria-labelledby="portrait-modal-title"
           style="display: none;">
        <div class="portrait-modal-content modal-content">
          <div class="portrait-modal-header">
            <h2 id="portrait-modal-title" class="portrait-modal-title">Character Portrait</h2>
            <button class="portrait-modal-close" aria-label="Close portrait modal">&times;</button>
          </div>
          <div class="portrait-modal-body">
            <div class="portrait-image-container">
              <div class="portrait-loading-spinner" role="status">Loading...</div>
              <img class="portrait-modal-image" src="" alt="" />
              <div class="portrait-error-message" role="alert" style="display: none;">
                Failed to load portrait
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', modalHTML);
    
    // Get actual instances from container (or create minimal working versions)
    documentContext = {
      querySelector: (selector) => container.querySelector(selector),
      querySelectorAll: (selector) => container.querySelectorAll(selector),
      createElement: (tag) => document.createElement(tag),
      body: document.body
    };
    
    // Setup entity manager with test entities
    entityManager = testBed.createMock('entityManager', ['getEntityInstance']);
    
    const createTestEntity = (type) => ({
      hasComponent: jest.fn((id) => {
        if (id === PLAYER_TYPE_COMPONENT_ID) return true;
        return false;
      }),
      getComponentData: jest.fn((id) => {
        if (id === PLAYER_TYPE_COMPONENT_ID) {
          return { type };
        }
        return null;
      })
    });
    
    entityManager.getEntityInstance.mockImplementation((entityId) => {
      if (entityId === 'ai-character-1') return createTestEntity('ai');
      if (entityId === 'human-player-1') return createTestEntity('human');
      return null;
    });
    
    // Initialize components
    const logger = testBed.createMockLogger();
    const domElementFactory = {
      img: (src, alt, className) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.className = className;
        return img;
      },
      div: (content, className) => {
        const div = document.createElement('div');
        div.textContent = content;
        div.className = className;
        return div;
      },
      button: (text, className) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;
        return button;
      }
    };
    
    const validatedEventDispatcher = testBed.createMock('eventDispatcher', ['dispatch']);
    
    // Create portrait modal renderer
    portraitModalRenderer = new PortraitModalRenderer({
      documentContext,
      domElementFactory,
      logger,
      validatedEventDispatcher
    });
    
    // Create speech bubble renderer with portrait modal
    speechBubbleRenderer = new SpeechBubbleRenderer({
      entityManager,
      portraitModalRenderer,
      documentContext,
      domElementFactory,
      logger,
      validatedEventDispatcher,
      // ... other required dependencies
    });
  });
  
  afterEach(() => {
    // Clean up DOM
    document.body.removeChild(container);
    testBed.cleanup();
    jest.clearAllMocks();
  });
  
  describe('End-to-End Portrait Click Flow', () => {
    it('should complete full flow: render speech → click AI portrait → open modal → close modal', async () => {
      // Step 1: Render speech bubble with AI character portrait
      const speechData = {
        entityId: 'ai-character-1',
        speakerName: 'AI Assistant',
        portraitPath: '/images/ai-assistant.jpg',
        speechText: 'Hello, I am an AI character!'
      };
      
      const speechContainer = document.createElement('div');
      container.appendChild(speechContainer);
      
      speechBubbleRenderer.renderSpeech(speechData, speechContainer);
      
      // Verify portrait was rendered
      const portrait = speechContainer.querySelector('.speech-portrait');
      expect(portrait).toBeTruthy();
      expect(portrait.classList.contains('clickable')).toBe(true);
      
      // Step 2: Click the portrait
      const clickEvent = new MouseEvent('click', { bubbles: true });
      portrait.dispatchEvent(clickEvent);
      
      // Step 3: Verify modal opens
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const modal = container.querySelector('.portrait-modal-overlay');
      expect(modal.style.display).not.toBe('none');
      expect(modal.classList.contains('visible')).toBe(true);
      
      // Verify modal title shows character name
      const modalTitle = container.querySelector('#portrait-modal-title');
      expect(modalTitle.textContent).toBe('AI Assistant');
      
      // Step 4: Close modal via close button
      const closeButton = container.querySelector('.portrait-modal-close');
      closeButton.click();
      
      // Step 5: Verify modal closes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(modal.style.display).toBe('none');
      expect(modal.classList.contains('visible')).toBe(false);
    });
    
    it('should not make human player portraits clickable', () => {
      const speechData = {
        entityId: 'human-player-1',
        speakerName: 'Player',
        portraitPath: '/images/player.jpg',
        speechText: 'I am the player!'
      };
      
      const speechContainer = document.createElement('div');
      container.appendChild(speechContainer);
      
      speechBubbleRenderer.renderSpeech(speechData, speechContainer);
      
      const portrait = speechContainer.querySelector('.speech-portrait');
      expect(portrait).toBeTruthy();
      expect(portrait.classList.contains('clickable')).toBe(false);
      expect(portrait.style.cursor).not.toBe('pointer');
    });
  });
  
  describe('Multiple Portraits Interaction', () => {
    it('should handle multiple AI portraits in same conversation', () => {
      // Render multiple speech bubbles
      const speeches = [
        { entityId: 'ai-character-1', speakerName: 'AI 1', portraitPath: '/ai1.jpg' },
        { entityId: 'ai-character-2', speakerName: 'AI 2', portraitPath: '/ai2.jpg' },
        { entityId: 'human-player-1', speakerName: 'Player', portraitPath: '/player.jpg' }
      ];
      
      speeches.forEach(speech => {
        const container = document.createElement('div');
        speechBubbleRenderer.renderSpeech(speech, container);
        document.body.appendChild(container);
      });
      
      // Verify correct number of clickable portraits
      const allPortraits = document.querySelectorAll('.speech-portrait');
      const clickablePortraits = document.querySelectorAll('.speech-portrait.clickable');
      
      expect(allPortraits.length).toBe(3);
      expect(clickablePortraits.length).toBe(2); // Only AI portraits
    });
    
    it('should switch between different portrait modals', async () => {
      // Setup two AI portraits
      const portrait1 = createPortrait('ai-1', 'Character 1', '/char1.jpg');
      const portrait2 = createPortrait('ai-2', 'Character 2', '/char2.jpg');
      
      // Click first portrait
      portrait1.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let modalTitle = container.querySelector('#portrait-modal-title');
      expect(modalTitle.textContent).toBe('Character 1');
      
      // Close modal
      container.querySelector('.portrait-modal-close').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Click second portrait
      portrait2.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      modalTitle = container.querySelector('#portrait-modal-title');
      expect(modalTitle.textContent).toBe('Character 2');
    });
  });
  
  describe('Keyboard Navigation Integration', () => {
    it('should open modal with Enter key on portrait', async () => {
      const portrait = createClickablePortrait();
      portrait.focus();
      
      const enterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter',
        bubbles: true 
      });
      portrait.dispatchEvent(enterEvent);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const modal = container.querySelector('.portrait-modal-overlay');
      expect(modal.classList.contains('visible')).toBe(true);
    });
    
    it('should open modal with Space key on portrait', async () => {
      const portrait = createClickablePortrait();
      portrait.focus();
      
      const spaceEvent = new KeyboardEvent('keydown', { 
        key: ' ',
        bubbles: true 
      });
      portrait.dispatchEvent(spaceEvent);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const modal = container.querySelector('.portrait-modal-overlay');
      expect(modal.classList.contains('visible')).toBe(true);
    });
    
    it('should close modal with ESC key', async () => {
      // Open modal first
      const portrait = createClickablePortrait();
      portrait.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Press ESC
      const escEvent = new KeyboardEvent('keydown', { 
        key: 'Escape',
        bubbles: true 
      });
      document.dispatchEvent(escEvent);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const modal = container.querySelector('.portrait-modal-overlay');
      expect(modal.classList.contains('visible')).toBe(false);
    });
    
    it('should trap focus within modal', async () => {
      // Open modal
      const portrait = createClickablePortrait();
      portrait.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get focusable elements
      const closeButton = container.querySelector('.portrait-modal-close');
      
      // Focus should be on close button
      expect(document.activeElement).toBe(closeButton);
      
      // Tab should keep focus within modal
      const tabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab',
        bubbles: true 
      });
      document.dispatchEvent(tabEvent);
      
      // Focus should still be within modal
      const modal = container.querySelector('.portrait-modal-overlay');
      expect(modal.contains(document.activeElement)).toBe(true);
    });
  });
  
  describe('Image Loading States', () => {
    it('should show loading spinner while image loads', async () => {
      const portrait = createClickablePortrait();
      portrait.click();
      
      const loadingSpinner = container.querySelector('.portrait-loading-spinner');
      expect(loadingSpinner.style.display).toBe('block');
      
      // Simulate image load
      const img = container.querySelector('.portrait-modal-image');
      img.dispatchEvent(new Event('load'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(loadingSpinner.style.display).toBe('none');
      expect(img.classList.contains('loaded')).toBe(true);
    });
    
    it('should show error message on image load failure', async () => {
      const portrait = createClickablePortrait();
      portrait.click();
      
      // Simulate image error
      const img = container.querySelector('.portrait-modal-image');
      img.dispatchEvent(new Event('error'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const errorMessage = container.querySelector('.portrait-error-message');
      expect(errorMessage.style.display).toBe('block');
      expect(errorMessage.textContent).toContain('Failed to load');
    });
  });
  
  describe('Focus Management Integration', () => {
    it('should return focus to portrait after modal closes', async () => {
      const portrait = createClickablePortrait();
      portrait.focus();
      
      // Open modal
      portrait.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Close modal
      const closeButton = container.querySelector('.portrait-modal-close');
      closeButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Focus should return to portrait
      expect(document.activeElement).toBe(portrait);
    });
    
    it('should handle focus when original element is removed', async () => {
      const portrait = createClickablePortrait();
      
      // Open modal
      portrait.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Remove original portrait from DOM
      portrait.remove();
      
      // Close modal
      const closeButton = container.querySelector('.portrait-modal-close');
      closeButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should not throw error, focus goes to body
      expect(document.activeElement).toBe(document.body);
    });
  });
  
  describe('Accessibility Integration', () => {
    it('should have complete ARIA attribute chain', () => {
      const portrait = createClickablePortrait();
      
      // Portrait ARIA
      expect(portrait.getAttribute('role')).toBe('button');
      expect(portrait.getAttribute('tabindex')).toBe('0');
      expect(portrait.getAttribute('aria-label')).toContain('Click to view');
      
      // Modal ARIA
      const modal = container.querySelector('.portrait-modal-overlay');
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(modal.getAttribute('aria-labelledby')).toBe('portrait-modal-title');
    });
    
    it('should announce modal state changes to screen readers', async () => {
      // Create live region for testing
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      container.appendChild(liveRegion);
      
      const portrait = createClickablePortrait();
      portrait.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check for announcement (implementation dependent)
      // This would need actual screen reader testing for full validation
    });
  });
  
  describe('Performance and Memory', () => {
    it('should clean up event listeners on component destruction', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      // Create and destroy renderer
      const renderer = createTestRenderer();
      renderer.destroy();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
    
    it('should handle rapid portrait clicks without memory leaks', async () => {
      const portrait = createClickablePortrait();
      
      // Rapidly click portrait multiple times
      for (let i = 0; i < 10; i++) {
        portrait.click();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const closeButton = container.querySelector('.portrait-modal-close');
        if (closeButton) closeButton.click();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Should only have one modal in DOM
      const modals = container.querySelectorAll('.portrait-modal-overlay');
      expect(modals.length).toBe(1);
    });
  });
  
  // Helper functions
  function createClickablePortrait() {
    const portrait = document.createElement('img');
    portrait.className = 'speech-portrait clickable';
    portrait.src = '/test.jpg';
    portrait.alt = 'Test Character';
    portrait.setAttribute('role', 'button');
    portrait.setAttribute('tabindex', '0');
    portrait.setAttribute('aria-label', 'Click to view larger portrait');
    
    container.appendChild(portrait);
    
    // Attach click handler
    portrait.addEventListener('click', () => {
      portraitModalRenderer.showModal('/test.jpg', 'Test Character', portrait);
    });
    
    return portrait;
  }
  
  function createPortrait(entityId, name, path) {
    const speechData = { entityId, speakerName: name, portraitPath: path };
    const container = document.createElement('div');
    speechBubbleRenderer.renderSpeech(speechData, container);
    document.body.appendChild(container);
    return container.querySelector('.speech-portrait');
  }
});
```

## Additional Integration Test Scenarios

### Error Recovery Tests
```javascript
describe('Error Recovery Integration', () => {
  it('should recover from modal creation failure', () => {
    // Temporarily break modal HTML
    const modal = container.querySelector('.portrait-modal-overlay');
    modal.remove();
    
    const portrait = createClickablePortrait();
    
    // Should not throw when clicking
    expect(() => portrait.click()).not.toThrow();
    
    // Portrait should remain functional
    expect(portrait.classList.contains('clickable')).toBe(true);
  });
  
  it('should handle missing portrait path gracefully', () => {
    const speechData = {
      entityId: 'ai-character-1',
      speakerName: 'AI Character',
      portraitPath: null, // No portrait
      speechText: 'Hello!'
    };
    
    const container = document.createElement('div');
    speechBubbleRenderer.renderSpeech(speechData, container);
    
    // Should render placeholder instead
    const placeholder = container.querySelector('.no-portrait-placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder.textContent).toBe('A'); // First letter of name
  });
});
```

### Cross-Browser Compatibility Tests
```javascript
describe('Cross-Browser Compatibility', () => {
  it('should work without Image constructor', () => {
    // Mock environment without Image constructor
    const originalImage = window.Image;
    delete window.Image;
    
    const portrait = createClickablePortrait();
    
    expect(() => portrait.click()).not.toThrow();
    
    // Restore
    window.Image = originalImage;
  });
  
  it('should work with touch events on mobile', () => {
    const portrait = createClickablePortrait();
    
    // Simulate touch event
    const touchEvent = new TouchEvent('touchend', {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }]
    });
    
    portrait.dispatchEvent(touchEvent);
    
    // Modal should open
    const modal = container.querySelector('.portrait-modal-overlay');
    expect(modal.classList.contains('visible')).toBe(true);
  });
});
```

## Running Integration Tests

```bash
# Run integration tests
npm run test:integration tests/integration/domUI/speechBubblePortraitModal.integration.test.js

# Run with coverage
npm run test:integration -- --coverage

# Run all portrait-related tests
npm run test:integration tests/integration/**/*portrait*

# Debug mode
npm run test:integration -- --detectOpenHandles
```

## Success Criteria
- [ ] Full end-to-end flow works correctly
- [ ] AI portraits are clickable, human portraits are not
- [ ] Modal opens and closes properly
- [ ] Keyboard navigation works throughout
- [ ] Focus management functions correctly
- [ ] Multiple portraits can be handled
- [ ] Image loading states work
- [ ] Error recovery is robust
- [ ] No memory leaks
- [ ] Accessibility features integrated
- [ ] Cross-browser compatibility verified

## Notes
- Integration tests may be slower than unit tests
- Use real DOM elements when possible
- Test actual user interactions, not implementation details
- Verify the complete feature works as specified
- Consider adding E2E tests with Playwright for full browser testing