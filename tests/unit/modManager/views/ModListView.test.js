/**
 * @file Unit tests for ModListView
 * @see src/modManager/views/ModListView.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModListView } from '../../../../src/modManager/views/ModListView.js';

describe('ModListView', () => {
  /** @type {HTMLElement} */
  let container;
  /** @type {{debug: jest.Mock}} */
  let mockLogger;
  /** @type {jest.Mock} */
  let onModToggle;
  /** @type {{createCard: jest.Mock, updateCardState: jest.Mock}} */
  let modCardComponent;
  /** @type {ModListView} */
  let view;

  const createMods = () => [
    {
      id: 'core',
      name: 'Core',
      version: '1.0.0',
      description: 'Core mod',
      author: 'Engine',
      dependencies: [],
      hasWorlds: true,
    },
    {
      id: 'extra',
      name: 'Extra',
      version: '1.0.0',
      description: 'Extra mod',
      author: 'Modder',
      dependencies: [],
      hasWorlds: false,
    },
  ];

  const createCardElement = ({
    id,
    locked = false,
    disabledCheckbox = false,
  }) => {
    const card = document.createElement('article');
    card.setAttribute('data-mod-id', id);
    card.className = `mod-card${locked ? ' mod-card--locked' : ''}`;
    card.setAttribute('tabindex', '0');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'mod-card__checkbox';
    checkbox.disabled = disabledCheckbox;
    card.appendChild(checkbox);

    return card;
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root');

    mockLogger = { debug: jest.fn() };
    onModToggle = jest.fn();

    modCardComponent = {
      createCard: jest.fn((mod) => createCardElement({ id: mod.id })),
      updateCardState: jest.fn(),
    };

    view = new ModListView({
      container,
      logger: mockLogger,
      onModToggle,
      modCardComponent,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('render displays loading state when isLoading is true', () => {
    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: true,
    });

    expect(container.querySelector('.mod-list__loading')?.hidden).toBe(false);
    expect(container.querySelector('.mod-list')?.hidden).toBe(true);
    expect(container.querySelector('.mod-list__empty')?.hidden).toBe(true);
  });

  it('render displays empty state when no mods', () => {
    view.render({
      mods: [],
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    expect(container.querySelector('.mod-list__empty')?.hidden).toBe(false);
    expect(container.querySelector('.mod-list')?.hidden).toBe(true);
  });

  it('render creates cards for all mods', () => {
    const mods = createMods();

    view.render({
      mods,
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    expect(modCardComponent.createCard).toHaveBeenCalledTimes(mods.length);
    expect(container.querySelectorAll('[data-mod-id]').length).toBe(mods.length);
  });

  it('render uses DocumentFragment for performance', () => {
    const fragmentSpy = jest.spyOn(document, 'createDocumentFragment');

    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    expect(fragmentSpy).toHaveBeenCalledTimes(1);
    fragmentSpy.mockRestore();
  });

  it('render updates card states without full re-render when only states change', () => {
    const mods = createMods();

    view.render({
      mods,
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    modCardComponent.createCard.mockClear();

    view.render({
      mods,
      getModDisplayInfo: (modId) => ({
        status: modId === 'core' ? 'core' : 'explicit',
        isExplicit: modId !== 'core',
        isDependency: false,
      }),
      isLoading: false,
    });

    expect(modCardComponent.createCard).not.toHaveBeenCalled();
    expect(modCardComponent.updateCardState).toHaveBeenCalledTimes(mods.length);
  });

  it('click on checkbox triggers onModToggle callback', () => {
    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    const card = container.querySelector('[data-mod-id="extra"]');
    const checkbox = card.querySelector('.mod-card__checkbox');
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onModToggle).toHaveBeenCalledWith('extra');
  });

  it('click on locked card does not trigger callback', () => {
    modCardComponent.createCard.mockImplementationOnce((mod) =>
      createCardElement({ id: mod.id, locked: true })
    );

    view.render({
      mods: [createMods()[0]],
      getModDisplayInfo: () => ({
        status: 'core',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    const card = container.querySelector('[data-mod-id="core"]');
    const checkbox = card.querySelector('.mod-card__checkbox');
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onModToggle).not.toHaveBeenCalled();
  });

  it('click on disabled checkbox does not trigger callback', () => {
    modCardComponent.createCard.mockImplementationOnce((mod) =>
      createCardElement({ id: mod.id, disabledCheckbox: true })
    );

    view.render({
      mods: [createMods()[0]],
      getModDisplayInfo: () => ({
        status: 'dependency',
        isExplicit: false,
        isDependency: true,
      }),
      isLoading: false,
    });

    const card = container.querySelector('[data-mod-id="core"]');
    const checkbox = card.querySelector('.mod-card__checkbox');
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onModToggle).not.toHaveBeenCalled();
  });

  it('keyboard Enter triggers mod toggle', () => {
    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    const card = container.querySelector('[data-mod-id="extra"]');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onModToggle).toHaveBeenCalledWith('extra');
  });

  it('keyboard Enter does not toggle when checkbox is disabled', () => {
    modCardComponent.createCard.mockImplementationOnce((mod) =>
      createCardElement({ id: mod.id, disabledCheckbox: true })
    );

    view.render({
      mods: [createMods()[0]],
      getModDisplayInfo: () => ({
        status: 'dependency',
        isExplicit: false,
        isDependency: true,
      }),
      isLoading: false,
    });

    const card = container.querySelector('[data-mod-id="core"]');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onModToggle).not.toHaveBeenCalled();
  });

  it('highlightMod adds animation class', () => {
    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    view.highlightMod('extra', 'activating');

    const card = container.querySelector('[data-mod-id="extra"]');
    expect(card.classList.contains('mod-card--activating')).toBe(true);

    card.dispatchEvent(new Event('animationend'));
    expect(card.classList.contains('mod-card--activating')).toBe(false);
  });

  it('scrollToMod scrolls card into view', () => {
    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    const card = container.querySelector('[data-mod-id="extra"]');
    card.scrollIntoView = jest.fn();

    view.scrollToMod('extra');

    expect(card.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('destroy cleans up container', () => {
    view.render({
      mods: createMods(),
      getModDisplayInfo: () => ({
        status: 'inactive',
        isExplicit: false,
        isDependency: false,
      }),
      isLoading: false,
    });

    expect(container.innerHTML).not.toBe('');

    view.destroy();

    expect(container.innerHTML).toBe('');
  });
});

