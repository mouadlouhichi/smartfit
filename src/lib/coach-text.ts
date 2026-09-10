/**
 * A deliberately tiny markdown subset for coach answers.
 *
 * The AI is told it may use bullets, `**bold**`, `*italic*` and inline code,
 * because a plan reads better as three lines than as one paragraph. Everything
 * else is passed through as plain text: no headings, no tables, no raw HTML and
 * no links (a link rendered from model output is a phishing vector, and the
 * coach has no business sending the athlete off-site).
 *
 * Output is data, never markup — the renderer builds React nodes — so anything
 * that looks like HTML stays inert text.
 */

export interface CoachSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type CoachBlock =
  { type: 'paragraph'; spans: CoachSpan[] } | { type: 'list'; items: CoachSpan[][] };

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
/**
 * Bold, italic and code, with markdown's spacing rule: an italic marker must
 * hug its text (`*easy*`), so a lone asterisk in "2 * 3" is arithmetic, not
 * emphasis.
 */
const INLINE =
  /(\*\*(?!\s)[^*\n]*[^\s*]\*\*|__(?!\s)[^_\n]*[^\s_]__|\*(?!\s)[^*\n]*[^\s*]\*|_(?!\s)[^_\n]*[^\s_]_|`[^`\n]+`)/g;
const LINK = /\[([^\]\n]*)\]\((?:https?:\/\/)?[^)\s]*\)/g;

/** Strip markdown that we do not render, keeping the words. */
function plain(text: string): string {
  return text
    .replace(LINK, '$1')
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/\s+$/, '');
}

function inline(text: string): CoachSpan[] {
  const spans: CoachSpan[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) spans.push({ text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      spans.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('`')) {
      spans.push({ text: token.slice(1, -1), code: true });
    } else {
      spans.push({ text: token.slice(1, -1), italic: true });
    }
    last = index + token.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length > 0 ? spans : [{ text }];
}

/**
 * Split an answer into paragraphs and bullet lists. Single newlines inside a
 * paragraph are preserved (the renderer uses `whitespace-pre-line`), because a
 * model that writes "Do this.\nThen that." means two lines, not one run-on.
 */
export function parseCoachText(text: string): CoachBlock[] {
  const blocks: CoachBlock[] = [];
  for (const chunk of text.split(/\n{2,}/)) {
    let paragraph: string[] = [];
    let list: CoachSpan[][] = [];

    const flushParagraph = () => {
      const body = paragraph.join('\n').trim();
      paragraph = [];
      if (body) blocks.push({ type: 'paragraph', spans: inline(body) });
    };
    const flushList = () => {
      if (list.length > 0) blocks.push({ type: 'list', items: list });
      list = [];
    };

    // A chunk is usually all prose or all bullets, but "Do this next:" followed
    // by three dashes is common enough that the lead-in must stay a paragraph.
    for (const raw of chunk.split('\n')) {
      const line = plain(raw);
      if (!line.trim()) {
        flushParagraph();
        flushList();
      } else if (BULLET.test(line)) {
        flushParagraph();
        list.push(inline(line.replace(BULLET, '')));
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

/** Flatten for tests, aria labels and copy-to-clipboard use. */
export function coachTextToPlain(blocks: CoachBlock[]): string {
  return blocks
    .map((b) =>
      b.type === 'list'
        ? b.items.map((item) => `- ${item.map((s) => s.text).join('')}`).join('\n')
        : b.spans.map((s) => s.text).join(''),
    )
    .join('\n\n');
}
