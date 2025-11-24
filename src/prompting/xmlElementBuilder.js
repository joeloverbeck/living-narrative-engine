/**
 * @file Low-level stateless utility for XML element generation
 * @description Provides methods for XML character escaping, tag wrapping,
 * conditional wrapping, and XML comments (simple and decorated multi-line).
 * This is a foundation class with no dependencies on character data or business logic.
 */

/**
 * Stateless utility class for building XML elements.
 * All methods are pure functions - same input always produces same output.
 */
class XmlElementBuilder {
  /**
   * Number of spaces per indentation level
   *
   * @type {number}
   */
  static #INDENT_SPACES = 2;

  /**
   * Width of decorated comment borders
   *
   * @type {number}
   */
  static #BORDER_WIDTH = 75;

  /**
   * Escapes XML special characters in text
   *
   * @param {string|null|undefined} text - Text to escape
   * @returns {string} Escaped text safe for XML content
   */
  escape(text) {
    if (text === null || text === undefined) {
      return '';
    }
    const str = String(text);
    if (str === '') {
      return '';
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Wraps content in an XML tag
   *
   * @param {string} tagName - Tag name (no brackets)
   * @param {string} content - Content to wrap
   * @param {number} indent - Indentation level (2 spaces per level)
   * @returns {string} Complete XML element
   */
  wrap(tagName, content, indent = 0) {
    const indentStr = this.#getIndent(indent);
    return `${indentStr}<${tagName}>${content}</${tagName}>`;
  }

  /**
   * Wraps content only if non-empty (non-whitespace)
   *
   * @param {string} tagName - Tag name
   * @param {string|null|undefined} content - Content to wrap
   * @param {number} indent - Indentation level
   * @returns {string} XML element or empty string
   */
  wrapIfPresent(tagName, content, indent = 0) {
    if (content === null || content === undefined) {
      return '';
    }
    const str = String(content).trim();
    if (str === '') {
      return '';
    }
    return this.wrap(tagName, content, indent);
  }

  /**
   * Creates an XML comment
   *
   * @param {string} text - Comment text
   * @param {number} indent - Indentation level
   * @returns {string} XML comment
   */
  comment(text, indent = 0) {
    const indentStr = this.#getIndent(indent);
    // Escape double dashes which are not allowed inside XML comments
    const safeText = String(text).replace(/--/g, '- -');
    return `${indentStr}<!-- ${safeText} -->`;
  }

  /**
   * Creates multi-line decorated comment block
   *
   * @param {string[]} lines - Comment lines
   * @param {'primary'|'secondary'} style - Visual style
   * @param {number} indent - Indentation level
   * @returns {string} Decorated comment block
   */
  decoratedComment(lines, style, indent = 0) {
    const indentStr = this.#getIndent(indent);
    const borderChar = style === 'primary' ? '=' : '-';
    const border = borderChar.repeat(XmlElementBuilder.#BORDER_WIDTH);

    const contentIndent = '     '; // 5 spaces for content alignment
    const formattedLines = lines.map(line => `${contentIndent}${line}`);

    const result = [
      `${indentStr}<!-- ${border}`,
      ...formattedLines.map(line => `${indentStr}${line}`),
      `${indentStr}${contentIndent}${border} -->`
    ];

    return result.join('\n');
  }

  /**
   * Generates indentation string
   *
   * @param {number} level - Indentation level
   * @returns {string} Indentation spaces
   */
  #getIndent(level) {
    return ' '.repeat(level * XmlElementBuilder.#INDENT_SPACES);
  }
}

export default XmlElementBuilder;
