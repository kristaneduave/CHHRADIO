const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const LETTER_RUN_PATTERN = /\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b/g;
const INVISIBLE_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2060\uFEFF]/g;

const stripInvisibleCharacters = (value: string) => value.replace(INVISIBLE_CHAR_PATTERN, ' ');

const repairSpacedLetterRuns = (value: string) =>
  value.replace(LETTER_RUN_PATTERN, (match) => match.replace(/\s+/g, ''));

const normalizeTextNodeContent = (value: string) => repairSpacedLetterRuns(stripInvisibleCharacters(value));

const getDirectTextContent = (element: Element) =>
  normalizeWhitespace(
    Array.from(element.childNodes)
      .filter((node) => !(node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')))
      .map((node) => node.textContent || '')
      .join(' ')
  );

const shouldMergeContinuationListItem = (current: Element, next: Element) => {
  const currentText = getDirectTextContent(current);
  const nextText = getDirectTextContent(next);

  if (!currentText || !nextText) return false;
  if (current.querySelector(':scope > ul, :scope > ol') || next.querySelector(':scope > ul, :scope > ol')) {
    return false;
  }

  const currentLooksIncomplete = /(?:,|:|;|\b(?:and|or|with|without|including|containing|showing|demonstrating|causing|resulting|suggesting))$/i.test(currentText);
  const nextLooksContinuation = /^[a-z(]/.test(nextText);

  return currentLooksIncomplete && nextLooksContinuation;
};

const appendListItemContinuation = (target: Element, source: Element) => {
  if (source.childNodes.length === 0) return;

  const firstSourceNode = source.firstChild;
  const needsSpacer =
    firstSourceNode &&
    !(firstSourceNode instanceof HTMLElement && (firstSourceNode.tagName === 'UL' || firstSourceNode.tagName === 'OL'));

  if (needsSpacer) {
    target.appendChild(target.ownerDocument.createTextNode(' '));
  }

  while (source.firstChild) {
    target.appendChild(source.firstChild);
  }
};

export const normalizeRichTextNotesHtml = (html?: string | null) => {
  const value = String(html || '').trim();
  if (!value || typeof window === 'undefined') return value;

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(value, 'text/html');

  doc.querySelectorAll('span').forEach((span) => {
    span.replaceWith(...Array.from(span.childNodes));
  });

  doc.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.removeAttribute('style');
    element.removeAttribute('class');
  });

  doc.querySelectorAll<HTMLElement>('p, li, h1, h2, h3, h4, blockquote').forEach((element) => {
    const directTextNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    directTextNodes.forEach((node) => {
      node.textContent = normalizeTextNodeContent(node.textContent || '');
    });
  });

  doc.querySelectorAll('ul, ol').forEach((list) => {
    let current = list.firstElementChild;
    while (current) {
      const next = current.nextElementSibling;
      if (current.tagName === 'LI' && next?.tagName === 'LI' && shouldMergeContinuationListItem(current, next)) {
        appendListItemContinuation(current, next);
        next.remove();
        continue;
      }
      current = next;
    }
  });

  return doc.body.innerHTML.trim();
};
