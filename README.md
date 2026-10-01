# Hacker News `/newest` Sort Validator

A Playwright script that opens [Hacker News /newest](https://news.ycombinator.com/newest), collects **exactly the first 100 articles**, and checks that they are sorted from newest to oldest. It's written twice, in **JavaScript** (`index.js`, the required solution) and in **Python** (`hn_sort_validator.py`, a port with the same behavior).

📝 For the steps I took and why, see **[APPROACH.md](APPROACH.md)**.

## How to run

### JavaScript

```bash
npm i
npx playwright install chromium
node index.js        # or: npm start
```

### Python

```bash
pipenv install
pipenv run playwright install chromium
pipenv run python hn_sort_validator.py
```

### Options

Both scripts run headless and at full speed by default. Use these environment variables to watch the run:

| Variable | Default | Effect |
| --- | --- | --- |
| `HEADED` | off | `HEADED=1` opens a visible browser and keeps it open on the result page until you press Enter |
| `SLOW_MO` | `0` | Milliseconds to pause between Playwright actions, e.g. `SLOW_MO=1000` |

```bash
HEADED=1 SLOW_MO=1000 node index.js    # or: npm run demo
```

The script exits with code **0** when validation passes and **1** when it fails or errors, so it can run in CI.

## How it works

1. **Collect.** Read each article row (`tr.athing`) for its rank, title and timestamp, then click **More** until there are 100. The last page is cut off at exactly 100.
2. **Read exact timestamps.** The "5 minutes ago" text is too coarse to sort by. The script reads the `title` attribute of `span.age` instead, which holds an exact time (e.g. `2025-01-15T18:07:38 1736964458`), and compares the Unix seconds as numbers.
3. **Validate.**
   - There are exactly 100 articles.
   - Their ranks are exactly 1 through 100 in order, which proves these are the *first* 100.
   - No article is newer than the one above it. Equal timestamps are allowed, since two posts can be submitted in the same second.
4. **Report.** The result is printed to the terminal and shown on a local result page (`qa_result.html`) in green for a pass or red for a fail.

## Edge cases handled

- **Missing timestamp:** the run fails and names the article. Skipping it would quietly validate article 101 instead of the first 100.
- **New posts during the run:** the **More** link points to `?next=<item id>`, so new submissions don't shift the later pages and cause duplicates.
- **Short or empty pages:** the script reads however many rows the page actually has, and errors clearly if a page has none.
- **Errors and timeouts:** the browser is always closed (`try/finally` in JS, a context manager in Python), and the error is reported with exit code 1.

## Sample output

```
Collected 30/100 articles
Collected 60/100 articles
Collected 90/100 articles
Collected 100/100 articles
PASS: Validated: exactly 100 articles retrieved and confirmed sorted from newest to oldest.
```

A failure names both articles and their times:

```
FAIL: Validation failed: rank 56 ("Some story", 2025-01-15T17:11:38Z) is older than rank 57 ("Another story", 2025-01-15T18:07:38Z).
```

## Why two languages?

The assignment asks for JavaScript, but I also wrote the validator in Python to show that the approach doesn't depend on one language. Both versions use the same selectors, checks and exit codes, so they can be compared side by side.

---

## 🐺 Original Assignment (QA Wolf)

Welcome to the QA Wolf take home assignment for our [QA Engineer](https://www.task-wolf.com/apply-qae) role! We appreciate your interest and look forward to seeing what you come up with.

### Instructions

This assignment has two questions as outlined below. When you are done, upload your assignment to our [application page](https://www.task-wolf.com/apply-qae):


#### Question 1

In this assignment, you will create a script on [Hacker News](https://news.ycombinator.com/) using JavaScript and Microsoft's [Playwright](https://playwright.dev/) framework. 

1. Install node modules by running `npm i`.

2. Edit the `index.js` file in this project to go to [Hacker News/newest](https://news.ycombinator.com/newest) and validate that EXACTLY the first 100 articles are sorted from newest to oldest. You can run your script with the `node index.js` command.

Note that you are welcome to update Playwright or install other packages as you see fit, however you must utilize Playwright in this assignment.

#### Question 2

Why do you want to work at QA Wolf? Please record a short, ~2 min video using [Loom](https://www.loom.com/) that includes:

1. Your answer 

2. A walk-through demonstration of your code, showing a successful execution

The answer and walkthrough should be combined into *one* video, and must be recorded using Loom as the submission page only accepts Loom links.

### Frequently Asked Questions

#### What is your hiring process? When will I hear about next steps?

This take home assignment is the first step in our hiring process, followed by a final round interview if it goes well. **We review every take home assignment submission and promise to get back to you either way within two weeks (usually sooner).** The only caveat is if we are out of the office, in which case we will get back to you when we return. If it has been more than two weeks and you have not heard from us, please do follow up.

The final round interview is a 2-hour technical work session that reflects what it is like to work here. We provide a $150 stipend for your time for the final round interview regardless of how it goes. After that, there may be a short chat with our director about your experience and the role.

Our hiring process is rolling where we review candidates until we have filled our openings. If there are no openings left, we will keep your contact information on file and reach out when we are hiring again.

#### Having trouble uploading your assignment?
Be sure to delete your `node_modules` file, then zip your assignment folder prior to upload. 

#### How do you decide who to hire?

We evaluate candidates based on three criteria:

- Technical ability (as demonstrated in the take home and final round)
- Customer service orientation (as this role is customer facing)
- Alignment with our mission and values (captured [here](https://qawolf.notion.site/Mission-and-Values-859c7d0411ba41349e1b318f4e7abc8f))

This means whether we hire you is based on how you do during our interview process, not on your previous experience (or lack thereof). Note that you will also need to pass a background check to work here as our customers require this.

#### How can I help my application stand out?

While the assignment has clear requirements, we encourage applicants to treat it as more than a checklist. If you're genuinely excited about QA Wolf, consider going a step further—whether that means building a simple user interface, adding detailed error handling or reporting, improving the structure of the script, or anything else that showcases your unique perspective.

There's no "right" answer—we're curious to see what you choose to do when given freedom and ambiguity. In a world where tools can help generate working code quickly and make it easier than ever to complete technical take-homes, we value originality and intentionality. If that resonates with you, use this assignment as a chance to show us how you think.

Applicants who approach the assignment as a creative challenge, not just a checklist, tend to perform best in our process.