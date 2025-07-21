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
      buildSpeechMeta(doc, mockDomFactory, { thoughts: undefined, notes: '' })
    ).toBeNull();
  });

  it('should return a fragment with two buttons when both thoughts and notes are provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'Inner monologue',
      notes: 'A private note',
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true)); // Use cloneNode to append

    const thoughtsButton = getByLabelText(container, 'View inner thoughts');
    const notesButton = getByLabelText(container, 'View private notes');

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
    const notesTooltip = getByText(notesButton, 'A private note');
    expect(notesTooltip).not.toBeNull();
    expect(notesTooltip.classList.contains('meta-tooltip')).toBe(true);
  });

  it('should return a fragment with only the thoughts button if only thoughts are provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'Just a thought',
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(container, 'View inner thoughts');
    expect(thoughtsButton).not.toBeNull();
    expect(getByText(thoughtsButton, 'Just a thought')).not.toBeNull();
    expect(container.querySelector('.notes')).toBeNull();
  });

  it('should return a fragment with only the notes button if only notes are provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      notes: 'Just a note',
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(container, 'View private notes');
    expect(notesButton).not.toBeNull();
    expect(getByText(notesButton, 'Just a note')).not.toBeNull();
    expect(container.querySelector('.thoughts')).toBeNull();
  });

  it('should use rich HTML for structured notes when notesRaw is provided', () => {
    const notesRaw = {
      text: 'Character seems nervous',
      subject: 'Alice', 
      subjectType: 'character',
      tags: ['emotion']
    };
    
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      notes: 'Plain fallback text',
      notesRaw: notesRaw,
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(container, 'View private notes');
    expect(notesButton).not.toBeNull();
    
    // Should have the enhanced tooltip class
    const tooltip = notesButton.querySelector('.meta-tooltip');
    expect(tooltip.classList.contains('meta-tooltip--notes')).toBe(true);
    
    // Should contain rich HTML content
    expect(tooltip.innerHTML).toContain('notes-container');
    expect(tooltip.innerHTML).toContain('note-subject-type');
    expect(tooltip.innerHTML).toContain('Alice');
    expect(tooltip.innerHTML).toContain('Character seems nervous');
    expect(tooltip.innerHTML).toContain('emotion');
    expect(tooltip.innerHTML).toContain('👤'); // Character icon
  });

  it('should fallback to plain text when notesRaw is not provided', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      notes: 'Plain text note',
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(container, 'View private notes');
    const tooltip = notesButton.querySelector('.meta-tooltip');
    
    // Should NOT have the enhanced tooltip class
    expect(tooltip.classList.contains('meta-tooltip--notes')).toBe(false);
    
    // Should contain plain text
    expect(tooltip.textContent).toBe('Plain text note');
    expect(tooltip.innerHTML).not.toContain('notes-container');
  });

  it('should fallback to plain text when notesRaw produces empty HTML', () => {
    const notesRaw = null; // This will produce empty HTML
    
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      notes: 'Fallback text',
      notesRaw: notesRaw,
    });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(container, 'View private notes');
    const tooltip = notesButton.querySelector('.meta-tooltip');
    
    // Should NOT have the enhanced tooltip class
    expect(tooltip.classList.contains('meta-tooltip--notes')).toBe(false);
    
    // Should contain fallback text
    expect(tooltip.textContent).toBe('Fallback text');
  });

  it('snapshot test should show focus state correctly', () => {
    const fragment = buildSpeechMeta(doc, mockDomFactory, {
      thoughts: 'foo',
      notes: 'bar',
    });
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(container, 'View inner thoughts');
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
      notes: 'Note',
    });
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(container, 'View inner thoughts');
    const notesButton = getByLabelText(container, 'View private notes');
    expect(thoughtsButton.querySelector('svg').id).toBe('t');
    expect(notesButton.querySelector('svg').id).toBe('n');

    setIconRegistry(null);
  });
});
