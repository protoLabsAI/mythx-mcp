/**
 * Zine Text Formatters
 *
 * Utilities for generating print-ready text files with simple formatting
 * optimized for zine printing.
 *
 * Format conventions:
 * - === for major sections
 * - --- for subsections
 * - *text* for emphasis
 * - Fixed-width tables for print alignment
 * - <<<PAGE>>> for page breaks
 */

/**
 * Standard line width for zine formatting
 */
export const LINE_WIDTH = 50;

/**
 * Create a major section header
 *
 * Example:
 * ==================================================
 *               SECTION TITLE
 * ==================================================
 */
export function sectionHeader(title: string): string {
  const line = "=".repeat(LINE_WIDTH);
  // Truncate title if longer than LINE_WIDTH
  let displayTitle = title.toUpperCase();
  if (displayTitle.length > LINE_WIDTH) {
    displayTitle = displayTitle.slice(0, LINE_WIDTH - 3) + "...";
  }
  const padding = Math.max(0, Math.floor((LINE_WIDTH - displayTitle.length) / 2));
  const centeredTitle = " ".repeat(padding) + displayTitle;

  return `${line}\n${centeredTitle}\n${line}\n`;
}

/**
 * Create a subsection header
 *
 * Example:
 * --------------------------------------------------
 * Subsection Header
 * --------------------------------------------------
 */
export function subsectionHeader(title: string): string {
  const line = "-".repeat(LINE_WIDTH);
  // Truncate title if longer than LINE_WIDTH
  const displayTitle = title.length > LINE_WIDTH ? title.slice(0, LINE_WIDTH - 3) + "..." : title;
  return `${line}\n${displayTitle}\n${line}\n`;
}

/**
 * Add emphasis to text
 */
export function emphasis(text: string): string {
  return `*${text}*`;
}

/**
 * Create a page break marker
 */
export function pageBreak(): string {
  return "\n<<<PAGE>>>\n";
}

/**
 * Create a horizontal rule
 */
export function horizontalRule(): string {
  return "-".repeat(LINE_WIDTH) + "\n";
}

/**
 * Format a key-value pair for stat blocks
 */
export function statLine(key: string, value: string | number, keyWidth = 20): string {
  const paddedKey = key.padEnd(keyWidth);
  return `${paddedKey}${value}`;
}

/**
 * Create a fixed-width table
 *
 * @param headers - Column headers
 * @param rows - 2D array of row data
 * @param columnWidths - Optional array of column widths
 */
export function table(
  headers: string[],
  rows: (string | number)[][],
  columnWidths?: number[]
): string {
  // Calculate column widths if not provided
  const widths =
    columnWidths ||
    headers.map((header, i) => {
      const maxRowWidth = rows.reduce((max, row) => {
        const cell = String(row[i] ?? "");
        return Math.max(max, cell.length);
      }, 0);
      return Math.max(header.length, maxRowWidth) + 2;
    });

  // Ensure total width doesn't exceed line width
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  if (totalWidth > LINE_WIDTH) {
    // Scale down proportionally
    const scale = LINE_WIDTH / totalWidth;
    widths.forEach((w, i) => {
      widths[i] = Math.max(3, Math.floor(w * scale));
    });
  }

  const formatRow = (cells: (string | number)[]): string => {
    return cells.map((cell, i) => {
      const str = String(cell);
      // Truncate cell content if longer than allocated width
      const truncated = str.length > widths[i] ? str.slice(0, widths[i] - 1) + "…" : str;
      return truncated.padEnd(widths[i]);
    }).join("");
  };

  const headerLine = formatRow(headers);
  const separator = widths.map((w) => "-".repeat(w)).join("");
  const dataLines = rows.map((row) => formatRow(row));

  return [separator, headerLine, separator, ...dataLines, separator].join("\n") + "\n";
}

/**
 * Create a stat block (common format for monsters/NPCs)
 */
export function statBlock(name: string, stats: Record<string, string | number>): string {
  const lines: string[] = [];
  lines.push(horizontalRule());
  lines.push(name.toUpperCase() + "\n");
  lines.push(horizontalRule());

  for (const [key, value] of Object.entries(stats)) {
    lines.push(statLine(key, value) + "\n");
  }

  lines.push(horizontalRule());
  return lines.join("");
}

/**
 * Wrap text to fit within line width
 */
export function wrapText(text: string, width = LINE_WIDTH): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    // Handle words longer than width by splitting them
    if (word.length > width) {
      // First, push any current line
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      // Split long word into chunks
      let remaining = word;
      while (remaining.length > width) {
        lines.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }
      // Start new line with remainder
      currentLine = remaining;
    } else if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}

/**
 * Create a bullet list
 */
export function bulletList(items: string[], bullet = "- "): string {
  const indent = " ".repeat(bullet.length);
  return items
    .map((item) => {
      const wrapped = wrapText(item, LINE_WIDTH - bullet.length);
      const lines = wrapped.split("\n");
      return lines.map((line, i) => (i === 0 ? bullet : indent) + line).join("\n");
    })
    .join("\n") + "\n";
}

/**
 * Create a numbered list
 */
export function numberedList(items: string[]): string {
  return items
    .map((item, i) => {
      const num = `${i + 1}. `;
      const indent = " ".repeat(num.length);
      const wrapped = wrapText(item, LINE_WIDTH - num.length);
      const lines = wrapped.split("\n");
      return lines.map((line, j) => (j === 0 ? num : indent) + line).join("\n");
    })
    .join("\n") + "\n";
}

/**
 * Format abilities in standard layout
 */
export function abilityBlock(abilities: { STR: number; AGI: number; WIT: number; CON: number }): string {
  const format = (name: string, val: number) => {
    const sign = val >= 0 ? "+" : "";
    return `${name}: ${sign}${val}`;
  };

  return [
    format("STR", abilities.STR) + "  " + format("AGI", abilities.AGI),
    format("WIT", abilities.WIT) + "  " + format("CON", abilities.CON),
  ].join("\n") + "\n";
}

/**
 * Book builder class for constructing complete documents
 */
export class BookBuilder {
  private content: string[] = [];

  section(title: string): this {
    this.content.push(sectionHeader(title));
    return this;
  }

  subsection(title: string): this {
    this.content.push(subsectionHeader(title));
    return this;
  }

  text(text: string): this {
    this.content.push(wrapText(text) + "\n\n");
    return this;
  }

  rawText(text: string): this {
    this.content.push(text + "\n");
    return this;
  }

  bullets(items: string[]): this {
    this.content.push(bulletList(items) + "\n");
    return this;
  }

  numbered(items: string[]): this {
    this.content.push(numberedList(items) + "\n");
    return this;
  }

  table(headers: string[], rows: (string | number)[][], widths?: number[]): this {
    this.content.push(table(headers, rows, widths) + "\n");
    return this;
  }

  statBlock(name: string, stats: Record<string, string | number>): this {
    this.content.push(statBlock(name, stats));
    return this;
  }

  abilities(abilities: { STR: number; AGI: number; WIT: number; CON: number }): this {
    this.content.push(abilityBlock(abilities) + "\n");
    return this;
  }

  pageBreak(): this {
    this.content.push(pageBreak());
    return this;
  }

  rule(): this {
    this.content.push(horizontalRule() + "\n");
    return this;
  }

  blank(): this {
    this.content.push("\n");
    return this;
  }

  build(): string {
    return this.content.join("");
  }
}

/**
 * Create a new book builder
 */
export function createBook(): BookBuilder {
  return new BookBuilder();
}
