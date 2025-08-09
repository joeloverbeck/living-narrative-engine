/**
 * @file Template Composition Examples
 * @module characterBuilder/templates/examples/compositionExamples
 * @description Examples demonstrating the template composition engine
 */

import {
  TemplateComposer,
  SlotContentProvider,
  ComponentAssembler,
  createBaseTemplate,
  extendTemplate,
} from '../utilities/index.js';

// Import existing templates
import { createCharacterBuilderPage } from '../core/pageTemplate.js';
import { createHeader } from '../core/headerTemplate.js';
import { createMain } from '../core/mainTemplate.js';
import { createFooter } from '../core/footerTemplate.js';

/**
 * Example 1: Simple template composition with slots
 */
export function simpleCompositionExample() {
  const composer = new TemplateComposer();

  // Define a card template with slots
  const cardTemplate = `
    <div class="card">
      <div class="card-header">
        <slot name="header">Default Header</slot>
      </div>
      <div class="card-body">
        <slot></slot>
      </div>
      <div class="card-footer">
        <slot name="footer">Default Footer</slot>
      </div>
    </div>
  `;

  // Compose with slot content
  return composer.compose(cardTemplate, {
    slots: {
      header: '<h2>Custom Card Title</h2>',
      default: '<p>This is the main card content.</p>',
      footer: '<button class="btn">Action</button>',
    },
  });
}

/**
 * Example 2: Nested template composition
 */
export function nestedTemplateExample() {
  const composer = new TemplateComposer();

  // Register reusable components
  composer.registerTemplate(
    'user-badge',
    (ctx) => `<span class="badge">${ctx.user?.name || 'Guest'}</span>`
  );

  composer.registerTemplate(
    'navigation',
    `
    <nav class="navbar">
      <div class="nav-brand">My App</div>
      <div class="nav-user">
        <template ref="user-badge" />
      </div>
    </nav>
  `
  );

  // Use nested templates
  return composer.compose('<template ref="navigation" />', {
    user: { name: 'John Doe' },
  });
}

/**
 * Example 3: Template inheritance
 */
export function templateInheritanceExample() {
  // Create base layout
  const baseLayout = createBaseTemplate({
    name: 'base-layout',
    blocks: {
      header: '<header class="site-header">Default Header</header>',
      main: '<main class="site-main"><slot></slot></main>',
      footer: '<footer class="site-footer">Default Footer</footer>',
    },
  });

  // Extend base layout
  const customLayout = extendTemplate(baseLayout, {
    name: 'custom-layout',
    blocks: {
      header:
        '<header class="custom-header">Custom Site Header with Navigation</header>',
      // main is inherited
      footer:
        '<footer class="custom-footer">© 2024 My Company | {{parent}}</footer>',
    },
  });

  // Render extended layout
  return customLayout.render({
    // Can still override blocks at render time
    main: '<main class="custom-main">Custom content here</main>',
  });
}

/**
 * Example 4: Component assembly
 */
export function componentAssemblyExample() {
  const composer = new TemplateComposer();
  const assembler = new ComponentAssembler({ composer });

  // Register layout
  assembler.registerLayout(
    'dashboard',
    `
    <div class="dashboard">
      <div class="dashboard-header">
        <slot name="header"></slot>
      </div>
      <div class="dashboard-content">
        <div class="dashboard-sidebar">
          <slot name="sidebar"></slot>
        </div>
        <div class="dashboard-main">
          <slot name="main"></slot>
        </div>
      </div>
    </div>
  `
  );

  // Register components
  assembler.registerComponent(
    'user-menu',
    `
    <div class="user-menu">
      <span class="username">${'${username}'}</span>
      <button class="logout">Logout</button>
    </div>
  `
  );

  assembler.registerComponent(
    'nav-menu',
    `
    <nav class="nav-menu">
      <ul>
        <li><a href="#dashboard">Dashboard</a></li>
        <li><a href="#settings">Settings</a></li>
        <li><a href="#help">Help</a></li>
      </ul>
    </nav>
  `
  );

  assembler.registerComponent(
    'stats-card',
    `
    <div class="stats-card">
      <h3>${'${title}'}</h3>
      <p class="value">${'${value}'}</p>
    </div>
  `
  );

  // Assemble dashboard
  return assembler.assemble({
    layout: 'dashboard',
    props: {
      username: 'John Doe',
    },
    components: [
      { type: 'user-menu', slot: 'header' },
      { type: 'nav-menu', slot: 'sidebar' },
      {
        type: 'stats-card',
        slot: 'main',
        props: { title: 'Total Users', value: '1,234' },
      },
      {
        type: 'stats-card',
        slot: 'main',
        props: { title: 'Active Sessions', value: '89' },
      },
    ],
  });
}

