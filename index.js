// Hacker News /newest sort validator (QA Wolf take-home, Question 1).
//
// Collects EXACTLY the first 100 articles from https://news.ycombinator.com/newest
// and validates that they are sorted from newest to oldest.
//
// Usage:
//   node index.js                    # fast, headless
//   HEADED=1 SLOW_MO=1000 node index.js  # visible browser, slowed down for demos
//
// Exit code: 0 = validated, 1 = validation failed or the run errored.

const { chromium } = require("playwright");
const path = require("path");
const readline = require("readline/promises");

const START_URL = "https://news.ycombinator.com/newest";
const TARGET_COUNT = 100;
const HEADED = process.env.HEADED === "1";
const SLOW_MO = Number(process.env.SLOW_MO || 0);

// HN's age `title` looks like "2025-01-15T18:07:38 1736964458" (ISO time, then Unix epoch).
// Older markup only has the ISO part, so fall back to parsing that as UTC.
function parseTimestamp(title) {
  const [iso, epoch] = title.trim().split(/\s+/);
  if (epoch && /^\d+$/.test(epoch)) return Number(epoch);
  const ms = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(ms)) throw new Error(`Unparseable timestamp: "${title}"`);
  return Math.floor(ms / 1000);
}

// Reads every article on the current page as { rank, title, timestamp }.
async function readArticlesOnPage(page) {
  const rows = page.locator("tr.athing");
  const count = await rows.count();
  const articles = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const rank = parseInt((await row.locator("span.rank").textContent()).replace(".", ""), 10);
    const title = (await row.locator("span.titleline > a").first().textContent()).trim();
    // The age lives in the row directly after the article row.
    const ageTitle = await row.locator("xpath=following-sibling::tr[1]").locator("span.age").getAttribute("title");

    // A missing timestamp means we can't validate this article, and skipping it
    // would mean we are no longer checking the *first* 100. Fail loudly instead.
    if (ageTitle === null) {
      throw new Error(`Article at rank ${rank} ("${title}") has no timestamp`);
    }
    articles.push({ rank, title, timestamp: parseTimestamp(ageTitle) });
  }
  return articles;
}

// Pages through /newest via the "More" link until TARGET_COUNT articles are collected.
async function collectArticles(page) {
  const articles = [];
  await page.goto(START_URL);

  while (articles.length < TARGET_COUNT) {
    const pageArticles = await readArticlesOnPage(page);
    if (pageArticles.length === 0) {
      throw new Error(`No articles found on ${page.url()}`);
    }
    articles.push(...pageArticles.slice(0, TARGET_COUNT - articles.length));
    console.log(`Collected ${articles.length}/${TARGET_COUNT} articles`);

    if (articles.length < TARGET_COUNT) {
      // "More" links to ?next=<id>, so new submissions don't shift the next page.
      await Promise.all([page.waitForURL(/newest\?next=/), page.locator("a.morelink").click()]);
    }
  }
  return articles;
}

function isoTime(ts) {
  return new Date(ts * 1000).toISOString().replace(".000", "");
}

// Returns a { passed, message } describing whether the articles are newest-to-oldest.
function validateArticles(articles) {
  if (articles.length !== TARGET_COUNT) {
    return { passed: false, message: `Expected exactly ${TARGET_COUNT} articles, but got ${articles.length}.` };
  }

  // Proves these are the *first* 100: ranks must be exactly 1..100 in order.
  const badRank = articles.findIndex((a, i) => a.rank !== i + 1);
  if (badRank !== -1) {
    return {
      passed: false,
      message: `Expected rank ${badRank + 1} at position ${badRank + 1}, but found rank ${articles[badRank].rank}.`,
    };
  }

  // Equal timestamps are allowed: two posts can land in the same second.
  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];
    if (current.timestamp < next.timestamp) {
      return {
        passed: false,
        message:
          `Validation failed: rank ${current.rank} ("${current.title}", ${isoTime(current.timestamp)}) ` +
          `is older than rank ${next.rank} ("${next.title}", ${isoTime(next.timestamp)}).`,
      };
    }
  }

  return {
    passed: true,
    message: `Validated: exactly ${articles.length} articles retrieved and confirmed sorted from newest to oldest.`,
  };
}

// Shows the result on the local results page; in headed mode, waits for Enter before closing.
async function showResult(page, { passed, message }) {
  const resultPagePath = path.resolve(__dirname, "qa_result.html");
  const params = new URLSearchParams({ result: message, status: passed ? "pass" : "fail" });
  await page.goto(`file://${resultPagePath}?${params}`);

  if (HEADED) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("Press Enter to close...");
    rl.close();
  }
}

async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: !HEADED, slowMo: SLOW_MO });
  try {
    const page = await browser.newPage();
    const articles = await collectArticles(page);
    const result = validateArticles(articles);

    console.log(result.passed ? `PASS: ${result.message}` : `FAIL: ${result.message}`);
    await showResult(page, result);
    return result.passed;
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    const passed = await sortHackerNewsArticles();
    process.exitCode = passed ? 0 : 1;
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exitCode = 1;
  }
})();
