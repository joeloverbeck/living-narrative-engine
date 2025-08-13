/**
 * @file Service for exporting cliché data in various formats
 */

/**
 * Handles exporting cliché data to different formats
 */
export class ClicheExporter {
  /**
   * Export data in the specified format
   *
   * @param {object} data - The display data to export
   * @param {string} format - The export format (markdown, json, text)
   */
  export(data, format) {
    if (!data) throw new Error('No data to export');

    let content;
    let filename;
    let mimeType;

    switch (format) {
      case 'markdown':
        content = this.exportAsMarkdown(data);
        filename = 'cliches.md';
        mimeType = 'text/markdown';
        break;

      case 'json':
        content = this.exportAsJSON(data);
        filename = 'cliches.json';
        mimeType = 'application/json';
        break;

      case 'text':
        content = this.exportAsText(data);
        filename = 'cliches.txt';
        mimeType = 'text/plain';
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    this.#downloadFile(content, filename, mimeType);
  }

  /**
   * Export as Markdown format
   *
   * @param {object} data - The display data
   * @returns {string} Markdown formatted content
   */
  exportAsMarkdown(data) {
    let markdown = '# Character Clichés Analysis\n\n';

    // Add metadata
    markdown += `**Generated:** ${data.metadata.createdAt}\n`;
    markdown += `**Total Count:** ${data.metadata.totalCount}\n`;
    if (data.metadata.model) {
      markdown += `**Model:** ${data.metadata.model}\n`;
    }
    markdown += '\n---\n\n';

    // Add categories
    markdown += '## Categories\n\n';
    if (data.categories && Array.isArray(data.categories)) {
      data.categories.forEach((category) => {
        if (category && category.title) {
          markdown += `### ${category.title} (${category.count || 0})\n\n`;
          if (category.items && Array.isArray(category.items)) {
            category.items.forEach((item) => {
              if (item) {
                markdown += `- ${item}\n`;
              }
            });
          }
          markdown += '\n';
        }
      });
    }

    // Add tropes if present
    if (data.tropesAndStereotypes && data.tropesAndStereotypes.length > 0) {
      markdown += '## Overall Tropes & Stereotypes\n\n';
      data.tropesAndStereotypes.forEach((trope) => {
        markdown += `- ⚠️ ${trope}\n`;
      });
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Export as JSON format
   *
   * @param {object} data - The display data
   * @returns {string} JSON formatted content
   */
  exportAsJSON(data) {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        ...data.metadata,
      },
      categories: data.categories.map((category) => ({
        id: category.id,
        title: category.title,
        count: category.count,
        items: category.items,
      })),
      tropesAndStereotypes: data.tropesAndStereotypes || [],
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export as plain text format
   *
   * @param {object} data - The display data
   * @returns {string} Plain text formatted content
   */
  exportAsText(data) {
    let text = 'CHARACTER CLICHÉS ANALYSIS\n';
    text += '='.repeat(50) + '\n\n';

    // Add metadata
    text += `Generated: ${data.metadata.createdAt}\n`;
    text += `Total Count: ${data.metadata.totalCount}\n`;
    if (data.metadata.model) {
      text += `Model: ${data.metadata.model}\n`;
    }
    text += '\n' + '-'.repeat(50) + '\n\n';

    // Add categories
    if (data.categories && Array.isArray(data.categories)) {
      data.categories.forEach((category) => {
        if (category && category.title) {
          const title = category.title.toUpperCase();
          text += `${title} (${category.count || 0})\n`;
          text += '-'.repeat(title.length + 5) + '\n';
          if (category.items && Array.isArray(category.items)) {
            category.items.forEach((item) => {
              if (item) {
                text += `• ${item}\n`;
              }
            });
          }
          text += '\n';
        }
      });
    }

    // Add tropes if present
    if (data.tropesAndStereotypes && data.tropesAndStereotypes.length > 0) {
      text += 'OVERALL TROPES & STEREOTYPES\n';
      text += '-'.repeat(30) + '\n';
      data.tropesAndStereotypes.forEach((trope) => {
        text += `⚠ ${trope}\n`;
      });
      text += '\n';
    }

    return text;
  }

  /**
   * Download file with given content
   *
   * @private
   * @param {string} content - File content
   * @param {string} filename - Name of the file
   * @param {string} mimeType - MIME type of the file
   */
  #downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Copy formatted text to clipboard
   *
   * @param {object} data - The display data
   * @param {string} format - The format to use
   * @returns {Promise<void>}
   */
  async copyToClipboard(data, format = 'text') {
    let content;

    switch (format) {
      case 'markdown':
        content = this.exportAsMarkdown(data);
        break;
      case 'json':
        content = this.exportAsJSON(data);
        break;
      default:
        content = this.exportAsText(data);
    }

    await navigator.clipboard.writeText(content);
  }
}

export default ClicheExporter;
