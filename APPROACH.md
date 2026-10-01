# My Approach

These are the steps I took to solve the assignment, in order, and why I made each decision. For how to run the scripts, see the [README](README.md).

## 1. Understand the requirement

The task: validate that **exactly the first 100** articles on [HN /newest](https://news.ycombinator.com/newest) are sorted **newest to oldest**.

Before writing code, I broke that sentence into things I could check:

- **"Exactly 100"**: HN shows 30 articles per page, so I need 4 pages (30 + 30 + 30 + 10) and must stop at precisely 100.
- **"The first 100"**: the articles must be ranks 1 through 100, with none skipped and none repeated.
- **"Newest to oldest"**: each article must be the same age as, or older than, the one above it. Two posts can share a timestamp, so ties are allowed.

## 2. Inspect the page

I opened /newest in DevTools to find stable selectors:

| What | Where it lives |
| --- | --- |
| Article row | `tr.athing` |
| Rank | `span.rank` inside the row, e.g. `"31."` |
| Title | `span.titleline > a` |
| Age | `span.age` in the row **directly below** the article row |
| Next page | `a.morelink` ("More") |

The key finding was the age. The visible text ("5 minutes ago") is too coarse to sort by: many articles show the same "x minutes ago". But the `title` attribute of `span.age` holds the exact time, e.g. `2025-01-15T18:07:38 1736964458`. That's an ISO time followed by a Unix timestamp, which gives me a precise number to compare.

## 3. Prototype in Python

I wrote my first version in Python (`qadraft.py`) to prove the logic quickly:

1. Open /newest.
2. Read the ranks and timestamps on the page.
3. Click **More** and repeat until there are 100.
4. Compare each timestamp with the next one.

It worked, but it was one long script with no functions.

## 4. Port to JavaScript

The assignment requires JavaScript and Playwright, so I ported the same logic to `index.js` and checked that both versions gave the same result. I also built a small results page (`qa_result.html`) that the browser opens at the end. It shows the outcome visually instead of only in the terminal, which also makes the video demo clearer.

## 5. Review and harden

Next, I reviewed my own code the way I'd review someone else's: what could make this test give the **wrong answer**? I found and fixed several problems:

| Problem | Why it mattered | Fix |
| --- | --- | --- |
| Articles with a missing timestamp were skipped | It would quietly check article 101 instead of the first 100, and the rank list got out of step with the timestamps | Fail the run and name the article |
| A failed check still exited with code 0 | A test runner or CI would count it as a pass | Exit code 1 on failure or error |
| The loop assumed 30 rows per page | A short page would hang for 30 seconds, then crash | Loop over the real row count |
| Every page loaded twice | Slower, and HN rate-limits | Navigate only once, by clicking **More** |
| The browser didn't close on some errors | The process could hang | `try/finally` (JS) or a context manager (Python) |
| Timestamps compared as strings | Worked by luck of the format | Compare Unix seconds as numbers |
| Nothing proved these were the *first* 100 | Only the count was checked | Assert the ranks are exactly 1–100 in order |

I also restructured both scripts into small functions (collect, then validate, then report) so each step can be read and tested on its own.

## 6. Test the failure cases, not just the happy path

The live /newest page is almost always sorted correctly, so running against it only proves the **pass** path. To make sure the script actually **catches** problems, I ran it against a local mock of HN's page layout with bad data injected:

| Scenario | Expected | JS | Python |
| --- | --- | --- | --- |
| Correctly sorted | PASS, exit 0 | ✔ | ✔ |
| Article 57 newer than article 56 | FAIL naming both, exit 1 | ✔ | ✔ |
| Article 42 missing its timestamp | ERROR naming it, exit 1 | ✔ | ✔ |
| Browser fails to launch | Clear error, exit 1 | ✔ | ✔ |

A test that has never been seen to fail can't be trusted to catch anything, so this step mattered most to me.

## 7. Polish

- Headless and fast by default. `HEADED=1 SLOW_MO=1000` gives a slowed-down, visible run for demos.
- The result page shows a green **PASS** or a red **FAIL**.
- Renamed the Python draft to `hn_sort_validator.py` and kept both versions identical in behavior.
- Wrote the README and this document.

## What I'd do next

- **Run on a schedule in CI**, e.g. a GitHub Action every hour, so a sorting regression on HN would surface on its own.
- **Turn it into a `@playwright/test` spec** to get retries, traces and an HTML report for free.
- **Save the collected data** (rank, title, timestamp) as a JSON or CSV artifact, so a failure can be investigated after the fact.
- **Retry with a backoff** when HN rate-limits ("Sorry, we're not able to serve your requests this quickly").
