import { describe, expect, it } from 'vitest';
import { sanitizeNewsContent, sanitizeNewsTitle, stripEmoji } from '../utils/newsTextSanitizer';

describe('newsTextSanitizer', () => {
  it('removes emoji sequences and keeps readable text', () => {
    expect(stripEmoji('📣 MRI update ✅')).toBe(' MRI update ');
  });

  it('sanitizes title spacing after emoji removal', () => {
    expect(sanitizeNewsTitle('  🔥  New  CT  Protocol  ')).toBe('New CT Protocol');
  });

  it('preserves paragraph structure in content', () => {
    const input = 'Line one ✅  with extra spaces.\n\n🔥 Line two';
    expect(sanitizeNewsContent(input)).toBe('Line one with extra spaces.\n\nLine two');
  });
});
