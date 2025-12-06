/**
 * @file Integration tests validating note formatting across display, HTML tooltip, and clipboard helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { formatNotesForDisplay } from '../../../src/turns/states/helpers/noteFormatter.js';
import { formatNotesAsRichHtml } from '../../../src/domUI/helpers/noteTooltipFormatter.js';
import { formatNotesForClipboard } from '../../../src/domUI/helpers/clipboardUtils.js';

describe('Note formatting integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('harmonizes plain text, tooltip HTML, and clipboard formatting for complex note collections', () => {
    const notes = [
      {
        text: ' Lead discovered at <script>alert(1)</script> the docks ',
        subject: 'Investigation Alpha',
        subjectType: 'Discovery',
        context: ' Warehouse 13 ',
      },
      {
        text: 'Second clue about contraband routes',
        subject: 'Observation Team',
        context: 'Hidden catwalk',
      },
      null,
      { text: '   ' },
    ];

    const plainText = formatNotesForDisplay(notes);

    expect(plainText).toBe(
      [
        '[Discovery] Investigation Alpha: Lead discovered at <script>alert(1)</script> the docks (Warehouse 13)',
        'Observation Team: Second clue about contraband routes (Hidden catwalk)',
      ].join('\n')
    );

    const tooltipHtml = formatNotesAsRichHtml(notes);
    document.body.innerHTML = tooltipHtml;

    const container = document.querySelector('.notes-container--multiple');
    expect(container).not.toBeNull();

    const noteItems = Array.from(document.querySelectorAll('.note-item'));
    expect(noteItems).toHaveLength(2);

    // Ensure sanitization removed executable HTML while preserving text content
    expect(noteItems[0].innerHTML).not.toContain('<script>');
    expect(noteItems[0].querySelector('.note-content').textContent.trim()).toBe(
      'Lead discovered at <script>alert(1)</script> the docks'
    );
    const subjectTypeElement = noteItems[0].querySelector('.note-subject-type');
    expect(
      subjectTypeElement?.querySelector('.note-type-icon')?.textContent
    ).toBe('🔍');
    expect(subjectTypeElement?.dataset.type).toBe('discovery');

    // Reconstruct textual view from DOM structure to confirm cross-module alignment
    const aggregatedFromDom = noteItems
      .map((item) => {
        const typeElement = item.querySelector('.note-subject-type');
        const rawType = typeElement?.dataset.type;
        const type = rawType
          ? `${rawType.charAt(0).toUpperCase()}${rawType.slice(1)}`
          : null;
        const subject = item.querySelector('.note-subject')?.textContent.trim();
        const content =
          item.querySelector('.note-content')?.textContent.trim() ?? '';
        const context = item.querySelector('.note-context')?.textContent.trim();

        let composed = content;
        if (subject) {
          composed = `${subject}: ${composed}`;
        }
        if (type) {
          composed = `[${type}] ${composed}`;
        }
        if (context) {
          composed = `${composed} (${context})`;
        }

        return composed;
      })
      .join('\n');

    expect(aggregatedFromDom).toBe(plainText);

    const clipboardText = formatNotesForClipboard(notes);
    expect(clipboardText).toBe(
      [
        'Notes (2):',
        '',
        '1. [Discovery] Investigation Alpha: Lead discovered at <script>alert(1)</script> the docks',
        '  (Context: Warehouse 13)',
        '',
        '2. Observation Team: Second clue about contraband routes',
        '  (Context: Hidden catwalk)',
      ].join('\n')
    );
  });

  it('formats a single note consistently across helpers with subject metadata and sanitization', () => {
    const note = {
      text: '  <b>Resolve meeting</b> agenda drafted  ',
      subject: 'Operations',
      subjectType: 'Event',
      context: ' HQ Atrium ',
    };

    const displayText = formatNotesForDisplay(note);
    expect(displayText).toBe(
      '[Event] Operations: <b>Resolve meeting</b> agenda drafted (HQ Atrium)'
    );

    const tooltipHtml = formatNotesAsRichHtml(note);
    document.body.innerHTML = tooltipHtml;

    const container = document.querySelector('.notes-container--single');
    expect(container).not.toBeNull();
    const icon = container.querySelector('.note-type-icon');
    expect(icon?.textContent).toBe('📅');

    const content = container.querySelector('.note-content');
    expect(content?.textContent).toBe('<b>Resolve meeting</b> agenda drafted');
    expect(content?.innerHTML).toBe(
      '&lt;b&gt;Resolve meeting&lt;/b&gt; agenda drafted'
    );

    const clipboardText = formatNotesForClipboard(note);
    expect(clipboardText).toBe(
      '[Event] Operations: <b>Resolve meeting</b> agenda drafted\n  (Context: HQ Atrium)'
    );
  });

  it('gracefully ignores non-object or empty inputs across formatting helpers', () => {
    const noisyInputs = ['just a string', 42, false, null, { text: '   ' }];

    expect(formatNotesForDisplay(noisyInputs)).toBeNull();
    expect(formatNotesAsRichHtml(noisyInputs)).toBe('');
    expect(formatNotesForClipboard(noisyInputs)).toBe('');

    expect(formatNotesForDisplay(null)).toBeNull();
    expect(formatNotesForDisplay('standalone string')).toBeNull();
    expect(formatNotesAsRichHtml(undefined)).toBe('');
    expect(formatNotesForClipboard(undefined)).toBe('');

    const minimalStructuredNote = {
      text: 'Shadow spotted near the greenhouse',
      subjectType: 'Observation',
    };

    expect(formatNotesForDisplay(minimalStructuredNote)).toBe(
      '[Observation] Shadow spotted near the greenhouse'
    );

    const minimalHtml = formatNotesAsRichHtml(minimalStructuredNote);
    document.body.innerHTML = minimalHtml;
    expect(document.querySelector('.note-subject')).toBeNull();
    expect(document.querySelector('.note-context')).toBeNull();

    const minimalClipboard = formatNotesForClipboard(minimalStructuredNote);
    expect(minimalClipboard).toBe(
      '[Observation] Shadow spotted near the greenhouse'
    );

    expect(formatNotesForDisplay({ text: '   ', subject: 'Empty' })).toBeNull();
  });
});
