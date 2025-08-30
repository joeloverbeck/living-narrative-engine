# CLIPORMOD-007: Create Unit Tests for Portrait Modal

## Status
🔴 NOT STARTED

## Priority
HIGH - Required for code quality

## Dependencies
- CLIPORMOD-001 (PortraitModalRenderer implemented)
- CLIPORMOD-004 (SpeechBubbleRenderer modifications)

## Description
Create comprehensive unit tests for the portrait modal feature, covering the PortraitModalRenderer class, SpeechBubbleRenderer modifications, and all helper methods. Tests should follow the project's testing patterns using Jest and the createTestBed utility.

## Test Files to Create

### 1. PortraitModalRenderer Tests
**File**: `tests/unit/domUI/portraitModalRenderer.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import PortraitModalRenderer from '../../../src/domUI/portraitModalRenderer.js';
import { BaseModalRenderer } from '../../../src/domUI/baseModalRenderer.js';

describe('PortraitModalRenderer', () => {
  let testBed;
  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockValidatedEventDispatcher;
  let renderer;
  
  beforeEach(() => {
    testBed = createTestBed();
    
    // Create mocks
    mockLogger = testBed.createMockLogger();
    mockDocumentContext = testBed.createMock('documentContext', ['querySelector', 'createElement']);
    mockDomElementFactory = testBed.createMock('domElementFactory', ['img', 'div', 'button']);
    mockValidatedEventDispatcher = testBed.createMock('eventDispatcher', ['dispatch']);
    
    // Mock DOM elements
    const mockModalElement = document.createElement('div');
    const mockCloseButton = document.createElement('button');
    const mockImageElement = document.createElement('img');
    const mockLoadingSpinner = document.createElement('div');
    const mockErrorMessage = document.createElement('div');
    const mockModalTitle = document.createElement('h2');
    
    mockModalElement.className = 'portrait-modal-overlay';
    mockCloseButton.className = 'portrait-modal-close';
    mockImageElement.className = 'portrait-modal-image';
    mockLoadingSpinner.className = 'portrait-loading-spinner';
    mockErrorMessage.className = 'portrait-error-message';
    mockModalTitle.id = 'portrait-modal-title';
    
    // Setup document context to return mocked elements
    mockDocumentContext.querySelector.mockImplementation((selector) => {
      const elements = {
        '.portrait-modal-overlay': mockModalElement,
        '.portrait-modal-close': mockCloseButton,
        '.portrait-modal-image': mockImageElement,
        '.portrait-loading-spinner': mockLoadingSpinner,
        '.portrait-error-message': mockErrorMessage,
        '#portrait-modal-title': mockModalTitle
      };
      return elements[selector] || null;
    });
    
    // Create renderer instance
    renderer = new PortraitModalRenderer({
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      logger: mockLogger,
      validatedEventDispatcher: mockValidatedEventDispatcher
    });
  });
  
  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });
  
  describe('Constructor and Inheritance', () => {
    it('should extend BaseModalRenderer', () => {
      expect(renderer).toBeInstanceOf(BaseModalRenderer);
    });
    
    it('should validate all required dependencies', () => {
      // Test with missing dependency
      expect(() => {
        new PortraitModalRenderer({
          documentContext: mockDocumentContext,
          domElementFactory: null, // Missing
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher
        });
      }).toThrow();
    });
    
    it('should initialize with correct element configuration', () => {
      expect(renderer.elements).toBeDefined();
      expect(renderer.elements.modalElement).toBeDefined();
      expect(renderer.elements.closeButton).toBeDefined();
    });
  });
  
  describe('showModal Method', () => {
    let mockOriginalElement;
    
    beforeEach(() => {
      mockOriginalElement = document.createElement('img');
      mockOriginalElement.focus = jest.fn();
    });
    
    it('should accept portrait path, speaker name, and original element', () => {
      const portraitPath = '/images/character.jpg';
      const speakerName = 'Test Character';
      
      expect(() => {
        renderer.showModal(portraitPath, speakerName, mockOriginalElement);
      }).not.toThrow();
    });
    
    it('should update modal title with speaker name', () => {
      const speakerName = 'Test Character';
      renderer.showModal('/path.jpg', speakerName, mockOriginalElement);
      
      const titleElement = mockDocumentContext.querySelector('#portrait-modal-title');
      expect(titleElement.textContent).toBe(speakerName);
    });
    
    it('should store original focus element for later restoration', () => {
      renderer.showModal('/path.jpg', 'Character', mockOriginalElement);
      
      // Simulate modal close
      renderer.hide();
      
      // Verify focus returns
      setTimeout(() => {
        expect(mockOriginalElement.focus).toHaveBeenCalled();
      }, 200);
    });
    
    it('should show loading spinner while image loads', () => {
      const loadingSpinner = mockDocumentContext.querySelector('.portrait-loading-spinner');
      loadingSpinner.style.display = 'none';
      
      renderer.showModal('/path.jpg', 'Character', mockOriginalElement);
      
      expect(loadingSpinner.style.display).toBe('block');
    });
  });
  
  describe('Image Loading', () => {
    it('should handle successful image load', (done) => {
      const portraitPath = '/images/success.jpg';
      const mockImage = new Image();
      
      // Mock successful load
      setTimeout(() => {
        mockImage.onload();
        
        const modalImage = mockDocumentContext.querySelector('.portrait-modal-image');
        expect(modalImage.src).toContain(portraitPath);
        expect(modalImage.classList.contains('loaded')).toBe(true);
        done();
      }, 10);
      
      renderer.showModal(portraitPath, 'Character', document.createElement('img'));
    });
    
    it('should handle image load error', (done) => {
      const portraitPath = '/images/error.jpg';
      const mockImage = new Image();
      
      // Mock error
      setTimeout(() => {
        mockImage.onerror();
        
        const errorMessage = mockDocumentContext.querySelector('.portrait-error-message');
        expect(errorMessage.style.display).toBe('block');
        expect(mockLogger.error).toHaveBeenCalled();
        done();
      }, 10);
      
      renderer.showModal(portraitPath, 'Character', document.createElement('img'));
    });
    
    it('should hide loading spinner after image loads', (done) => {
      const loadingSpinner = mockDocumentContext.querySelector('.portrait-loading-spinner');
      const mockImage = new Image();
      
      setTimeout(() => {
        mockImage.onload();
        expect(loadingSpinner.style.display).toBe('none');
        done();
      }, 10);
      
      renderer.showModal('/path.jpg', 'Character', document.createElement('img'));
    });
  });
  
  describe('Modal Lifecycle Hooks', () => {
    it('should implement _onShow hook', () => {
      const onShowSpy = jest.spyOn(renderer, '_onShow');
      renderer.show();
      expect(onShowSpy).toHaveBeenCalled();
    });
    
    it('should implement _onHide hook', () => {
      const onHideSpy = jest.spyOn(renderer, '_onHide');
      renderer.show();
      renderer.hide();
      expect(onHideSpy).toHaveBeenCalled();
    });
    
    it('should implement _getInitialFocusElement', () => {
      const closeButton = mockDocumentContext.querySelector('.portrait-modal-close');
      const focusElement = renderer._getInitialFocusElement();
      expect(focusElement).toBe(closeButton);
    });
  });
  
  describe('Memory Management', () => {
    it('should clear image source on modal close', () => {
      const modalImage = mockDocumentContext.querySelector('.portrait-modal-image');
      modalImage.src = '/test.jpg';
      
      renderer.show();
      renderer.hide();
      
      expect(modalImage.src).toBe('');
    });
    
    it('should clear stored references on cleanup', () => {
      renderer.showModal('/path.jpg', 'Character', document.createElement('img'));
      renderer.hide();
      
      // Verify internal state is cleared
      // This might require exposing a method or property for testing
    });
  });
  
  describe('Event Dispatching', () => {
    it('should dispatch event when modal opens', () => {
      renderer.showModal('/path.jpg', 'Character', document.createElement('img'));
      
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('MODAL')
        })
      );
    });
    
    it('should dispatch event when modal closes', () => {
      renderer.show();
      renderer.hide();
      
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('MODAL')
        })
      );
    });
  });
});
```

