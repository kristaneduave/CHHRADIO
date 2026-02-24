const EMOJI_SEQUENCE_REGEX =
  /(?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:[#*0-9]\uFE0F?\u20E3)|(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;

const normalizeLineSpacing = (value: string): string => value.replace(/[ \t]{2,}/g, ' ').trim();

export const stripEmoji = (value: string): string => value.replace(EMOJI_SEQUENCE_REGEX, '');

export const sanitizeNewsTitle = (value: string): string => normalizeLineSpacing(stripEmoji(value));

export const sanitizeNewsContent = (value: string): string => {
  const withoutEmoji = stripEmoji(value).replace(/\r\n/g, '\n');
  const normalizedLines = withoutEmoji.split('\n').map(normalizeLineSpacing);
  return normalizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
