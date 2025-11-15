const path = require('node:path');

/**
 * @description Normalizes a file path so comparisons can be made consistently across platforms.
 * @param {string} filename - The file path reported by ESLint.
 * @returns {string} POSIX-style relative path or the original virtual filename.
 */
const normalizeFilename = (filename) => {
  if (!filename || filename === '<text>') {
    return filename;
  }

  const relativePath = path.isAbsolute(filename)
    ? path.relative(process.cwd(), filename)
    : filename;

  return relativePath.replace(/\\/g, '/');
};

/**
 * @description Escapes a string so it can be safely turned into a regular expression.
 * @param {string} value - Pattern that may contain regex characters.
 * @returns {string} The escaped string.
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @description Converts a limited glob pattern (supports * and **) into a regular expression.
 * @param {string} pattern - The glob-style pattern supplied through rule options.
 * @returns {RegExp} Regular expression that matches the provided pattern.
 */
const globToRegExp = (pattern) => {
  const escaped = escapeRegExp(pattern)
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*');

  return new RegExp(`^${escaped}$`);
};

/**
 * @description Determines if the provided filename is included in the rule's allowed files list.
 * @param {string} filename - Normalized filename being linted.
 * @param {string[]} allowedFiles - Glob patterns or explicit paths that are exempt from the rule.
 * @returns {boolean} True when the file should be skipped by this rule.
 */
const isFileExempt = (filename, allowedFiles) => {
  if (!filename || filename === '<text>') {
    return true;
  }

  return allowedFiles.some((pattern) => {
    if (!pattern) {
      return false;
    }

    const normalizedPattern = pattern.replace(/\\/g, '/');

    if (normalizedPattern.includes('*')) {
      return globToRegExp(normalizedPattern).test(filename);
    }

    return (
      filename === normalizedPattern ||
      filename.endsWith(`/${normalizedPattern}`)
    );
  });
};

/**
 * @description Checks whether a literal string value represents a non-core mod reference.
 * @param {string} value - String literal found in the AST.
 * @param {string[]} allowedMods - List of mod namespaces that are acceptable.
 * @returns {{ isMatch: boolean, modId?: string }} Whether the string is a flagged reference and the mod id if so.
 */
const evaluateLiteral = (value, allowedMods) => {
  if (typeof value !== 'string') {
    return { isMatch: false };
  }

  const modReferencePattern = /^([a-z_][a-z0-9_]*):([a-z_][a-z0-9_]*)$/i;
  const match = value.match(modReferencePattern);

  if (!match) {
    return { isMatch: false };
  }

  const modId = match[1];

  if (allowedMods.includes(modId)) {
    return { isMatch: false };
  }

  return { isMatch: true, modId };
};

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent hardcoded mod references in production code',
      recommended: true,
    },
    messages: {
      hardcodedModReference:
        'Hardcoded reference to non-core mod "{{modId}}" detected. Use the ComponentTypeRegistry or plugin system instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedMods: {
            type: 'array',
            items: { type: 'string' },
            default: ['core'],
          },
          allowedFiles: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const allowedMods = Array.isArray(options.allowedMods) && options.allowedMods.length > 0
      ? options.allowedMods
      : ['core'];
    const allowedFiles = Array.isArray(options.allowedFiles) ? options.allowedFiles : [];
    const filename = normalizeFilename(context.getFilename());

    if (isFileExempt(filename, allowedFiles)) {
      return {};
    }

    const reportIfNeeded = (node, value) => {
      const result = evaluateLiteral(value, allowedMods);
      if (!result.isMatch || !result.modId) {
        return;
      }

      context.report({
        node,
        messageId: 'hardcodedModReference',
        data: { modId: result.modId },
      });
    };

    return {
      Literal(node) {
        reportIfNeeded(node, node.value);
      },
      TemplateElement(node) {
        const cookedValue = node.value.cooked ?? node.value.raw;
        reportIfNeeded(node, cookedValue);
      },
    };
  },
};

module.exports = rule;
