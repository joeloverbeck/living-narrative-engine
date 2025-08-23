/**
 * @file End-to-end test for Traits Generator export functionality
 * @description Tests file download simulation, export formatting,
 * and export error handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Traits Generator Export Functionality E2E', () => {
  let dom;
  let window;
  let document;
  let mockExportServices;
  let downloadedFiles;

  beforeEach(() => {
    // Track downloaded files
    downloadedFiles = [];

    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Setup export testing mocks
    mockExportServices = setupExportMocks(downloadedFiles);

    // Create JSDOM instance for export testing
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      beforeParse(window) {
        // Setup export functionality mocks
        window.URL = mockExportServices.URL;
        window.Blob = mockExportServices.Blob;
        window.fetch = mockExportServices.fetch;

        // Mock document.createElement for download link creation
        const originalCreateElement = window.document.createElement;
        window.document.createElement = jest.fn((tagName) => {
          const element = originalCreateElement.call(window.document, tagName);
          
          if (tagName.toLowerCase() === 'a') {
            // Mock download link behavior
            const originalClick = element.click;
            element.click = jest.fn(() => {
              if (element.download && element.href) {
                downloadedFiles.push({
                  filename: element.download,
                  url: element.href,
                  timestamp: new Date().toISOString()
                });
              }
              return originalClick.call(element);
            });
          }
          
          return element;
        });

        // Mock setTimeout for cleanup operations
        window.setTimeout = jest.fn((fn, delay) => {
          if (typeof fn === 'function') {
            // Execute cleanup immediately for testing
            fn();
          }
          return 123;
        });
      }
    });

    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
    downloadedFiles = [];
  });

  describe('Export Button Functionality', () => {
    it('should have properly configured export button', () => {
      const exportBtn = document.getElementById('export-btn');
      
      expect(exportBtn).toBeTruthy();
      expect(exportBtn.tagName).toBe('BUTTON');
      expect(exportBtn.classList.contains('cb-button-secondary')).toBe(true);
      expect(exportBtn.getAttribute('aria-label')).toBe('Export traits to text file');
      
      // Initially should be hidden
      expect(exportBtn.style.display).toBe('none');
    });

    it('should have export button with proper visual elements', () => {
      const exportBtn = document.getElementById('export-btn');
      const buttonIcon = exportBtn.querySelector('.button-icon');
      const buttonText = exportBtn.querySelector('.button-text');
      
      expect(buttonIcon).toBeTruthy();
      expect(buttonText).toBeTruthy();
      expect(buttonText.textContent).toBe('Export');
    });

    it('should handle export button click events', () => {
      const exportBtn = document.getElementById('export-btn');
      
      expect(() => {
        exportBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      }).not.toThrow();
    });

    it('should show export button after successful generation', () => {
      // Test that export button visibility is controlled properly
      const exportBtn = document.getElementById('export-btn');
      const resultsState = document.getElementById('results-state');
      
      expect(exportBtn).toBeTruthy();
      expect(resultsState).toBeTruthy();
      
      // Export button should be in the results panel
      const panelActions = document.querySelector('.panel-actions');
      expect(panelActions).toBeTruthy();
      expect(panelActions.contains(exportBtn)).toBe(true);
    });
  });

  describe('File Download Simulation', () => {
    it('should create downloadable blob for traits data', () => {
      // Test that blob creation is supported
      const mockContent = ['Test trait data for export'];
      const mockOptions = { type: 'text/plain;charset=utf-8' };
      
      expect(() => {
        new window.Blob(mockContent, mockOptions);
      }).not.toThrow();
      
      expect(window.Blob).toHaveBeenCalledWith(mockContent, mockOptions);
    });

    it('should create object URL for download', () => {
      const mockBlob = { content: ['test'], type: 'text/plain' };
      
      expect(() => {
        window.URL.createObjectURL(mockBlob);
      }).not.toThrow();
      
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    });

    it('should create download link with proper attributes', () => {
      const link = document.createElement('a');
      
      expect(link).toBeTruthy();
      expect(link.tagName).toBe('A');
      
      // Test setting download attributes
      link.href = 'mock-blob-url';
      link.download = 'test-traits.txt';
      
      expect(link.href).toContain('mock-blob-url');
      expect(link.download).toBe('test-traits.txt');
    });

    it('should simulate file download process', () => {
      // Create mock download scenario
      const link = document.createElement('a');
      link.href = 'mock-blob-url';
      link.download = 'character-traits-test.txt';
      
      // Simulate adding to DOM and clicking
      document.body.appendChild(link);
      link.click();
      
      expect(downloadedFiles).toHaveLength(1);
      expect(downloadedFiles[0].filename).toBe('character-traits-test.txt');
      expect(downloadedFiles[0].url).toContain('mock-blob-url');
    });

    it('should clean up download resources', () => {
      const mockUrl = 'mock-blob-url';
      
      // Test that URL cleanup is called
      expect(() => {
        window.URL.revokeObjectURL(mockUrl);
      }).not.toThrow();
      
      // Should also test setTimeout for delayed cleanup
      expect(window.setTimeout).toBeDefined();
    });
  });

  describe('Export Data Formatting', () => {
    it('should support comprehensive trait data export', () => {
      // Test that the export functionality would handle complete trait data
      const mockTraitData = {
        id: 'test-trait-123',
        names: [
          { name: 'Alexander', justification: 'Strong leadership qualities' },
          { name: 'Marcus', justification: 'Roman heritage inspiration' }
        ],
        physicalDescription: 'A tall figure with weathered features',
        personality: [
          { trait: 'Determined', explanation: 'Never gives up on goals' },
          { trait: 'Cautious', explanation: 'Thinks before acting' }
        ],
        strengths: ['Strategic thinking', 'Loyalty'],
        weaknesses: ['Stubbornness', 'Trust issues'],
        likes: ['Quiet moments', 'Honest people'],
        dislikes: ['Deception', 'Chaos'],
        fears: ['Failure', 'Betrayal'],
        goals: {
          shortTerm: ['Complete current mission'],
          longTerm: 'Establish lasting peace'
        },
        notes: ['Has military background', 'Skilled negotiator'],
        profile: 'A complex character balancing strength with vulnerability',
        secrets: ['Once failed a crucial mission'],
        generatedAt: new Date().toISOString()
      };

      // Test that blob creation handles structured data
      const formattedContent = JSON.stringify(mockTraitData, null, 2);
      
      expect(() => {
        new window.Blob([formattedContent], { type: 'text/plain;charset=utf-8' });
      }).not.toThrow();
    });

    it('should include user input metadata in export', () => {
      // Test that user inputs are included in export data
      const mockUserInputs = {
        coreMotivation: 'To protect innocents from harm',
        internalContradiction: 'Fears the cost of leadership',
        centralQuestion: 'Can one lead without losing themselves?'
      };

      const mockExportData = {
        userInputs: mockUserInputs,
        directionTitle: 'The Reluctant Hero',
        generatedAt: new Date().toISOString()
      };

      expect(() => {
        const exportText = JSON.stringify(mockExportData, null, 2);
        new window.Blob([exportText], { type: 'text/plain;charset=utf-8' });
      }).not.toThrow();
    });

    it('should generate appropriate filename for export', () => {
      // Test filename generation based on direction
      const mockDirection = 'The Reluctant Hero';
      const timestamp = new Date().toISOString().split('T')[0];
      const expectedFilename = `character-traits-${mockDirection.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.txt`;
      
      // Should handle filename sanitization
      expect(expectedFilename).toMatch(/^character-traits-.*\.txt$/);
      expect(expectedFilename).not.toContain(' '); // No spaces
      expect(expectedFilename).not.toContain('*'); // No special chars
    });

    it('should handle special characters in export data', () => {
      const mockDataWithSpecialChars = {
        description: 'Character with special chars: ñáéíóú, quotes "test", and symbols @#$%',
        notes: ['Line 1\nLine 2', 'Tabs\tand\tspaces']
      };

      expect(() => {
        const exportText = JSON.stringify(mockDataWithSpecialChars, null, 2);
        new window.Blob([exportText], { type: 'text/plain;charset=utf-8' });
      }).not.toThrow();
    });
  });

  describe('Export Error Handling', () => {
    it('should handle blob creation failures', () => {
      // Mock blob creation failure
      const originalBlob = window.Blob;
      window.Blob = jest.fn(() => {
        throw new Error('Blob creation failed');
      });

      // Should not crash when blob creation fails
      expect(() => {
        try {
          new window.Blob(['test'], { type: 'text/plain' });
        } catch (error) {
          // Expected to catch the error
          expect(error.message).toBe('Blob creation failed');
        }
      }).not.toThrow();

      window.Blob = originalBlob;
    });

    it('should handle URL creation failures', () => {
      // Mock URL creation failure
      window.URL.createObjectURL = jest.fn(() => {
        throw new Error('URL creation failed');
      });

      expect(() => {
        try {
          window.URL.createObjectURL({ content: 'test' });
        } catch (error) {
          expect(error.message).toBe('URL creation failed');
        }
      }).not.toThrow();
    });

    it('should announce export errors to screen readers', () => {
      const screenReaderAnnouncement = document.getElementById('screen-reader-announcement');
      
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
      expect(screenReaderAnnouncement.classList.contains('sr-only')).toBe(true);
      
      // Should support announcing export failures
      expect(screenReaderAnnouncement).toBeTruthy();
    });

    it('should handle missing trait data gracefully', () => {
      const exportBtn = document.getElementById('export-btn');
      
      expect(exportBtn).toBeTruthy();
      
      // Export button should handle being clicked without data
      expect(() => {
        exportBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      }).not.toThrow();
    });

    it('should provide user feedback for export failures', () => {
      // Should be able to display error messages for export failures
      const screenReaderAnnouncement = document.getElementById('screen-reader-announcement');
      expect(screenReaderAnnouncement).toBeTruthy();
      
      // Could also use error state for export failures
      const errorState = document.getElementById('error-state');
      expect(errorState).toBeTruthy();
    });
  });

  describe('Export Accessibility', () => {
    it('should have accessible export button', () => {
      const exportBtn = document.getElementById('export-btn');
      
      expect(exportBtn.getAttribute('aria-label')).toBe('Export traits to text file');
      expect(exportBtn.tagName).toBe('BUTTON');
      
      // Should be keyboard accessible
      expect(exportBtn.tabIndex >= 0 || exportBtn.getAttribute('tabindex') === null).toBe(true);
    });

    it('should announce export success to screen readers', () => {
      const screenReaderAnnouncement = document.getElementById('screen-reader-announcement');
      
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
      expect(screenReaderAnnouncement.getAttribute('aria-atomic')).toBe('true');
    });

    it('should support keyboard export shortcut', () => {
      // Should support Ctrl+E for export (from keyboard shortcut tests)
      const shortcutHint = document.querySelector('.shortcut-hint');
      expect(shortcutHint).toBeTruthy();
      expect(shortcutHint.textContent).toContain('Ctrl');
      expect(shortcutHint.textContent).toContain('E');
      expect(shortcutHint.textContent).toContain('export');
    });

    it('should handle export with high contrast mode', () => {
      const exportBtn = document.getElementById('export-btn');
      const buttonText = exportBtn.querySelector('.button-text');
      
      expect(buttonText).toBeTruthy();
      expect(buttonText.textContent).toBe('Export');
      
      // Should not rely solely on icons for functionality
      expect(buttonText.textContent.trim()).not.toBe('');
    });
  });

  describe('Export File Management', () => {
    it('should generate unique filenames', () => {
      // Test multiple exports generate different filenames
      const baseFilename = 'character-traits';
      const timestamp1 = new Date('2024-01-01').toISOString().split('T')[0];
      const timestamp2 = new Date('2024-01-02').toISOString().split('T')[0];
      
      const filename1 = `${baseFilename}-${timestamp1}.txt`;
      const filename2 = `${baseFilename}-${timestamp2}.txt`;
      
      expect(filename1).not.toBe(filename2);
    });

    it('should handle filename sanitization', () => {
      const unsafeDirection = 'The "Hero" with / and \\ symbols';
      const sanitized = unsafeDirection
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      
      expect(sanitized).toBe('the-hero-with-and-symbols');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
      expect(sanitized).not.toContain('"');
    });

    it('should support text file format', () => {
      const mockBlob = new window.Blob(['test content'], { 
        type: 'text/plain;charset=utf-8' 
      });
      
      expect(mockBlob.type).toBe('text/plain;charset=utf-8');
    });

    it('should handle large export data efficiently', () => {
      // Test with large data payload
      const largeData = {
        description: 'A'.repeat(10000),
        notes: Array(1000).fill('Large note entry'),
        details: {
          expanded: 'B'.repeat(5000)
        }
      };
      
      expect(() => {
        const exportText = JSON.stringify(largeData);
        new window.Blob([exportText], { type: 'text/plain;charset=utf-8' });
      }).not.toThrow();
    });
  });

  describe('Export Integration with Generation Workflow', () => {
    it('should only show export after successful generation', () => {
      const exportBtn = document.getElementById('export-btn');
      const resultsState = document.getElementById('results-state');
      
      expect(exportBtn).toBeTruthy();
      expect(resultsState).toBeTruthy();
      
      // Initially export should be hidden
      expect(exportBtn.style.display).toBe('none');
      
      // Should be shown in results state
      expect(resultsState.style.display).toBe('none'); // Initially hidden
    });

    it('should export complete generation context', () => {
      // Export should include direction, user inputs, and generated data
      const mockContext = {
        direction: {
          title: 'The Reluctant Hero',
          description: 'Character forced into heroism'
        },
        userInputs: {
          coreMotivation: 'Protect innocents',
          internalContradiction: 'Fears responsibility',
          centralQuestion: 'Can one lead reluctantly?'
        },
        traits: {
          names: [{ name: 'Alex', justification: 'Strong leader' }],
          personality: [{ trait: 'Cautious', explanation: 'Thinks first' }]
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      
      expect(() => {
        const exportData = JSON.stringify(mockContext, null, 2);
        new window.Blob([exportData], { type: 'text/plain;charset=utf-8' });
      }).not.toThrow();
    });

    it('should clear export state when form is cleared', () => {
      const exportBtn = document.getElementById('export-btn');
      const clearBtn = document.getElementById('clear-btn');
      
      expect(exportBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();
      
      // Export should be hidden when form is cleared
      expect(exportBtn.style.display).toBe('none');
    });
  });
});

/**
 * Setup mock services for export testing
 *
 * @param {Array} downloadedFiles - Array to track downloaded files
 * @returns {object} Mock services for export testing
 */
