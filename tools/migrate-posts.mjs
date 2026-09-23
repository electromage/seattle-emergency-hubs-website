#!/usr/bin/env node
/**
 * One-time migration: hand-written blog/*.html -> content/posts/<slug>.md
 *
 * Feed metadata (excerpt, image, tag, author) comes from content/posts.json;
 * the post body comes out of <article class="post-article">, with the tag,
 * <h1> and .post-meta line dropped since build-blog.mjs regenerates those from
 * front matter.
 *
 * Bodies become markdown where the mapping is lossless and stay as inline HTML
 * where it is not -- figures and notice boxes carry classes and attributes
 * worth keeping. Markdown allows both, so nothing is lost.
 *
 * Safe to re-run: it overwrites the markdown it wrote before and never deletes
 * the source HTML. Removing the old pages is a separate, deliberate step.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import matter from 'gray-matter';
import TurndownService from 'turndown';

const ROOT = new URL('..', import.meta.url).pathname;
const POSTS_DIR = join(ROOT, 'content/posts');
const FEED_FILE = join(ROOT, 'content/posts.json');

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

/* Anything with attributes we would otherwise drop stays verbatim. */
turndown.keep(['figure', 'figcaption', 'div', 'img', 'iframe']);

/* Turndown pads list items to a 4-char marker ("-   item"). Valid markdown, but
   "- item" is what a human writes and what the CMS editor shows back. */
turndown.addRule('tightListItem', {
  filter: 'li',
  replacement(content, node) {
    const body = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n/gm, '\n  ');

    const parent = node.parentNode;
    const marker =
      parent.nodeName === 'OL'
        ? `${Array.prototype.indexOf.call(parent.children, node) + 1}. `
        : '- ';

    return marker + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
  },
});

/* Turndown escapes "1." inside headings to stop it reading as an ordered list.
   A heading can't start a list, so the backslash is just noise in the editor. */
const unescapeHeadingNumbers = (md) =>
  md.replace(/^(#{1,6} .*)$/gm, (line) => line.replace(/(\d)\\\./g, '$1.'));

function extractBody(html) {
  const match = html.match(/<article class="post-article">([\s\S]*?)<\/article>/);
  if (!match) return null;

  return match[1]
    .replace(/<span class="post-tag">[\s\S]*?<\/span>\s*/, '')
    .replace(/<h1>[\s\S]*?<\/h1>\s*/, '')
    .replace(/<p class="post-meta">[\s\S]*?<\/p>\s*/, '')
    .trim();
}

function extractDescription(html) {
  const match = html.match(/<meta name="description" content="([\s\S]*?)"\s*\/?>/);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function main() {
  const feed = JSON.parse(readFileSync(FEED_FILE, 'utf8'));
  mkdirSync(POSTS_DIR, { recursive: true });

  const results = [];

  for (const post of feed.posts) {
    const url = String(post.url || '');

    /* Entries already pointing off-site have no page to migrate; carry them
       across as externalUrl posts so the feed keeps them. */
    if (/^https?:\/\//i.test(url)) {
      const slug = String(post.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 70);

      writeFileSync(
        join(POSTS_DIR, `${slug}.md`),
        matter.stringify('', {
          title: post.title,
          date: post.date,
          author: post.author || 'Seattle Emergency Hubs Team',
          tag: post.tag || 'News',
          excerpt: post.excerpt || '',
          externalUrl: url,
        }),
        'utf8'
      );
      results.push({ slug, kind: 'external' });
      continue;
    }

    const file = join(ROOT, url);
    if (!existsSync(file)) {
      results.push({ slug: url, kind: 'MISSING SOURCE' });
      continue;
    }

    const html = readFileSync(file, 'utf8');
    const bodyHtml = extractBody(html);
    if (bodyHtml === null) {
      results.push({ slug: url, kind: 'NO ARTICLE FOUND' });
      continue;
    }

    const slug = basename(url, '.html');
    const description = extractDescription(html);

    const frontMatter = {
      title: post.title,
      date: post.date,
      author: post.author || 'Seattle Emergency Hubs Team',
      tag: post.tag || 'News',
      excerpt: post.excerpt || '',
    };

    /* Only carry a description when it actually differs from the excerpt;
       build-blog.mjs falls back to the excerpt otherwise. */
    if (description && description !== post.excerpt) {
      frontMatter.description = description;
    }
    if (post.image) {
      frontMatter.image = post.image;
      frontMatter.imageAlt = post.imageAlt || '';
      frontMatter.imageLayout = post.imageLayout || 'standard';
    }

    const markdown = unescapeHeadingNumbers(turndown.turndown(bodyHtml));
    writeFileSync(join(POSTS_DIR, `${slug}.md`), matter.stringify(`\n${markdown}\n`, frontMatter), 'utf8');
    results.push({ slug, kind: 'migrated', bytes: markdown.length });
  }

  for (const r of results) {
    const detail = r.bytes ? ` (${r.bytes} chars of markdown)` : '';
    console.log(`  ${r.kind.padEnd(18)} ${r.slug}${detail}`);
  }
  console.log(`\nmigrate:posts -> ${results.length} feed entr${results.length === 1 ? 'y' : 'ies'} processed`);
}

main();
