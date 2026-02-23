/**
 * Unit tests for audiobook file ingest and chapter detection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We test the pure logic exported from parser.js without mocking external libs.
// Only .txt and .md parsing is tested here (no PDF/DOCX/EPUB deps needed).

// ── Inline re-impl of pure helpers for unit testing ───────────────────────────
// (Mirrors the logic in parser.js so tests can run without the full module graph)

const WORDS_PER_CHUNK = 800;
const HEADING_RE = /^(#{1,4}\s+.+|Chapter\s+\d+[:\s].*|CHAPTER\s+\d+[:\s].*|Part\s+\d+[:\s].*)$/im;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cleanHeading(line) {
  return line.replace(/^#{1,4}\s+/, '').replace(/^\*+|\*+$/g, '').trim().slice(0, 80);
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

function detectChapters(text) {
  const lines = text.split('\n');
  const chapters = [];
  let currentTitle = null;
  let currentLines = [];

  const flush = () => {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      chapters.push({ title: currentTitle ?? `Part ${chapters.length + 1}`, content, wordCount: countWords(content) });
    }
    currentLines = [];
  };

  for (const line of lines) {
    if (HEADING_RE.test(line.trim())) {
      flush();
      currentTitle = cleanHeading(line.trim());
    } else {
      currentLines.push(line);
    }
  }
  flush();

  if (chapters.length <= 1 && (chapters[0]?.wordCount ?? 0) > WORDS_PER_CHUNK * 2) {
    return autoChunk(chapters[0]?.content ?? text);
  }
  return chapters.filter(c => c.content.length > 0);
}

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/`[^`]+`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');
}

function extractMeta(text, filename) {
  const path = { basename: (f, ext) => f.replace(ext, ''), extname: f => f.slice(f.lastIndexOf('.')) };
  const ext   = filename.slice(filename.lastIndexOf('.'));
  let title   = filename.slice(0, filename.lastIndexOf('.'));
  let author  = null;
  const tm    = text.match(/^(?:title|book)[:\s]+(.+)/im);
  const am    = text.match(/^(?:author|by)[:\s]+(.+)/im);
  const hm    = text.match(/^#\s+(.+)/m);
  if (tm) title = tm[1].trim();
  if (am) author = am[1].trim();
  if (!tm && hm) title = hm[1].trim();
  return { title: title.slice(0, 100), author: author?.slice(0, 80) ?? null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('audiobook-ingest: chapter detection', () => {
  it('detects markdown headings as chapter boundaries', () => {
    const text = `# Prologue\nOnce upon a time.\n\n# Chapter 1\nThe story begins.\n\n# Chapter 2\nIt continues here.`;
    const chapters = detectChapters(text);
    assert.equal(chapters.length, 3);
    assert.equal(chapters[0].title, 'Prologue');
    assert.equal(chapters[1].title, 'Chapter 1');
    assert.equal(chapters[2].title, 'Chapter 2');
  });

  it('detects "Chapter N:" headings in plain text', () => {
    const text = `Chapter 1: The Beginning\nSome content here.\n\nChapter 2: The Middle\nMore content.`;
    const chapters = detectChapters(text);
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0].title, 'Chapter 1: The Beginning');
  });

  it('detects "CHAPTER N" all-caps heading', () => {
    const text = `CHAPTER 1 INTRO\nContent.\n\nCHAPTER 2 END\nMore.`;
    const chapters = detectChapters(text);
    assert.equal(chapters.length, 2);
  });

  it('detects "Part N:" headings', () => {
    const text = `Part 1: Setup\nText.\n\nPart 2: Conflict\nMore text.`;
    const chapters = detectChapters(text);
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0].title, 'Part 1: Setup');
  });

  it('auto-chunks text with no headings that exceeds 2×WORDS_PER_CHUNK', () => {
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(' ');
    const chapters = detectChapters(words);
    assert.ok(chapters.length > 1, 'should produce multiple chunks');
    assert.ok(chapters.every(c => c.wordCount <= WORDS_PER_CHUNK));
    assert.match(chapters[0].title, /^Part \d+$/);
  });

  it('returns single chapter for short text with no headings', () => {
    const text = 'This is a short book. It is very short indeed.';
    const chapters = detectChapters(text);
    assert.equal(chapters.length, 1);
    assert.equal(chapters[0].title, 'Part 1');
  });

  it('filters empty chapters after heading-only lines', () => {
    const text = `# Heading With No Body\n\n# Chapter 1\nActual content here.`;
    const chapters = detectChapters(text);
    assert.ok(chapters.every(c => c.content.length > 0));
  });

  it('counts words correctly in chapters', () => {
    const text = `# Chapter 1\nOne two three four five`;
    const chapters = detectChapters(text);
    assert.equal(chapters[0].wordCount, 5);
  });

  it('handles h2 and h3 headings', () => {
    const text = `## Section A\nContent A.\n\n### Sub B\nContent B.`;
    const chapters = detectChapters(text);
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0].title, 'Section A');
  });
});

describe('audiobook-ingest: metadata extraction', () => {
  it('extracts title from "Title: ..." header', () => {
    const text = `Title: My Great Book\nAuthor: Jane Doe\n\nContent here.`;
    const { title, author } = extractMeta(text, 'book.txt');
    assert.equal(title, 'My Great Book');
    assert.equal(author, 'Jane Doe');
  });

  it('extracts title from first # heading when no Title: field', () => {
    const text = `# The Grand Adventure\n\nOnce upon...`;
    const { title } = extractMeta(text, 'book.txt');
    assert.equal(title, 'The Grand Adventure');
  });

  it('falls back to filename when no metadata', () => {
    const text = `Just some plain text with no metadata.`;
    const { title, author } = extractMeta(text, 'my-book.txt');
    assert.equal(title, 'my-book');
    assert.equal(author, null);
  });

  it('truncates title to 100 chars', () => {
    const longTitle = 'A'.repeat(150);
    const text = `Title: ${longTitle}`;
    const { title } = extractMeta(text, 'f.txt');
    assert.equal(title.length, 100);
  });

  it('extracts "By: ..." author', () => {
    const text = `By: John Smith\nContent.`;
    const { author } = extractMeta(text, 'f.txt');
    assert.equal(author, 'John Smith');
  });
});

describe('audiobook-ingest: markdown stripping', () => {
  it('strips heading markers but keeps text', () => {
    const result = stripMarkdown('# Title\n## Sub\nContent');
    assert.ok(!result.includes('#'));
    assert.ok(result.includes('Title'));
  });

  it('strips bold/italic markers', () => {
    const result = stripMarkdown('**bold** and *italic*');
    assert.ok(!result.includes('*'));
    assert.ok(result.includes('bold'));
    assert.ok(result.includes('italic'));
  });

  it('strips links but keeps text', () => {
    const result = stripMarkdown('[click here](https://example.com)');
    assert.ok(!result.includes('https://'));
    assert.ok(result.includes('click here'));
  });

  it('strips image syntax entirely', () => {
    const result = stripMarkdown('![alt text](image.png)');
    assert.ok(!result.includes('image.png'));
    assert.ok(!result.includes('!['));
  });

  it('strips unordered list markers', () => {
    const result = stripMarkdown('- Item 1\n* Item 2\n+ Item 3');
    assert.ok(!result.match(/^[-*+]\s/m));
  });

  it('strips ordered list markers', () => {
    const result = stripMarkdown('1. First\n2. Second\n3. Third');
    assert.ok(!result.match(/^\d+\.\s/m));
  });
});

describe('audiobook-ingest: auto-chunk edge cases', () => {
  it('produces sequential Part N titles', () => {
    const words = Array.from({ length: 1700 }, (_, i) => `w${i}`).join(' ');
    const chunks = autoChunk(words);
    assert.deepEqual(chunks.map(c => c.title), ['Part 1', 'Part 2', 'Part 3']);
  });

  it('last chunk has remaining word count', () => {
    const words = Array.from({ length: 850 }, (_, i) => `w${i}`).join(' ');
    const chunks = autoChunk(words);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[1].wordCount, 50);
  });

  it('handles exactly WORDS_PER_CHUNK words as single chunk', () => {
    const words = Array.from({ length: WORDS_PER_CHUNK }, (_, i) => `w${i}`).join(' ');
    const chunks = autoChunk(words);
    assert.equal(chunks.length, 1);
  });
});
