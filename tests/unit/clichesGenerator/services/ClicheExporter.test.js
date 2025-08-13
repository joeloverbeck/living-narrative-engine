/**
 * @file Unit tests for ClicheExporter
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClicheExporter } from '../../../../src/clichesGenerator/services/ClicheExporter.js';

describe('ClicheExporter', () => {
  let exporter;
  let mockData;
  let createElementSpy;
  let mockLink;

  beforeEach(() => {
    exporter = new ClicheExporter();

    mockData = {
      categories: [
        {
          id: 'names',
          title: 'Common Names',
          items: ['John Smith', 'Jane Doe'],
          count: 2,
        },
        {
          id: 'traits',
          title: 'Personality Traits',
          items: ['Brooding', 'Mysterious'],
          count: 2,
        },
      ],
      tropesAndStereotypes: ['The Chosen One', 'Dark Past'],
      metadata: {
        createdAt: '12/13/2024',
        totalCount: 4,
        model: 'Test Model',
      },
    };

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock Blob
    global.Blob = jest.fn((content, options) => ({
      content,
      type: options.type,
    }));

    // Mock document.createElement for download link
    mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: jest.fn(),
    };

    createElementSpy = jest.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName) => {
      if (tagName === 'a') {
        return mockLink;
      }
      return document.createElement(tagName);
    });

    // Mock document.body methods
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    // Mock clipboard API
    const clipboardMock = {
      writeText: jest.fn().mockResolvedValue(),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });

    // Mock setTimeout
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Export as Markdown', () => {
    it('should generate correct markdown format', () => {
      const markdown = exporter.exportAsMarkdown(mockData);

      expect(markdown).toContain('# Character Clichés Analysis');
      expect(markdown).toContain('**Generated:** 12/13/2024');
      expect(markdown).toContain('**Total Count:** 4');
      expect(markdown).toContain('**Model:** Test Model');
      expect(markdown).toContain('## Categories');
      expect(markdown).toContain('### Common Names (2)');
      expect(markdown).toContain('- John Smith');
      expect(markdown).toContain('- Jane Doe');
      expect(markdown).toContain('### Personality Traits (2)');
      expect(markdown).toContain('- Brooding');
      expect(markdown).toContain('- Mysterious');
      expect(markdown).toContain('## Overall Tropes & Stereotypes');
      expect(markdown).toContain('- ⚠️ The Chosen One');
      expect(markdown).toContain('- ⚠️ Dark Past');
    });

    it('should handle missing model in metadata', () => {
      const dataWithoutModel = {
        ...mockData,
        metadata: {
          createdAt: '12/13/2024',
          totalCount: 4,
        },
      };

      const markdown = exporter.exportAsMarkdown(dataWithoutModel);
      expect(markdown).not.toContain('**Model:**');
    });

    it('should handle empty tropes section', () => {
      const dataWithoutTropes = {
        ...mockData,
        tropesAndStereotypes: [],
      };

      const markdown = exporter.exportAsMarkdown(dataWithoutTropes);
      expect(markdown).not.toContain('## Overall Tropes & Stereotypes');
    });

    it('should handle null tropes section', () => {
      const dataWithNullTropes = {
        ...mockData,
        tropesAndStereotypes: null,
      };

      const markdown = exporter.exportAsMarkdown(dataWithNullTropes);
      expect(markdown).not.toContain('## Overall Tropes & Stereotypes');
    });
  });

  describe('Export as JSON', () => {
    it('should generate correct JSON format', () => {
      const json = exporter.exportAsJSON(mockData);
      const parsed = JSON.parse(json);

      expect(parsed.metadata.exportDate).toBeDefined();
      expect(parsed.metadata.createdAt).toBe('12/13/2024');
      expect(parsed.metadata.totalCount).toBe(4);
      expect(parsed.metadata.model).toBe('Test Model');
      expect(parsed.categories).toHaveLength(2);
      expect(parsed.categories[0].id).toBe('names');
      expect(parsed.categories[0].title).toBe('Common Names');
      expect(parsed.categories[0].count).toBe(2);
      expect(parsed.categories[0].items).toEqual(['John Smith', 'Jane Doe']);
      expect(parsed.tropesAndStereotypes).toEqual([
        'The Chosen One',
        'Dark Past',
      ]);
    });

    it('should be properly formatted', () => {
      const json = exporter.exportAsJSON(mockData);

      // Should have indentation
      expect(json).toContain('\n  ');

      // Should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include export timestamp', () => {
      const json = exporter.exportAsJSON(mockData);
      const parsed = JSON.parse(json);

      const exportDate = new Date(parsed.metadata.exportDate);
      expect(exportDate).toBeInstanceOf(Date);
      expect(exportDate.toISOString()).toBe(parsed.metadata.exportDate);
    });

    it('should handle empty categories', () => {
      const dataWithEmpty = {
        categories: [],
        tropesAndStereotypes: [],
        metadata: mockData.metadata,
      };

      const json = exporter.exportAsJSON(dataWithEmpty);
      const parsed = JSON.parse(json);

      expect(parsed.categories).toEqual([]);
      expect(parsed.tropesAndStereotypes).toEqual([]);
    });
  });

  describe('Export as Text', () => {
    it('should generate correct text format', () => {
      const text = exporter.exportAsText(mockData);

      expect(text).toContain('CHARACTER CLICHÉS ANALYSIS');
      expect(text).toContain('='.repeat(50));
      expect(text).toContain('Generated: 12/13/2024');
      expect(text).toContain('Total Count: 4');
      expect(text).toContain('Model: Test Model');
      expect(text).toContain('COMMON NAMES (2)');
      expect(text).toContain('• John Smith');
      expect(text).toContain('• Jane Doe');
      expect(text).toContain('PERSONALITY TRAITS (2)');
      expect(text).toContain('• Brooding');
      expect(text).toContain('• Mysterious');
      expect(text).toContain('OVERALL TROPES & STEREOTYPES');
      expect(text).toContain('⚠ The Chosen One');
      expect(text).toContain('⚠ Dark Past');
    });

    it('should have proper section separators', () => {
      const text = exporter.exportAsText(mockData);

      expect(text).toContain('-'.repeat(50));
      expect(text).toContain('-'.repeat('COMMON NAMES'.length + 5));
    });

    it('should handle categories with long titles', () => {
      const dataWithLongTitle = {
        categories: [
          {
            id: 'long',
            title: 'Very Long Category Title That Goes On',
            items: ['Item'],
            count: 1,
          },
        ],
        tropesAndStereotypes: [],
        metadata: mockData.metadata,
      };

      const text = exporter.exportAsText(dataWithLongTitle);
      expect(text).toContain('VERY LONG CATEGORY TITLE THAT GOES ON (1)');
      expect(text).toContain(
        '-'.repeat('VERY LONG CATEGORY TITLE THAT GOES ON'.length + 5)
      );
    });
  });

  describe('Export Method', () => {
    it('should trigger download for markdown', () => {
      exporter.export(mockData, 'markdown');

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('# Character Clichés Analysis')],
        { type: 'text/markdown' }
      );
      expect(mockLink.download).toBe('cliches.md');
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('should trigger download for json', () => {
      exporter.export(mockData, 'json');

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('"categories"')],
        { type: 'application/json' }
      );
      expect(mockLink.download).toBe('cliches.json');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should trigger download for text', () => {
      exporter.export(mockData, 'text');

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('CHARACTER CLICHÉS ANALYSIS')],
        { type: 'text/plain' }
      );
      expect(mockLink.download).toBe('cliches.txt');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        exporter.export(mockData, 'invalid');
      }).toThrow('Unsupported export format: invalid');
    });

    it('should throw error for null data', () => {
      expect(() => {
        exporter.export(null, 'markdown');
      }).toThrow('No data to export');
    });

    it('should clean up URL object after delay', () => {
      exporter.export(mockData, 'markdown');

      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('should set link display to none', () => {
      exporter.export(mockData, 'markdown');

      expect(mockLink.style.display).toBe('none');
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy text format by default', async () => {
      await exporter.copyToClipboard(mockData);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('CHARACTER CLICHÉS ANALYSIS')
      );
    });

    it('should copy markdown format', async () => {
      await exporter.copyToClipboard(mockData, 'markdown');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('# Character Clichés Analysis')
      );
    });

    it('should copy json format', async () => {
      await exporter.copyToClipboard(mockData, 'json');

      const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
      expect(() => JSON.parse(copiedText)).not.toThrow();
      expect(copiedText).toContain('"categories"');
    });

    it('should handle clipboard API failure', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(
        new Error('Clipboard failed')
      );

      await expect(exporter.copyToClipboard(mockData)).rejects.toThrow(
        'Clipboard failed'
      );
    });

    it('should handle invalid format for clipboard', async () => {
      await exporter.copyToClipboard(mockData, 'invalid');

      // Should default to text format
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('CHARACTER CLICHÉS ANALYSIS')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data', () => {
      const emptyData = {
        categories: [],
        tropesAndStereotypes: [],
        metadata: {
          createdAt: '12/13/2024',
          totalCount: 0,
        },
      };

      const markdown = exporter.exportAsMarkdown(emptyData);
      expect(markdown).toContain('**Total Count:** 0');
      expect(markdown).not.toContain('### ');

      const json = exporter.exportAsJSON(emptyData);
      const parsed = JSON.parse(json);
      expect(parsed.categories).toEqual([]);

      const text = exporter.exportAsText(emptyData);
      expect(text).toContain('Total Count: 0');
    });

    it('should handle special characters in content', () => {
      const specialData = {
        categories: [
          {
            id: 'special',
            title: 'Special & "Characters"',
            items: ['Item with <HTML>', 'Item with "quotes"'],
            count: 2,
          },
        ],
        tropesAndStereotypes: [],
        metadata: mockData.metadata,
      };

      const markdown = exporter.exportAsMarkdown(specialData);
      expect(markdown).toContain('Special & "Characters"');
      expect(markdown).toContain('Item with <HTML>');

      const json = exporter.exportAsJSON(specialData);
      const parsed = JSON.parse(json);
      expect(parsed.categories[0].title).toBe('Special & "Characters"');

      const text = exporter.exportAsText(specialData);
      expect(text).toContain('SPECIAL & "CHARACTERS"');
    });

    it('should handle very long item lists', () => {
      const longData = {
        categories: [
          {
            id: 'long',
            title: 'Long List',
            items: Array(100).fill('Item'),
            count: 100,
          },
        ],
        tropesAndStereotypes: Array(50).fill('Trope'),
        metadata: {
          createdAt: '12/13/2024',
          totalCount: 150,
        },
      };

      expect(() => {
        exporter.exportAsMarkdown(longData);
        exporter.exportAsJSON(longData);
        exporter.exportAsText(longData);
      }).not.toThrow();
    });

    it('should handle malformed data gracefully', () => {
      const malformedData = {
        categories: [
          {
            // Missing required fields
            title: 'Test',
          },
          {
            id: 'test',
            title: 'Test',
            items: null, // Null items
          },
        ],
        metadata: {},
      };

      expect(() => {
        exporter.exportAsMarkdown(malformedData);
      }).not.toThrow();
    });
  });
});
