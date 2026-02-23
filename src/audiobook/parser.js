/**
 * Text extraction and chapter detection for audiobook files.
 * Supported: .txt, .md, .pdf, .docx, .epub
 */

import { readFile } from 'fs/promises';
import path from 'path';

const WORDS_PER_CHUNK = 800;
const HEADING_RE = /^(#{1,4}\s+.+|Chapter\s+\d+[:\s].*|CHAPTER\s+\d+[:\s].*|Part\s+\d+[:\s].*)$/im;

/**
 * Parse a file attachment buffer into structured chapters.
 *
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<{ title: string, author: string|null, chapters: Array<{title:string, content:string, wordCount:number}> }>}
 */
export async function parseFile(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  let rawText;
  switch (ext) {
    case '.txt':  rawText = buffer.toString('utf8'); break;
    case '.md':   rawText = stripMarkdown(buffer.toString('utf8')); break;
    case '.pdf':  rawText = await parsePdf(buffer); break;
    case '.docx': rawText = await parseDocx(buffer); break;
    case '.epub': rawText = await parseEpub(buffer); break;
    default:
      throw new Error(`Unsupported format: ${ext}. Accepted: .txt .md .pdf .docx .epub`);
  }

  if (!rawText?.trim()) throw new Error('The file appears to be empty or could not be read.');

  const { title, author } = extractMeta(rawText, filename);
  const chapters = detectChapters(rawText);

  return { title, author, chapters };
}

/** Supported file extensions. */
export const SUPPORTED_EXTS = ['.txt', '.md', '.pdf', '.docx', '.epub'];

/** Max file size (bytes) — 15 MB default */
export const MAX_FILE_SIZE = parseInt(process.env.AUDIOBOOK_MAX_MB ?? '15') * 1024 * 1024;

// ── Chapter detection ─────────────────────────────────────────────────────────

function detectChapters(text) {
  const lines = text.split('\n');
  const chapters = [];
  let currentTitle = null;
  let currentLines = [];

  const flushChapter = () => {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      chapters.push({
        title: currentTitle ?? `Part ${chapters.length + 1}`,
        content,
        wordCount: countWords(content),
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    if (HEADING_RE.test(line.trim())) {
      flushChapter();
      currentTitle = cleanHeading(line.trim());
    } else {
      currentLines.push(line);
    }
  }
  flushChapter();

  // If no headings found, auto-chunk into word-count parts
  if (chapters.length <= 1 && chapters[0]?.wordCount > WORDS_PER_CHUNK * 2) {
    return autoChunk(chapters[0]?.content ?? text);
  }

  return chapters.filter(c => c.content.length > 0);
}

function autoChunk(text) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    const slice = words.slice(i, i + WORDS_PER_CHUNK).join(' ');
    chunks.push({ title: `Part ${chunks.length + 1}`, content: slice, wordCount: Math.min(WORDS_PER_CHUNK, words.length - i) });
  }
  return chunks;
}

// ── Metadata extraction ───────────────────────────────────────────────────────

function extractMeta(text, filename) {
  let title = path.basename(filename, path.extname(filename));
  let author = null;

  // Try "Title: ...\nAuthor: ..." at top
  const titleMatch  = text.match(/^(?:title|book)[:\s]+(.+)/im);
  const authorMatch = text.match(/^(?:author|by)[:\s]+(.+)/im);
  if (titleMatch) title = titleMatch[1].trim();
  if (authorMatch) author = authorMatch[1].trim();

  // Try "# Title" first heading
  const headingMatch = text.match(/^#\s+(.+)/m);
  if (!titleMatch && headingMatch) title = headingMatch[1].trim();

  return { title: title.slice(0, 100), author: author?.slice(0, 80) ?? null };
}

// ── Format parsers ────────────────────────────────────────────────────────────

async function parsePdf(buffer) {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(buffer) {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseEpub(buffer) {
  // Write to temp file since epub2 needs a path
  const { writeFile, mkdtemp, rm } = await import('fs/promises');
  const os = await import('os');
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'chopsticks-epub-'));
  const tmpFile = path.join(tmpDir, 'book.epub');
  try {
    await writeFile(tmpFile, buffer);
    const Epub = (await import('epub2')).default;
    const epub = await Epub.createAsync(tmpFile);
    const texts = [];
    for (const item of epub.flow) {
      try {
        const content = await new Promise((res, rej) =>
          epub.getChapter(item.id, (err, txt) => err ? rej(err) : res(txt))
        );
        texts.push(stripHtml(content));
      } catch { /* skip unreadable chapters */ }
    }
    return texts.join('\n\n');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')         // headings (keep text)
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')  // bold/italic
    .replace(/`[^`]+`/g, '$1')            // inline code
    .replace(/```[\s\S]*?```/g, '')       // code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/^\s*[-*+]\s+/gm, '')        // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '');       // ordered lists
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

function cleanHeading(line) {
  return line
    .replace(/^#{1,4}\s+/, '')
    .replace(/^\*+|\*+$/g, '')
    .trim()
    .slice(0, 80);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
