import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ClicheFilterService } from '../../../src/clichesGenerator/services/ClicheFilterService.js';
import { ClicheExporter } from '../../../src/clichesGenerator/services/ClicheExporter.js';

const readBlob = async (blob) => {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Response(blob).text();
};

describe('ClicheExporter integration', () => {
  let exporter;
  let filterService;
  let sampleData;
  let clipboardWriteMock;
  let originalClipboardDescriptor;
  let OriginalBlob;

  beforeEach(() => {
    exporter = new ClicheExporter();
    filterService = new ClicheFilterService();
    OriginalBlob = global.Blob;
    global.Blob = class RecordingBlob {
      constructor(parts, options = {}) {
        this.type = options.type || '';
        this.#chunks = parts.map((part) =>
          typeof part === 'string' ? part : String(part)
        );
      }

      async text() {
        return this.#chunks.join('');
      }

      #chunks;
    };
    sampleData = {
      metadata: {
        createdAt: '2025-01-01T10:00:00Z',
        totalCount: 4,
        model: 'integration-suite-model',
      },
      categories: [
        {
          id: 'mystery',
          title: 'Mysterious Traits',
          count: 2,
          items: [
            'Keeps secrets from allies',
            'Mysterious aura follows everywhere',
          ],
        },
        {
          id: 'romance',
          title: 'Romantic Tropes',
          count: 2,
          items: ['Devoted admirer waits patiently', 'Grand romantic gesture'],
        },
      ],
      tropesAndStereotypes: [
        'Mysterious loner who avoids attachments',
        'Comedic relief best friend',
      ],
    };

    document.body.innerHTML = '<div id="integration-root"></div>';

    clipboardWriteMock = jest.fn().mockResolvedValue(undefined);
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'clipboard'
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteMock },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (OriginalBlob) {
      global.Blob = OriginalBlob;
    }
    if (originalClipboardDescriptor) {
      Object.defineProperty(
        navigator,
        'clipboard',
        originalClipboardDescriptor
      );
    } else {
      delete navigator.clipboard;
    }
    document.body.innerHTML = '';
  });

  it('exports filtered cliché data and triggers downloads for each supported format', async () => {
    jest.useFakeTimers();

    const createUrlSpy = jest.spyOn(URL, 'createObjectURL');
    const revokeSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const appendSpy = jest.spyOn(document.body, 'appendChild');
    const removeSpy = jest.spyOn(document.body, 'removeChild');

    const filtered = filterService.applyFilters(sampleData, 'mysterious', [
      'mystery',
      'romance',
    ]);
    const stats = filterService.getStatistics(filtered);
    expect(stats).toEqual({
      totalCategories: 1,
      totalItems: 1,
      totalTropes: 1,
    });

    const capturedBlobs = [];
    createUrlSpy.mockImplementation((blob) => {
      capturedBlobs.push(blob);
      return `blob:${capturedBlobs.length}`;
    });

    try {
      exporter.export(filtered, 'markdown');
      exporter.export(filtered, 'json');
      exporter.export(filtered, 'text');

      expect(createUrlSpy).toHaveBeenCalledTimes(3);
      expect(appendSpy).toHaveBeenCalledTimes(3);
      expect(removeSpy).toHaveBeenCalledTimes(3);

      const appendedAnchors = appendSpy.mock.calls.map(([anchor]) => anchor);
      expect(appendedAnchors.map((anchor) => anchor.download)).toEqual([
        'cliches.md',
        'cliches.json',
        'cliches.txt',
      ]);
      expect(removeSpy.mock.calls.map(([anchor]) => anchor)).toEqual(
        appendedAnchors
      );

      const [markdownBlob, jsonBlob, textBlob] = capturedBlobs;
      expect(markdownBlob.type).toBe('text/markdown');
      expect(jsonBlob.type).toBe('application/json');
      expect(textBlob.type).toBe('text/plain');

      const markdownContent = await readBlob(markdownBlob);
      expect(markdownContent).toContain('### Mysterious Traits (1)');
      expect(markdownContent).toContain(
        '⚠️ Mysterious loner who avoids attachments'
      );

      const jsonContent = await readBlob(jsonBlob);
      expect(jsonContent).toContain('"exportDate"');
      expect(jsonContent).toContain('"Mysterious aura follows everywhere"');

      const textContent = await readBlob(textBlob);
      expect(textContent).toContain('MYSTERIOUS TRAITS (1)');
      expect(textContent).toContain('OVERALL TROPES & STEREOTYPES');

      expect(revokeSpy).not.toHaveBeenCalled();
      jest.runAllTimers();
      expect(revokeSpy).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('throws helpful errors when export inputs are invalid', () => {
    const filtered = filterService.applyFilters(sampleData, 'mysterious', [
      'mystery',
    ]);

    expect(() => exporter.export(null, 'markdown')).toThrow(
      'No data to export'
    );
    expect(() => exporter.export(filtered, 'binary')).toThrow(
      'Unsupported export format: binary'
    );
  });

  it('copies filtered results to the clipboard for each supported format', async () => {
    const filtered = filterService.applyFilters(sampleData, 'mysterious', [
      'mystery',
    ]);

    await exporter.copyToClipboard(filtered, 'markdown');
    await exporter.copyToClipboard(filtered, 'json');
    await exporter.copyToClipboard(filtered);

    const emptyFiltered = filterService.applyFilters(
      sampleData,
      'nonexistent',
      ['romance']
    );
    const minimalStructure = {
      ...emptyFiltered,
      metadata: { createdAt: '2025-01-02T00:00:00Z', totalCount: 0 },
      categories: null,
      tropesAndStereotypes: null,
    };

    await exporter.copyToClipboard(minimalStructure, 'markdown');
    await exporter.copyToClipboard(minimalStructure);

    expect(clipboardWriteMock).toHaveBeenCalledTimes(5);
    expect(clipboardWriteMock.mock.calls[0][0]).toContain(
      '# Character Clichés Analysis'
    );
    expect(clipboardWriteMock.mock.calls[1][0]).toContain('"categories"');
    expect(clipboardWriteMock.mock.calls[2][0]).toContain(
      'OVERALL TROPES & STEREOTYPES'
    );
    expect(clipboardWriteMock.mock.calls[3][0]).not.toContain('### ');
    expect(clipboardWriteMock.mock.calls[4][0]).not.toContain(
      'OVERALL TROPES & STEREOTYPES'
    );
  });
});
