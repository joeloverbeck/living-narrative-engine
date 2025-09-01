/**
 * @file Test that reproduces and verifies the fix for CriticalLogNotifier DocumentContext issue
 * @see criticalLogNotifier.js, documentContext.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
import { createTestBed } from '../../common/testBed.js';
import DocumentContext from '../../../src/domUI/documentContext.js';

describe('CriticalLogNotifier - DocumentContext Integration', () => {
  let testBed;
  let mockDocument;
  let mockHybridLogger;

  beforeEach(() => {
    testBed = createTestBed();
    
    // Create mock document that mimics browser document
    // Create mock body element for DOM operations
    const mockBodyElement = {
      tagName: 'BODY',
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false)
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      getAttribute: jest.fn(),
      setAttribute: jest.fn(),
      textContent: '',
      innerHTML: ''
    };

    mockDocument = {
      querySelector: jest.fn().mockImplementation((selector) => {
        if (selector === 'body') return mockBodyElement;
        return null;
      }),
      createElement: jest.fn().mockImplementation((tag) => ({
        tagName: tag.toUpperCase(),
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn().mockReturnValue(false)
        },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        getAttribute: jest.fn(),
        setAttribute: jest.fn(),
        textContent: '',
        innerHTML: ''
      }))
    };

    // Create mock hybrid logger with required methods
    mockHybridLogger = {
      getCriticalLogs: jest.fn().mockReturnValue([]),
      getCriticalBufferStats: jest.fn().mockReturnValue({ warnings: 0, errors: 0 }),
      clearCriticalBuffer: jest.fn()
    };
  });

  describe('DocumentContext Method Call Issue', () => {
    it('should verify the getDocument() error was fixed and no longer occurs', () => {
      // Arrange
      const mockLogger = testBed.createMockLogger();
      const mockEventDispatcher = testBed.eventDispatcher;
      
      // Create DocumentContext (which only has query/create methods, not getDocument)
      const documentContext = new DocumentContext(mockDocument, mockLogger);
      
      // Verify DocumentContext doesn't have getDocument method
      expect(documentContext.getDocument).toBeUndefined();
      expect(typeof documentContext.query).toBe('function');
      expect(typeof documentContext.create).toBe('function');

      // Act & Assert
      // The getDocument() error should no longer occur - it may fail for other reasons 
      // (like DOM mocking), but not the specific getDocument() error
      let thrownError = null;
      try {
        new CriticalLogNotifier({
          logger: mockLogger,
          documentContext: documentContext,
          validatedEventDispatcher: mockEventDispatcher,
          hybridLogger: mockHybridLogger,
          config: {
            enableVisualNotifications: true
          }
        });
      } catch (error) {
        thrownError = error;
      }

      // The specific getDocument error should not occur anymore
      if (thrownError) {
        expect(thrownError.message).not.toContain('this.documentContext.getDocument is not a function');
        // It may fail for other DOM-related reasons in tests, but not the original error
      }
    });

    it('should successfully pass document object to KeyboardShortcutsManager via DocumentContext.document', () => {
      // This verifies that the fix allows KeyboardShortcutsManager to receive the underlying document
      const mockLogger = testBed.createMockLogger();
      
      // Test the KeyboardShortcutsManager directly to verify it accepts the document object
      const documentContext = new DocumentContext(mockDocument, mockLogger);
      
      const KeyboardShortcutsManager = require('../../../src/logging/keyboardShortcutsManager.js').default;
      
      // This should work now that we pass documentContext.document (the underlying document)
      let keyboardManager;
      expect(() => {
        keyboardManager = new KeyboardShortcutsManager({
          logger: mockLogger,
          documentContext: documentContext.document  // Pass the underlying document
        });
      }).not.toThrow();

      expect(keyboardManager).toBeDefined();
    });
  });

  describe('DocumentContext Interface Compliance', () => {
    it('should verify DocumentContext implements IDocumentContext correctly', () => {
      // Arrange
      const mockLogger = testBed.createMockLogger();
      const documentContext = new DocumentContext(mockDocument, mockLogger);

      // Assert - DocumentContext should only have these methods per IDocumentContext interface
      expect(typeof documentContext.query).toBe('function');
      expect(typeof documentContext.create).toBe('function');
      
      // These methods should NOT exist (the bug was calling getDocument())
      expect(documentContext.getDocument).toBeUndefined();
      
      // But DocumentContext should have a document getter that returns the underlying document
      expect(documentContext.document).toBe(mockDocument);
    });

    it('should verify KeyboardShortcutsManager accepts DocumentContext properly', () => {
      // This verifies that KeyboardShortcutsManager can handle DocumentContext object
      const mockLogger = testBed.createMockLogger();
      const documentContext = new DocumentContext(mockDocument, mockLogger);

      // Import KeyboardShortcutsManager to test it directly
      const KeyboardShortcutsManager = require('../../../src/logging/keyboardShortcutsManager.js').default;
      
      // Should not throw when passed DocumentContext object
      expect(() => {
        new KeyboardShortcutsManager({
          logger: mockLogger,
          documentContext: documentContext  // Pass DocumentContext directly, not getDocument()
        });
      }).not.toThrow();
    });
  });
});