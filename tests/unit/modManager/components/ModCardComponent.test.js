/**
 * @file Unit tests for ModCardComponent
 * @see src/modManager/components/ModCardComponent.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModCardComponent } from '../../../../src/modManager/components/ModCardComponent.js';

describe('ModCardComponent', () => {
  /** @type {{debug: jest.Mock}} */
  let mockLogger;
  /** @type {ModCardComponent} */
  let component;

  /**
   * Create a mock mod metadata object
   * @param {Partial<import('../../../../src/modManager/services/ModDiscoveryService.js').ModMetadata>} [overrides]
   * @returns {import('../../../../src/modManager/services/ModDiscoveryService.js').ModMetadata}
   */
  const createMod = (overrides = {}) => ({
    id: 'test-mod',
    name: 'Test Mod',
    version: '1.0.0',
    description: 'A test mod for unit testing',
    author: 'Test Author',
    dependencies: [],
    conflicts: [],
    hasWorlds: false,
    ...overrides,
  });

  /**
   * Create a display info object
   * @param {Partial<import('../../../../src/modManager/components/ModCardComponent.js').ModDisplayInfo>} [overrides]
   * @returns {import('../../../../src/modManager/components/ModCardComponent.js').ModDisplayInfo}
   */
  const createDisplayInfo = (overrides = {}) => ({
    status: 'inactive',
    isExplicit: false,
    isDependency: false,
    ...overrides,
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = { debug: jest.fn() };
    component = new ModCardComponent({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws error when logger is missing', () => {
      expect(() => new ModCardComponent({})).toThrow(
        'ModCardComponent: logger is required'
      );
    });

    it('creates instance with valid logger', () => {
      const instance = new ModCardComponent({ logger: mockLogger });
      expect(instance).toBeInstanceOf(ModCardComponent);
    });
  });

  describe('createCard', () => {
    it('returns article element with correct role', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      expect(card.tagName).toBe('ARTICLE');
      expect(card.getAttribute('role')).toBe('listitem');
    });

    it('sets data-mod-id attribute', () => {
      const mod = createMod({ id: 'my-custom-mod' });
      const card = component.createCard(mod, createDisplayInfo());

      expect(card.dataset.modId).toBe('my-custom-mod');
    });

    it('sets tabindex for keyboard navigation', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      expect(card.getAttribute('tabindex')).toBe('0');
    });

    it('renders mod name', () => {
      const mod = createMod({ name: 'Awesome Mod' });
      const card = component.createCard(mod, createDisplayInfo());

      const nameEl = card.querySelector('.mod-card-name');
      expect(nameEl).not.toBeNull();
      expect(nameEl.textContent).toBe('Awesome Mod');
    });

    it('renders mod version with v prefix', () => {
      const mod = createMod({ version: '2.3.4' });
      const card = component.createCard(mod, createDisplayInfo());

      const versionEl = card.querySelector('.mod-card-version');
      expect(versionEl).not.toBeNull();
      expect(versionEl.textContent).toBe('v2.3.4');
    });

    it('renders mod description', () => {
      const mod = createMod({ description: 'This is a great mod' });
      const card = component.createCard(mod, createDisplayInfo());

      const descEl = card.querySelector('.mod-card-description');
      expect(descEl).not.toBeNull();
      expect(descEl.textContent).toBe('This is a great mod');
    });

    it('shows checkbox checked for active mods', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(true);
    });

    it('shows checkbox unchecked for inactive mods', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(false);
    });

    it('shows checkbox disabled for core mods', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'core' })
      );

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(true);
    });

    it('shows checkbox disabled for dependency mods', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'dependency', isDependency: true })
      );

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(true);
    });

    it('shows lock icon for core mods', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'core' })
      );

      const lockIcon = card.querySelector('.mod-card-lock-icon');
      expect(lockIcon).not.toBeNull();
      expect(lockIcon.textContent).toBe('🔒');
      expect(lockIcon.getAttribute('aria-hidden')).toBe('true');
    });

    it('does not show lock icon for non-core mods', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      const lockIcon = card.querySelector('.mod-card-lock-icon');
      expect(lockIcon).toBeNull();
    });

    it('shows Core badge for core status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'core' })
      );

      const badge = card.querySelector('.mod-badge.core');
      expect(badge).not.toBeNull();
      expect(badge.textContent).toBe('Core');
    });

    it('shows Dependency badge for dependency status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'dependency' })
      );

      const badge = card.querySelector('.mod-badge.auto');
      expect(badge).not.toBeNull();
      expect(badge.textContent).toBe('Dependency');
    });

    it('does not show badge for explicit status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      const badges = card.querySelector('.mod-card-badges');
      const statusBadge = badges.querySelector('.mod-badge.core, .mod-badge.auto');
      expect(statusBadge).toBeNull();
    });

    it('does not show badge for inactive status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      const badges = card.querySelector('.mod-card-badges');
      const statusBadge = badges.querySelector('.mod-badge.core, .mod-badge.auto');
      expect(statusBadge).toBeNull();
    });

    it('renders dependency count when mod has dependencies', () => {
      const mod = createMod({
        dependencies: [
          { id: 'dep-a', version: '1.0.0' },
          { id: 'dep-b', version: '2.0.0' },
        ],
      });
      const card = component.createCard(mod, createDisplayInfo());

      const depsEl = card.querySelector('.mod-card-dependencies');
      expect(depsEl).not.toBeNull();
      expect(depsEl.textContent).toContain('2 dependencies');
    });

    it('renders singular dependency for single dependency', () => {
      const mod = createMod({
        dependencies: [{ id: 'single-dep', version: '1.0.0' }],
      });
      const card = component.createCard(mod, createDisplayInfo());

      const depsEl = card.querySelector('.mod-card-dependencies');
      expect(depsEl).not.toBeNull();
      expect(depsEl.textContent).toContain('1 dependency');
    });

    it('does not render dependencies element when no dependencies', () => {
      const mod = createMod({ dependencies: [] });
      const card = component.createCard(mod, createDisplayInfo());

      const depsEl = card.querySelector('.mod-card-dependencies');
      expect(depsEl).toBeNull();
    });

    it('shows worlds badge when hasWorlds is true', () => {
      const mod = createMod({ hasWorlds: true });
      const card = component.createCard(mod, createDisplayInfo());

      const worldsBadge = card.querySelector('[aria-label="Contains worlds"]');
      expect(worldsBadge).not.toBeNull();
      expect(worldsBadge.textContent).toBe('🌍');
    });

    it('does not show worlds badge when hasWorlds is false', () => {
      const mod = createMod({ hasWorlds: false });
      const card = component.createCard(mod, createDisplayInfo());

      const worldsBadge = card.querySelector('[aria-label="Contains worlds"]');
      expect(worldsBadge).toBeNull();
    });

    it('escapes HTML in mod name to prevent XSS', () => {
      const mod = createMod({ name: '<script>alert("xss")</script>' });
      const card = component.createCard(mod, createDisplayInfo());

      const nameEl = card.querySelector('.mod-card-name');
      expect(nameEl.textContent).toBe('<script>alert("xss")</script>');
      expect(nameEl.innerHTML).not.toContain('<script>');
    });

    it('escapes HTML in mod description to prevent XSS', () => {
      const mod = createMod({
        description: '<img src=x onerror=alert(1)>',
      });
      const card = component.createCard(mod, createDisplayInfo());

      const descEl = card.querySelector('.mod-card-description');
      expect(descEl.textContent).toBe('<img src=x onerror=alert(1)>');
      expect(descEl.innerHTML).not.toContain('<img');
    });

    it('escapes HTML in mod version to prevent XSS', () => {
      const mod = createMod({ version: '"><script>evil()</script>' });
      const card = component.createCard(mod, createDisplayInfo());

      const versionEl = card.querySelector('.mod-card-version');
      expect(versionEl.innerHTML).not.toContain('<script>');
    });

    it('has correct CSS classes for core status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'core' })
      );

      expect(card.classList.contains('mod-card')).toBe(true);
      expect(card.classList.contains('active-core')).toBe(true);
      expect(card.classList.contains('mod-card--locked')).toBe(true);
    });

    it('has correct CSS classes for explicit status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      expect(card.classList.contains('mod-card')).toBe(true);
      expect(card.classList.contains('active-explicit')).toBe(true);
    });

    it('has correct CSS classes for dependency status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'dependency' })
      );

      expect(card.classList.contains('mod-card')).toBe(true);
      expect(card.classList.contains('active-dependency')).toBe(true);
    });

    it('has correct CSS classes for inactive status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      expect(card.classList.contains('mod-card')).toBe(true);
      expect(card.classList.contains('inactive')).toBe(true);
    });

    it('sets aria-label with mod info and status', () => {
      const mod = createMod({ name: 'Cool Mod', version: '3.0.0' });
      const card = component.createCard(
        mod,
        createDisplayInfo({ status: 'explicit' })
      );

      expect(card.getAttribute('aria-label')).toBe(
        'Cool Mod, version 3.0.0, active'
      );
    });

    it('sets aria-label for core mod', () => {
      const mod = createMod({ name: 'Core', version: '1.0.0' });
      const card = component.createCard(
        mod,
        createDisplayInfo({ status: 'core' })
      );

      expect(card.getAttribute('aria-label')).toBe(
        'Core, version 1.0.0, core mod, always enabled'
      );
    });

    it('sets aria-label for dependency mod', () => {
      const mod = createMod({ name: 'Dep Mod', version: '2.0.0' });
      const card = component.createCard(
        mod,
        createDisplayInfo({ status: 'dependency' })
      );

      expect(card.getAttribute('aria-label')).toBe(
        'Dep Mod, version 2.0.0, active as dependency'
      );
    });

    it('sets aria-label for inactive mod', () => {
      const mod = createMod({ name: 'Inactive Mod', version: '1.0.0' });
      const card = component.createCard(
        mod,
        createDisplayInfo({ status: 'inactive' })
      );

      expect(card.getAttribute('aria-label')).toBe(
        'Inactive Mod, version 1.0.0, inactive'
      );
    });
  });

  describe('updateCardState', () => {
    it('updates checkbox state', () => {
      // Create an inactive card
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      // Update to active
      component.updateCardState(
        card,
        createDisplayInfo({ status: 'explicit' })
      );

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox.checked).toBe(true);
    });

    it('updates checkbox disabled state for core', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      component.updateCardState(card, createDisplayInfo({ status: 'core' }));

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox.disabled).toBe(true);
    });

    it('updates CSS classes', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      expect(card.classList.contains('inactive')).toBe(true);

      component.updateCardState(
        card,
        createDisplayInfo({ status: 'explicit' })
      );

      expect(card.classList.contains('inactive')).toBe(false);
      expect(card.classList.contains('active-explicit')).toBe(true);
    });

    it('adds lock icon when transitioning to core', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      expect(card.querySelector('.mod-card-lock-icon')).toBeNull();

      component.updateCardState(card, createDisplayInfo({ status: 'core' }));

      expect(card.querySelector('.mod-card-lock-icon')).not.toBeNull();
    });

    it('removes lock icon when transitioning from core', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'core' })
      );

      expect(card.querySelector('.mod-card-lock-icon')).not.toBeNull();

      component.updateCardState(
        card,
        createDisplayInfo({ status: 'explicit' })
      );

      expect(card.querySelector('.mod-card-lock-icon')).toBeNull();
    });

    it('updates aria-checked attribute', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox.getAttribute('aria-checked')).toBe('false');

      component.updateCardState(
        card,
        createDisplayInfo({ status: 'explicit' })
      );

      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });

    it('does not re-create the card element', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'inactive' })
      );

      const originalId = card.dataset.modId;
      const originalTag = card.tagName;

      component.updateCardState(
        card,
        createDisplayInfo({ status: 'explicit' })
      );

      expect(card.dataset.modId).toBe(originalId);
      expect(card.tagName).toBe(originalTag);
    });

    it('adds mod-card--locked class for core status', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'explicit' })
      );

      component.updateCardState(card, createDisplayInfo({ status: 'core' }));

      expect(card.classList.contains('mod-card--locked')).toBe(true);
    });
  });

  describe('addConflictIndicator', () => {
    it('adds conflict warning element', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      component.addConflictIndicator(card, ['other-mod']);

      const indicator = card.querySelector('.mod-card-conflict');
      expect(indicator).not.toBeNull();
      expect(indicator.textContent).toContain('Conflicts with: other-mod');
    });

    it('adds role=alert for accessibility', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      component.addConflictIndicator(card, ['conflict-mod']);

      const indicator = card.querySelector('.mod-card-conflict');
      expect(indicator.getAttribute('role')).toBe('alert');
    });

    it('adds conflict class to card', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      component.addConflictIndicator(card, ['other']);

      expect(card.classList.contains('conflict')).toBe(true);
    });

    it('does not add duplicate indicator', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      component.addConflictIndicator(card, ['mod-a']);
      component.addConflictIndicator(card, ['mod-b']);

      const indicators = card.querySelectorAll('.mod-card-conflict');
      expect(indicators.length).toBe(1);
    });

    it('lists multiple conflicting mods', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      component.addConflictIndicator(card, ['mod-a', 'mod-b', 'mod-c']);

      const indicator = card.querySelector('.mod-card-conflict');
      expect(indicator.textContent).toContain('mod-a, mod-b, mod-c');
    });
  });

  describe('removeConflictIndicator', () => {
    it('removes conflict warning element', () => {
      const card = component.createCard(createMod(), createDisplayInfo());
      component.addConflictIndicator(card, ['other']);

      expect(card.querySelector('.mod-card-conflict')).not.toBeNull();

      component.removeConflictIndicator(card);

      expect(card.querySelector('.mod-card-conflict')).toBeNull();
    });

    it('removes conflict class from card', () => {
      const card = component.createCard(createMod(), createDisplayInfo());
      component.addConflictIndicator(card, ['other']);

      expect(card.classList.contains('conflict')).toBe(true);

      component.removeConflictIndicator(card);

      expect(card.classList.contains('conflict')).toBe(false);
    });

    it('handles card without conflict indicator gracefully', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      // Should not throw
      expect(() => component.removeConflictIndicator(card)).not.toThrow();
    });
  });

  describe('integration with ModListView expectations', () => {
    it('uses mod-card__checkbox class expected by ModListView', () => {
      const card = component.createCard(createMod(), createDisplayInfo());

      const checkbox = card.querySelector('.mod-card__checkbox');
      expect(checkbox).not.toBeNull();
    });

    it('uses mod-card--locked class expected by ModListView', () => {
      const card = component.createCard(
        createMod(),
        createDisplayInfo({ status: 'core' })
      );

      expect(card.classList.contains('mod-card--locked')).toBe(true);
    });

    it('sets data-mod-id as expected by ModListView event delegation', () => {
      const mod = createMod({ id: 'specific-mod-id' });
      const card = component.createCard(mod, createDisplayInfo());

      expect(card.dataset.modId).toBe('specific-mod-id');
    });
  });
});