### 2. SpeechBubbleRenderer Modifications Tests
**File**: `tests/unit/domUI/speechBubbleRenderer.portrait.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { PLAYER_TYPE_COMPONENT_ID, PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('SpeechBubbleRenderer - Portrait Click Feature', () => {
  let testBed;
  let mockEntityManager;
  let mockPortraitModalRenderer;
  let speechBubbleRenderer;
  
  beforeEach(() => {
    testBed = createTestBed();
    
    // Setup mocks
    mockEntityManager = testBed.createMock('entityManager', ['getEntityInstance']);
    mockPortraitModalRenderer = testBed.createMock('portraitModalRenderer', ['showModal', 'hideModal']);
    
    // Create mock entity for testing
    const createMockEntity = (hasPlayerType, playerType, hasPlayerComponent) => ({
      hasComponent: jest.fn((componentId) => {
        if (componentId === PLAYER_TYPE_COMPONENT_ID) return hasPlayerType;
        if (componentId === PLAYER_COMPONENT_ID) return hasPlayerComponent;
        return false;
      }),
      getComponentData: jest.fn((componentId) => {
        if (componentId === PLAYER_TYPE_COMPONENT_ID) {
          return { type: playerType };
        }
        return null;
      })
    });
    
    // Setup entity manager responses
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
      if (entityId === 'ai-entity') {
        return createMockEntity(true, 'ai', false);
      }
      if (entityId === 'human-entity') {
        return createMockEntity(true, 'human', false);
      }
      if (entityId === 'player-entity') {
        return createMockEntity(false, null, true);
      }
      return null;
    });
  });
  
  describe('AI Character Detection', () => {
    it('should identify AI characters correctly', () => {
      const result = speechBubbleRenderer.#isAICharacter('ai-entity');
      expect(result).toBe(true);
    });
    
    it('should identify human players correctly', () => {
      const result = speechBubbleRenderer.#isAICharacter('human-entity');
      expect(result).toBe(false);
    });
    
    it('should identify player component entities as human', () => {
      const result = speechBubbleRenderer.#isAICharacter('player-entity');
      expect(result).toBe(false);
    });
    
    it('should default to AI when entity not found', () => {
      const result = speechBubbleRenderer.#isAICharacter('unknown-entity');
      expect(result).toBe(true);
    });
    
    it('should default to AI when entityId is null', () => {
      const result = speechBubbleRenderer.#isAICharacter(null);
      expect(result).toBe(true);
    });
  });
  
  describe('Portrait Click Handler', () => {
    let mockPortraitImg;
    
    beforeEach(() => {
      mockPortraitImg = document.createElement('img');
      mockPortraitImg.classList = {
        add: jest.fn(),
        contains: jest.fn()
      };
      mockPortraitImg.setAttribute = jest.fn();
      mockPortraitImg.addEventListener = jest.fn();
    });
    
    it('should add clickable class to AI portraits', () => {
      speechBubbleRenderer.#makePortraitClickable(mockPortraitImg, '/path.jpg', 'AI Character');
      
      expect(mockPortraitImg.classList.add).toHaveBeenCalledWith('clickable');
      expect(mockPortraitImg.style.cursor).toBe('pointer');
    });
    
    it('should add ARIA attributes for accessibility', () => {
      speechBubbleRenderer.#makePortraitClickable(mockPortraitImg, '/path.jpg', 'AI Character');
      
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith('role', 'button');
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith('tabindex', '0');
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'aria-label',
        expect.stringContaining('AI Character')
      );
    });
    
    it('should attach click event listener', () => {
      speechBubbleRenderer.#makePortraitClickable(mockPortraitImg, '/path.jpg', 'AI Character');
      
      expect(mockPortraitImg.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });
    
    it('should attach keyboard event listener', () => {
      speechBubbleRenderer.#makePortraitClickable(mockPortraitImg, '/path.jpg', 'AI Character');
      
      expect(mockPortraitImg.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
    
    it('should call modal showModal on portrait click', () => {
      const portraitPath = '/path.jpg';
      const speakerName = 'AI Character';
      
      speechBubbleRenderer.#handlePortraitClick(portraitPath, speakerName, mockPortraitImg);
      
      expect(mockPortraitModalRenderer.showModal).toHaveBeenCalledWith(
        portraitPath,
        speakerName,
        mockPortraitImg
      );
    });
  });
  
  describe('Modified addPortrait Method', () => {
    it('should accept entityId as fourth parameter', () => {
      const container = document.createElement('div');
      const portraitPath = '/path.jpg';
      const speakerName = 'Character';
      const entityId = 'test-entity';
      
      expect(() => {
        speechBubbleRenderer.#addPortrait(container, portraitPath, speakerName, entityId);
      }).not.toThrow();
    });
    
    it('should make AI portraits clickable', () => {
      const container = document.createElement('div');
      const aiEntityId = 'ai-entity';
      
      const result = speechBubbleRenderer.#addPortrait(
        container,
        '/path.jpg',
        'AI Character',
        aiEntityId
      );
      
      expect(result).toBe(true);
      const portrait = container.querySelector('.speech-portrait');
      expect(portrait.classList.contains('clickable')).toBe(true);
    });
    
    it('should not make human portraits clickable', () => {
      const container = document.createElement('div');
      const humanEntityId = 'human-entity';
      
      const result = speechBubbleRenderer.#addPortrait(
        container,
        '/path.jpg',
        'Human Player',
        humanEntityId
      );
      
      expect(result).toBe(true);
      const portrait = container.querySelector('.speech-portrait');
      expect(portrait.classList.contains('clickable')).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle modal renderer not available gracefully', () => {
      // Set modal renderer to null
      speechBubbleRenderer.#portraitModalRenderer = null;
      
      const mockImg = document.createElement('img');
      
      expect(() => {
        speechBubbleRenderer.#handlePortraitClick('/path.jpg', 'Character', mockImg);
      }).not.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    it('should handle entity manager errors gracefully', () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });
      
      const result = speechBubbleRenderer.#isAICharacter('error-entity');
      
      expect(result).toBe(true); // Defaults to AI on error
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
```