/**
 * Example 5: Integration with existing character builder templates
 */
export function characterBuilderIntegrationExample() {
  const composer = new TemplateComposer();
  const assembler = new ComponentAssembler({ composer });

  // Register existing templates as components
  assembler.registerComponent('cb-header', (ctx) => createHeader(ctx));
  assembler.registerComponent('cb-main', (ctx) => createMain(ctx));
  assembler.registerComponent('cb-footer', (ctx) => createFooter(ctx));

  // Create custom character builder page with composition
  const customPage = createCharacterBuilderPage({
    title: 'Character Creator',
    subtitle: 'Design your hero',
    leftPanel: {
      heading: 'Character Options',
      content: composer.compose(
        `
        <div class="character-options">
          <slot name="race-selector"></slot>
          <slot name="class-selector"></slot>
          <slot name="stats"></slot>
        </div>
      `,
        {
          slots: {
            'race-selector':
              '<select><option>Human</option><option>Elf</option></select>',
            'class-selector':
              '<select><option>Warrior</option><option>Mage</option></select>',
            stats: '<div>STR: 10, DEX: 12, INT: 14</div>',
          },
        }
      ),
    },
    rightPanel: {
      heading: 'Character Preview',
      content: '<div class="character-preview">Preview will appear here</div>',
    },
  });

  return customPage;
}

/**
 * Example 6: Conditional slots and dynamic content
 */
export function conditionalSlotsExample() {
  const composer = new TemplateComposer();

  const template = `
    <article class="post">
      <header>
        <h2>${'${title}'}</h2>
        <slot name="meta"></slot>
      </header>
      <div class="content">
        <slot></slot>
      </div>
      <footer>
        <slot name="actions"></slot>
      </footer>
    </article>
  `;

  // Use SlotContentProvider for dynamic slot management
  const slots = new SlotContentProvider();

  // Conditionally add slots based on context
  const context = {
    title: 'My Blog Post',
    showMeta: true,
    isOwner: true,
  };

  if (context.showMeta) {
    slots.setSlot('meta', '<span class="date">2024-01-15</span>');
  }

  slots.setSlot(null, '<p>This is the main content of the blog post.</p>');

  if (context.isOwner) {
    slots.setSlot(
      'actions',
      `
      <button class="edit">Edit</button>
      <button class="delete">Delete</button>
    `
    );
  } else {
    slots.setSlot('actions', '<button class="share">Share</button>');
  }

  return composer.compose(template, {
    ...context,
    slots,
  });
}

/**
 * Export all examples
 */
export const examples = {
  simple: simpleCompositionExample,
  nested: nestedTemplateExample,
  inheritance: templateInheritanceExample,
  assembly: componentAssemblyExample,
  characterBuilder: characterBuilderIntegrationExample,
  conditional: conditionalSlotsExample,
};

// Export runner function for testing
/**
 *
 */
export function runAllExamples() {
  const results = {};

  for (const [name, exampleFn] of Object.entries(examples)) {
    try {
      results[name] = {
        success: true,
        output: exampleFn(),
      };
    } catch (error) {
      results[name] = {
        success: false,
        error: error.message,
      };
    }
  }

  return results;
}
