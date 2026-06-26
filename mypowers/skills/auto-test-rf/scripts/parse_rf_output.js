#!/usr/bin/env node
/**
 * Parse Robot Framework output.xml and extract failed test case details.
 *
 * Usage:
 *   node parse_rf_output.js <output.xml>                    # All failed tests
 *   node parse_rf_output.js <output.xml> --test "Test Name"  # Filter by test name
 *   node parse_rf_output.js <output.xml> --stats             # Print summary stats only
 *   node parse_rf_output.js <output.xml> --all               # All tests (not just failed)
 *   node parse_rf_output.js <output.xml> --extract-log <log.html> --test "Name"  # Extract screenshots from log.html
 *
 * Output: JSON to stdout, progress info to stderr
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Helpers
// ============================================================

function parseTimestamp(elem) {
  const status = findChild(elem, 'status');
  if (!status) return { start: null, end: null };
  return {
    start: attr(status, 'starttime'),
    end: attr(status, 'endtime'),
  };
}

function parseMessages(kwElem) {
  const msgs = [];
  for (const msg of findChildren(kwElem, 'msg')) {
    const text = (msg.text || '').trim();
    if (text) {
      msgs.push({
        level: attr(msg, 'level') || 'INFO',
        timestamp: attr(msg, 'timestamp') || '',
        text,
      });
    }
  }
  return msgs;
}

function parseArguments(kwElem) {
  const argsElem = findChild(kwElem, 'arguments');
  if (!argsElem) return [];
  return findChildren(argsElem, 'arg').map((a) => a.text || '');
}

function parseKeyword(kwElem) {
  const statusEl = findChild(kwElem, 'status');
  const status = statusEl ? (attr(statusEl, 'status') || 'UNKNOWN') : 'UNKNOWN';

  const kw = {
    name: attr(kwElem, 'name') || '',
    library: attr(kwElem, 'library') || '',
    type: attr(kwElem, 'type') || 'KEYWORD',
    status,
    args: parseArguments(kwElem),
    messages: parseMessages(kwElem),
    elapsed: 0,
    startTime: '',
    endTime: '',
  };

  if (statusEl) {
    const elapsedStr = attr(statusEl, 'elapsed') || '0';
    kw.elapsed = Math.round(parseFloat(elapsedStr) * 1000) || 0;
    kw.startTime = attr(statusEl, 'starttime') || '';
    kw.endTime = attr(statusEl, 'endtime') || '';
  }

  // Recursively parse nested keywords
  kw.keywords = findChildren(kwElem, 'kw').map(parseKeyword);

  return kw;
}

function extractScreenshotPaths(keywords) {
  const paths = [];
  const imgRe = /<(?:img[^>]+src=|a[^>]+href=)"?'?([^"'>\s]+\.(?:png|jpg|jpeg|gif))/gi;

  for (const kw of keywords) {
    for (const msg of kw.messages || []) {
      let m;
      while ((m = imgRe.exec(msg.text || '')) !== null) {
        paths.push(m[1]);
      }
    }
    paths.push(...extractScreenshotPaths(kw.keywords || []));
  }
  return paths;
}

function parseTest(testElem) {
  const statusEl = findChild(testElem, 'status');
  const status = statusEl ? (attr(statusEl, 'status') || 'UNKNOWN') : 'UNKNOWN';

  let message = '';
  if (statusEl && statusEl.text) {
    message = statusEl.text.trim();
  }

  const keywords = findChildren(testElem, 'kw').map(parseKeyword);

  const tagsElem = findChild(testElem, 'tags');
  let tags = [];
  if (tagsElem) {
    tags = findChildren(tagsElem, 'tag').map((t) => t.text || '').filter(Boolean);
  }

  let elapsed = 0;
  let startTime = '';
  let endTime = '';
  if (statusEl) {
    const elapsedStr = attr(statusEl, 'elapsed') || '0';
    elapsed = Math.round(parseFloat(elapsedStr) * 1000) || 0;
    startTime = attr(statusEl, 'starttime') || '';
    endTime = attr(statusEl, 'endtime') || '';
  }

  return {
    id: attr(testElem, 'id') || '',
    name: attr(testElem, 'name') || '',
    status,
    message,
    startTime,
    endTime,
    elapsed,
    tags,
    keywords,
    screenshotPaths: extractScreenshotPaths(keywords),
    embeddedScreenshots: [],
  };
}

// ============================================================
// Simple XML parser (no deps, handles RF output.xml)
// ============================================================

class SimpleXMLParser {
  constructor(xml) {
    this.xml = xml;
    this.pos = 0;
  }

  parse() {
    // Skip XML declaration and comments before root
    this.skipMisc();
    return this.parseElement();
  }

  skipMisc() {
    while (this.pos < this.xml.length) {
      this.skipWS();
      if (this.xml.startsWith('<?', this.pos)) {
        this.pos = this.xml.indexOf('?>', this.pos) + 2;
      } else if (this.xml.startsWith('<!--', this.pos)) {
        this.pos = this.xml.indexOf('-->', this.pos) + 3;
      } else {
        break;
      }
    }
  }

  skipWS() {
    while (this.pos < this.xml.length && /\s/.test(this.xml[this.pos])) {
      this.pos++;
    }
  }

  parseElement() {
    this.skipWS();
    if (this.pos >= this.xml.length) return null;
    if (this.xml[this.pos] !== '<') {
      // Text node (only used for status message text)
      this.pos++;
      return null;
    }

    const tagEnd = this.xml.indexOf('>', this.pos);
    if (tagEnd === -1) return null;

    const tagContent = this.xml.substring(this.pos + 1, tagEnd);
    const selfClosing = tagContent.endsWith('/');
    const cleanTag = selfClosing ? tagContent.slice(0, -1).trim() : tagContent;

    // Parse tag name and attributes
    const parts = cleanTag.split(/\s+/);
    const tagName = parts[0];
    const attrs = {};
    const attrRe = /(\S+)=["']((?:[^"']|\\["'])*)["']/g;
    let m;
    while ((m = attrRe.exec(cleanTag)) !== null) {
      attrs[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    const elem = {
      tag: tagName,
      attrs,
      children: [],
      text: null,
    };

    this.pos = tagEnd + 1;

    if (selfClosing) return elem;

    // Parse children and text
    const closeTag = `</${tagName}>`;
    while (this.pos < this.xml.length) {
      this.skipWS();
      if (this.xml.startsWith(closeTag, this.pos)) {
        this.pos += closeTag.length;
        break;
      }
      if (this.xml.startsWith('</', this.pos)) {
        // Unexpected close tag, stop
        break;
      }
      if (this.xml[this.pos] === '<') {
        const child = this.parseElement();
        if (child) elem.children.push(child);
      } else {
        // Text content
        const lt = this.xml.indexOf('<', this.pos);
        const text = this.xml.substring(this.pos, lt === -1 ? this.xml.length : lt).trim();
        if (text) elem.text = (elem.text ? elem.text + '\n' : '') + text;
        this.pos = lt === -1 ? this.xml.length : lt;
      }
    }

    return elem;
  }
}

function findChild(elem, tag) {
  return elem.children.find((c) => c.tag === tag);
}

function findChildren(elem, tag) {
  return elem.children.filter((c) => c.tag === tag);
}

function attr(elem, name) {
  return elem.attrs ? elem.attrs[name] : undefined;
}

// ============================================================
// output.xml parser
// ============================================================

function parseOutputXml(filepath, onlyFailed, testNameFilter) {
  if (!fs.existsSync(filepath)) {
    console.error(`Error: File not found: ${filepath}`);
    process.exit(1);
  }

  console.error(`Parsing ${filepath}...`);

  const xml = fs.readFileSync(filepath, 'utf-8');
  const parser = new SimpleXMLParser(xml);
  const root = parser.parse();

  if (!root) {
    console.error('Error: Failed to parse XML');
    process.exit(1);
  }

  const allTests = [];
  let total = 0;
  let passed = 0;
  let failed = 0;

  for (const suite of findDescendants(root, 'suite')) {
    const suiteName = attr(suite, 'name') || '';
    const suiteSource = attr(suite, 'source') || '';

    for (const test of findChildren(suite, 'test')) {
      total++;
      const parsed = parseTest(test);
      parsed.suite = suiteName;
      parsed.suiteSource = suiteSource;

      if (parsed.status === 'PASS') passed++;
      else if (parsed.status === 'FAIL') failed++;

      let include = true;
      if (onlyFailed && parsed.status !== 'FAIL') include = false;
      if (testNameFilter && parsed.name !== testNameFilter) include = false;

      if (include) allTests.push(parsed);
    }
  }

  const result = {
    task_dir: path.dirname(path.resolve(filepath)),
    output_xml: path.resolve(filepath),
    total,
    passed,
    failed,
    tests: allTests,
  };

  console.error(`Done: ${total} total, ${passed} passed, ${failed} failed, ${allTests.length} selected.`);
  return result;
}

function* findDescendants(elem, tag) {
  for (const child of elem.children) {
    if (child.tag === tag) yield child;
    yield* findDescendants(child, tag);
  }
}

// ============================================================
// log.html screenshot extractor
// ============================================================

function extractLogScreenshots(logPath, testName) {
  if (!fs.existsSync(logPath)) return [];

  const content = fs.readFileSync(logPath, 'utf-8');
  const screenshots = [];

  // Simple state-machine approach: look for img tags after finding the test name
  const testIdx = content.indexOf(testName);
  if (testIdx === -1) return screenshots;

  // Search for img tags in the vicinity of the test name
  const searchStart = Math.max(0, testIdx - 2000);
  const searchEnd = Math.min(content.length, testIdx + 50000);
  const region = content.substring(searchStart, searchEnd);

  const imgRe = /<img\s+[^>]*src=["']([^"']+\.(?:png|jpg|jpeg|gif))["'][^>]*>/gi;
  let m;
  while ((m = imgRe.exec(region)) !== null) {
    screenshots.push({
      src: m[1],
      alt: '',
      title: '',
    });
  }

  return screenshots;
}

// ============================================================
// Main
// ============================================================

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(`Usage: node parse_rf_output.js <output.xml> [options]

Options:
  --all                     Include all tests (not just failed)
  --stats                   Print summary stats only
  --test <name>             Filter by test name
  --extract-log <log.html>  Extract screenshots from log.html (requires --test)`);
    process.exit(1);
  }

  const xmlPath = args[0];
  const onlyFailed = !args.includes('--all');
  const statsOnly = args.includes('--stats');

  // Parse --test filter
  let testName = null;
  const testIdx = args.indexOf('--test');
  if (testIdx !== -1 && testIdx + 1 < args.length) {
    testName = args[testIdx + 1];
  }

  // --extract-log mode
  const logIdx = args.indexOf('--extract-log');
  if (logIdx !== -1) {
    if (logIdx + 1 < args.length) {
      const logPath = args[logIdx + 1];
      const testNameExtract = testName || '';
      const screenshots = extractLogScreenshots(logPath, testNameExtract);
      console.log(JSON.stringify({ testName: testNameExtract, screenshots }, null, 2));
      console.error(`Extracted ${screenshots.length} screenshots for '${testNameExtract}'.`);
      return;
    }
  }

  // Default: parse output.xml
  const result = parseOutputXml(xmlPath, onlyFailed, testName);

  if (statsOnly) {
    const summary = {
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      failed_tests: result.tests
        .filter((t) => t.status === 'FAIL')
        .map((t) => ({
          id: t.id,
          name: t.name,
          message: (t.message || '').substring(0, 120),
        })),
    };
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
