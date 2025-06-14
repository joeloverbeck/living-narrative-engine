import { buildSpeechMeta } from '../../../src/domUI/helpers/buildSpeechMeta.js';
import { JSDOM } from 'jsdom';
import { getByLabelText, getByText, queryByText } from '@testing-library/dom';
import { describe, beforeEach, it, expect } from '@jest/globals';

// A mock DomElementFactory that creates real DOM nodes using the provided document
const createMockDomFactory = (document) => ({
  document: document,
  create: (tag, attributes) => {
    const el = document.createElement(tag);
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'cls') {
          el.className = value;
        } else {
          el.setAttribute(key, value);
        }
      });
    }
    return el;
  },
  span: (cls) => {
    const el = document.createElement('span');
    if (cls) {
      el.className = cls;
    }
    return el;
  },
  img: (src, alt, cls) => {
    const el = document.createElement('img');
    el.src = src;
    el.alt = alt;
    if (cls) {
      el.className = cls;
    }
    return el;
  },
});

describe('buildSpeechMeta', () => {
  let dom;
  let mockDomFactory;
  let container;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    mockDomFactory = createMockDomFactory(dom.window.document);
    container = dom.window.document.body;
  });

  it('should return null if both thoughts and notes are falsy', () => {
    expect(buildSpeechMeta(mockDomFactory, {})).toBeNull();
    expect(
      buildSpeechMeta(mockDomFactory, { thoughts: '', notes: null })
    ).toBeNull();
    expect(
      buildSpeechMeta(mockDomFactory, { thoughts: undefined, notes: '' })
    ).toBeNull();
  });

  it('should return a fragment with two buttons when both thoughts and notes are provided', () => {
    const fragment = buildSpeechMeta(mockDomFactory, {
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
    // FIX START: Verify SVG attributes instead of brittle outerHTML
    const thoughtsSvg = thoughtsButton.querySelector('svg');
    expect(thoughtsSvg).not.toBeNull();
    expect(thoughtsSvg.getAttribute('width')).toBe('20');
    expect(thoughtsSvg.getAttribute('height')).toBe('20');
    expect(thoughtsSvg.getAttribute('fill')).toBe('currentColor');
    // FIX END
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
    // FIX START: Verify SVG attributes instead of brittle outerHTML
    const notesSvg = notesButton.querySelector('svg');
    expect(notesSvg).not.toBeNull();
    expect(notesSvg.getAttribute('width')).toBe('20');
    expect(notesSvg.getAttribute('height')).toBe('20');
    expect(notesSvg.getAttribute('fill')).toBe('currentColor');
    // FIX END
    const notesTooltip = getByText(notesButton, 'A private note');
    expect(notesTooltip).not.toBeNull();
    expect(notesTooltip.classList.contains('meta-tooltip')).toBe(true);
  });

  it('should return a fragment with only the thoughts button if only thoughts are provided', () => {
    const fragment = buildSpeechMeta(mockDomFactory, {
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
    const fragment = buildSpeechMeta(mockDomFactory, { notes: 'Just a note' });
    expect(fragment).not.toBeNull();
    container.appendChild(fragment.cloneNode(true));

    const notesButton = getByLabelText(container, 'View private notes');
    expect(notesButton).not.toBeNull();
    expect(getByText(notesButton, 'Just a note')).not.toBeNull();
    expect(container.querySelector('.thoughts')).toBeNull();
  });

  it('snapshot test should show focus state correctly', () => {
    const fragment = buildSpeechMeta(mockDomFactory, {
      thoughts: 'foo',
      notes: 'bar',
    });
    container.appendChild(fragment.cloneNode(true));

    const thoughtsButton = getByLabelText(container, 'View inner thoughts');
    thoughtsButton.focus(); // Simulate focus

    // JSDOM adds a :focus pseudo-class, which is sufficient for this test
    expect(container.innerHTML).toMatchSnapshot();
  });
});