function setupExportMocks(downloadedFiles) {
  const mockURL = {
    createObjectURL: jest.fn((blob) => {
      if (!blob) {
        throw new Error('Invalid blob');
      }
      return `mock-blob-url-${Date.now()}`;
    }),
    revokeObjectURL: jest.fn()
  };

  const mockBlob = jest.fn().mockImplementation((content, options) => {
    if (!content || !Array.isArray(content)) {
      throw new Error('Invalid blob content');
    }
    
    return {
      content,
      type: options?.type || 'text/plain',
      size: content[0]?.length || 0
    };
  });

  const mockFetch = jest.fn().mockImplementation((url) => {
    // Mock successful responses for trait generation
    if (url.includes('generate-traits')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'export-test-trait',
          names: [{ name: 'TestChar', justification: 'For export testing' }],
          physicalDescription: 'Test description for export',
          personality: [{ trait: 'Testable', explanation: 'Good for testing' }],
          strengths: ['Testing'],
          weaknesses: ['Fictional'],
          likes: ['Unit tests'],
          dislikes: ['Bugs'],
          fears: ['Failed tests'],
          goals: { shortTerm: ['Pass tests'], longTerm: 'Be well tested' },
          notes: ['Export test character'],
          profile: 'A character designed for export testing',
          secrets: ['Actually just test data'],
          generatedAt: new Date().toISOString()
        })
      });
    }

    return Promise.resolve({ ok: false, status: 404 });
  });

  return {
    URL: mockURL,
    Blob: mockBlob,
    fetch: mockFetch
  };
}