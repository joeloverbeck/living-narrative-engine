import { buildSpeechMeta } from '../../../../src/domUI/helpers/buildSpeechMeta.js';
import { JSDOM } from 'jsdom';
import { getByLabelText, getByText, queryByText } from '@testing-library/dom';
import { describe, beforeEach, it, expect } from '@jest/globals';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { setIconRegistry } from '../../../../src/domUI/icons.js';

// A mock DomElementFactory that creates real DOM nodes using the provided document
const createMockDomFactory = (document) => ({
  create: (tagName, options = {}) => {
    const el = document.createElement(tagName);
    if (options.cls) {
      el.className = options.cls;
    }
    if (options.attrs) {
      for (const [key, value] of Object.entries(options.attrs)) {
        el.setAttribute(key, value);
      }
    }
    if (options.text) {
      el.textContent = options.text;
    }
    return el;
  },
});

describe('buildSpeechMeta', () => {
  let dom;
  let mockDomFactory;
  let container;
  let doc;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    doc = dom.window.document;
    mockDomFactory = createMockDomFactory(doc);
    container = doc.body;
  });

  it('should return null if both thoughts and notes are falsy', () => {
    expect(buildSpeechMeta(doc, mockDomFactory, {})).toBeNull();
    expect(
      buildSpeechMeta(doc, mockDomFactory, { thoughts: '', notes: null })
    ).toBeNull();
    expect(
      buildSpeechMeta(doc, mockDomFactory, {
        thoughts: undefined,
        notes: '',
      })
    ).toBeNull();
  });

  it('should return a fragment with two buttons when both thoughts and notes are provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'Inner monologue',
      notes: {
        text: 'A private note',
        subject: 'TestSubject',
        subjectType: 'observation',
      },
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true)); // Use cloneNode to append

    const thoughtsButton = getByLabelText(
      container,
      'Click to copy thoughts to clipboard'
    );
    const notesButton = getByLabelText(
      container,
      'Click to copy notes to clipboard'
    );

    expect(thoughtsButton).not.toBeNull();
    expect(notesButton).not.toBeNull();

    // Verify Thoughts Button
    expect(thoughtsButton.tagName).toBe('BUTTON');
    expect(thoughtsButton.classList.contains('meta-btn')).toBe(true);
    expect(thoughtsButton.classList.contains('thoughts')).toBe(true);
    expect(thoughtsButton.style.getPropertyValue('--clr')).toBe(
      'var(--thoughts-icon-color)'
    );
    // FIX: Check for presence of SVG instead of exact innerHTML
    expect(thoughtsButton.querySelector('svg')).not.toBeNull();
    const thoughtsTooltip = getByText(thoughtsButton, 'Inner monologue');
    expect(thoughtsTooltip).not.toBeNull();
    expect(thoughtsTooltip.classList.contains('meta-tooltip')).toBe(true);
    expect(queryByText(thoughtsButton, 'A private note')).toBeNull();

    // Verify Notes Button
    expect(notesButton.tagName).toBe('BUTTON');
    expect(notesButton.classList.contains('meta-btn')).toBe(true);
    expect(notesButton.classList.contains('notes')).toBe(true);
    expect(notesButton.style.getPropertyValue('--clr')).toBe(
      'var(--notes-icon-color)'
    );
    // FIX: Check for presence of SVG instead of exact innerHTML
    expect(notesButton.querySelector('svg')).not.toBeNull();
    const notesTooltip = notesButton.querySelector('.meta-tooltip');
    expect(notesTooltip).not.toBeNull();
    expect(notesTooltip.classList.contains('meta-tooltip--notes')).toBe(true);
    expect(notesTooltip.innerHTML).toContain('A private note');
  });

  it('should return a fragment with only the thoughts button if only thoughts are provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'Just a thought',
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(
      container,
      'Click to copy thoughts to clipboard'
    );
    expect(thoughtsButton).not.toBeNull();
    expect(getByText(thoughtsButton, 'Just a thought')).not.toBeNull();
    expect(container.querySelector('.notes')).toBeNull();
  });

  it('should return a fragment with only the notes button if only notes is provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      notes: {
        text: 'Just a note',
        subject: 'TestSubject',
        subjectType: 'observation',
      },
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(
      container,
      'Click to copy notes to clipboard'
    );
    expect(notesButton).not.toBeNull();
    const tooltip = notesButton.querySelector('.meta-tooltip');
    expect(tooltip.innerHTML).toContain('Just a note');
    expect(container.querySelector('.thoughts')).toBeNull();
  });

  it('should use rich HTML for structured notes when notes is provided', () => {
    const notes = {
      text: 'Character seems nervous',
      subject: 'Alice',
      subjectType: 'character',
    };

    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      notes: notes,
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(
      container,
      'Click to copy notes to clipboard'
    );
    expect(notesButton).not.toBeNull();

    // Should have the enhanced tooltip class
    const tooltip = notesButton.querySelector('.meta-tooltip');
    expect(tooltip.classList.contains('meta-tooltip--notes')).toBe(true);

    // Should contain rich HTML content
    expect(tooltip.innerHTML).toContain('notes-container');
    expect(tooltip.innerHTML).toContain('note-subject-type');
    expect(tooltip.innerHTML).toContain('Alice');
    expect(tooltip.innerHTML).toContain('Character seems nervous');
    expect(tooltip.innerHTML).toContain('👤'); // Character icon
  });

  it('snapshot test should show focus state correctly', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'foo',
      notes: {
        text: 'bar',
        subject: 'TestSubject',
        subjectType: 'observation',
      },
    });
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(
      container,
      'Click to copy thoughts to clipboard'
    );
    thoughtsButton.focus(); // Simulate focus

    // JSDOM adds a :focus pseudo-class, which is sufficient for this test
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders custom icons provided via the registry', () => {
    const registry = new InMemoryDataRegistry();
    setIconRegistry(registry);
    registry.store('ui-icons', 'thoughts', { markup: '<svg id="t"></svg>' });
    registry.store('ui-icons', 'notes', { markup: '<svg id="n"></svg>' });

    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'Hi',
      notes: {
        text: 'Note',
        subject: 'TestSubject',
        subjectType: 'observation',
      },
    });
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(
      container,
      'Click to copy thoughts to clipboard'
    );
    const notesButton = getByLabelText(
      container,
      'Click to copy notes to clipboard'
    );
    expect(thoughtsButton.querySelector('svg').id).toBe('t');
    expect(notesButton.querySelector('svg').id).toBe('n');

    setIconRegistry(null);
  });
});
