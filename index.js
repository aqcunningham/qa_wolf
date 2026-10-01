// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");
const assert = require("assert");
const path = require("path");


// named function declaration, reusable
async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: false, slowMo: 2000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  let currentPage = "https://news.ycombinator.com/newest";
  await page.goto(currentPage);

  let articles = {};
  let alltimestamps = []; 
  let articleRanks = [];
  let result = '';

  try{
    while (Object.keys(articles).length < 100) {
      try {
        await page.goto(currentPage);
      } catch (e) {
        console.error("An error occurred: page took too long to load (over 30sec)", e);
        await browser.close();
        break;
      }
      let ranks_raw = await page.locator("td.title span.rank").allTextContents();
      let ranks = ranks_raw.map(rank => parseInt(rank.replace(".", "")));
      articleRanks.push(...ranks);
      let ages = page.locator("span.subline span.age");

      for (let i = 0; i < 30; i++) {
        if (Object.keys(articles).length === 100) {
          break;
        }
        let timestamps = await ages.nth(i).getAttribute("title");
        if (timestamps === null) {
          console.log(`Error: timestamp for article at rank ${articleRanks[i]} is null. Skipping this article.`);
          continue;
        }
        articles[ranks[i]] = timestamps;
        // articleRanks.push(...ranks);
        alltimestamps.push(timestamps);
      }
      console.log(`Number of articles collected: ${Object.keys(articles).length}`);

      let moreButton = await page.locator("td.title a.morelink");
      if (Object.keys(articles).length < 100) {
        await moreButton.click();
        currentPage = await page.url();
      }
    }
  } catch (e) {
    console.error("An error occurred:", e);
  return;
  }


assert(Object.keys(articles).length === 100, `Expected 100 articles, but got ${Object.keys(articles).length}`);

let check = true;
for (let i = 0; i < Object.keys(articles).length - 1; i++) {
  if (alltimestamps[i] < alltimestamps[i + 1]) {
    check = false;
    result = `Validation failed: articles at rank ${articleRanks[i]} and ${articleRanks[i + 1]} are out of order. Article ${articleRanks[i]} has timestamp ${alltimestamps[i]} and article ${articleRanks[i + 1]} has timestamp ${alltimestamps[i + 1]}.`;
    break;
  }
  else {
  result = `Validated: exactly ${Object.keys(articles).length} articles retrieved and confirmed sorted from newest to oldest.`;
  }
}

const encoded = encodeURIComponent(result);
const resultPagePath = path.resolve(__dirname, "qa_result.html");
await page.goto(`file://${resultPagePath}?result=${encoded}`);

const readline = require("readline/promises");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question("Press Enter to close...");
rl.close();
await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();