### 3. Accessibility Tests
**File**: `tests/unit/domUI/portraitModal.accessibility.test.js`

```javascript
describe('Portrait Modal - Accessibility', () => {
  describe('ARIA Attributes', () => {
    it('should have role="dialog"', () => {
      const modal = document.querySelector('.portrait-modal-overlay');
      expect(modal.getAttribute('role')).toBe('dialog');
    });
    
    it('should have aria-modal="true"', () => {
      const modal = document.querySelector('.portrait-modal-overlay');
      expect(modal.getAttribute('aria-modal')).toBe('true');
    });
    
    it('should have aria-labelledby pointing to title', () => {
      const modal = document.querySelector('.portrait-modal-overlay');
      const labelledBy = modal.getAttribute('aria-labelledby');
      const titleElement = document.getElementById(labelledBy);
      expect(titleElement).toBeDefined();
    });
  });
  
  describe('Keyboard Navigation', () => {
    it('should trap focus within modal', () => {
      renderer.show();
      
      // Simulate tab key
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      document.dispatchEvent(tabEvent);
      
      // Verify focus stays within modal
      expect(document.activeElement.closest('.portrait-modal-overlay')).toBeTruthy();
    });
    
    it('should close on ESC key', () => {
      renderer.show();
      
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      expect(renderer.isVisible()).toBe(false);
    });
    
    it('should handle Enter key on portrait', () => {
      const portrait = document.querySelector('.speech-portrait.clickable');
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      
      portrait.dispatchEvent(enterEvent);
      
      expect(mockPortraitModalRenderer.showModal).toHaveBeenCalled();
    });
    
    it('should handle Space key on portrait', () => {
      const portrait = document.querySelector('.speech-portrait.clickable');
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      
      portrait.dispatchEvent(spaceEvent);
      
      expect(mockPortraitModalRenderer.showModal).toHaveBeenCalled();
    });
  });
  
  describe('Focus Management', () => {
    it('should set initial focus on close button', (done) => {
      const closeButton = document.querySelector('.portrait-modal-close');
      closeButton.focus = jest.fn();
      
      renderer.show();
      
      setTimeout(() => {
        expect(closeButton.focus).toHaveBeenCalled();
        done();
      }, 150);
    });
    
    it('should return focus to trigger element on close', (done) => {
      const triggerElement = document.createElement('img');
      triggerElement.focus = jest.fn();
      
      renderer.showModal('/path.jpg', 'Character', triggerElement);
      renderer.hide();
      
      setTimeout(() => {
        expect(triggerElement.focus).toHaveBeenCalled();
        done();
      }, 150);
    });
  });
  
  describe('Screen Reader Support', () => {
    it('should announce modal opening', () => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      renderer.show();
      
      expect(liveRegion.textContent).toContain('Opened portrait modal');
    });
    
    it('should announce loading state', () => {
      const loadingSpinner = document.querySelector('.portrait-loading-spinner');
      expect(loadingSpinner.getAttribute('role')).toBe('status');
      expect(loadingSpinner.getAttribute('aria-live')).toBe('polite');
    });
    
    it('should announce error state', () => {
      const errorMessage = document.querySelector('.portrait-error-message');
      expect(errorMessage.getAttribute('role')).toBe('alert');
      expect(errorMessage.getAttribute('aria-live')).toBe('assertive');
    });
  });
  
  describe('Reduced Motion', () => {
    it('should respect prefers-reduced-motion', () => {
      // Mock the media query
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn()
      }));
      
      renderer.show();
      
      const modal = document.querySelector('.portrait-modal-overlay');
      expect(modal.style.transition).toBe('none');
    });
  });
});
```

