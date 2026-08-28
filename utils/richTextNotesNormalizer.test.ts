import { describe, expect, it } from 'vitest';
import { normalizeRichTextNotesHtml } from './richTextNotesNormalizer';

describe('normalizeRichTextNotesHtml', () => {
  it('preserves supported formatting and table structure', () => {
    const normalized = normalizeRichTextNotesHtml(
      '<h2>Heading</h2><p><strong>Bold</strong> <em>italic</em> <u>underlined</u></p>'
      + '<blockquote><p>Teaching point</p></blockquote>'
      + '<table><thead><tr><th>Finding</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>'
    );

    expect(normalized).toContain('<h2>Heading</h2>');
    expect(normalized).toContain('<em>italic</em>');
    expect(normalized).toContain('<u>underlined</u>');
    expect(normalized).toContain('<blockquote>');
    expect(normalized).toContain('<table>');
    expect(normalized).toContain('<th>Finding</th>');
    expect(normalized).toContain('<td>Value</td>');
  });

  it('removes executable content, event handlers, links, and unsupported styling', () => {
    const normalized = normalizeRichTextNotesHtml(
      '<script>alert(1)</script>'
      + '<p onclick="alert(2)" style="color:red"><a href="https://bad.example">Safe text</a></p>'
      + '<img src="x" onerror="alert(3)">'
    );

    expect(normalized).toBe('<p>Safe text</p>');
    expect(normalized).not.toMatch(/script|onclick|onerror|href|style|img/i);
  });
});