## Testing Coverage Requirements

### Unit Test Coverage Goals
- **Lines**: 90%+
- **Branches**: 80%+
- **Functions**: 90%+
- **Statements**: 90%+

### Critical Paths to Test
1. Modal lifecycle (open, display, close)
2. Image loading (success, failure, timeout)
3. Focus management (trap, return)
4. Keyboard navigation (Tab, Shift+Tab, ESC, Enter, Space)
5. AI vs Human detection logic
6. Click handler attachment and execution
7. Memory cleanup and event listener removal
8. Error boundaries and graceful degradation

## Running the Tests

```bash
# Run all portrait modal tests
npm run test:unit tests/unit/domUI/portrait*

# Run with coverage
npm run test:unit -- --coverage tests/unit/domUI/portrait*

# Run specific test file
npm run test:unit tests/unit/domUI/portraitModalRenderer.test.js

# Run in watch mode for development
npm run test:unit -- --watch tests/unit/domUI/portrait*
```

## Success Criteria
- [ ] All test files created and passing
- [ ] Coverage goals met (90% functions, 90% lines, 80% branches)
- [ ] Mocks properly set up using createTestBed
- [ ] No console errors or warnings during tests
- [ ] Tests follow project conventions
- [ ] Edge cases and error paths covered
- [ ] Accessibility features tested
- [ ] Memory management verified
- [ ] Integration points validated

## Notes
- Use createTestBed for consistent mock creation
- Follow existing test patterns in the project
- Test both happy paths and error scenarios
- Ensure tests are deterministic and don't rely on timing
- Mock external dependencies properly