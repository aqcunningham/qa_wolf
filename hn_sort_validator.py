"""
Hacker News /newest sort validator (Python port of index.js).

Collects EXACTLY the first 100 articles from https://news.ycombinator.com/newest
and validates that they are sorted from newest to oldest.

Usage:
    python hn_sort_validator.py                          # fast, headless
    HEADED=1 SLOW_MO=1000 python hn_sort_validator.py    # visible browser, slowed down for demos

Exit code: 0 = validated, 1 = validation failed or the run errored.
"""
import os
import sys
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.sync_api import Page, sync_playwright

START_URL = "https://news.ycombinator.com/newest"
TARGET_COUNT = 100
HEADED = os.environ.get("HEADED") == "1"
SLOW_MO = int(os.environ.get("SLOW_MO", "0"))
RESULT_PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qa_result.html")


@dataclass
class Article:
	rank: int
	title: str
	timestamp: int  # Unix seconds


def parse_timestamp(title: str) -> int:
	"""HN's age `title` looks like "2025-01-15T18:07:38 1736964458" (ISO time, then Unix epoch).
	Older markup only has the ISO part, so fall back to parsing that as UTC."""
	parts = title.split()
	if len(parts) > 1 and parts[1].isdigit():
		return int(parts[1])
	iso = parts[0].removesuffix("Z")
	return int(datetime.fromisoformat(iso).replace(tzinfo=timezone.utc).timestamp())


def read_articles_on_page(page: Page) -> list[Article]:
	"""Reads every article on the current page."""
	rows = page.locator("tr.athing")
	articles = []

	for i in range(rows.count()):
		row = rows.nth(i)
		rank = int(row.locator("span.rank").text_content().strip().rstrip("."))
		title = row.locator("span.titleline > a").first.text_content().strip()
		# The age lives in the row directly after the article row.
		age_title = row.locator("xpath=following-sibling::tr[1]").locator("span.age").get_attribute("title")

		# A missing timestamp means we can't validate this article, and skipping it
		# would mean we are no longer checking the *first* 100. Fail loudly instead.
		if age_title is None:
			raise RuntimeError(f'Article at rank {rank} ("{title}") has no timestamp')
		articles.append(Article(rank, title, parse_timestamp(age_title)))
	return articles


def collect_articles(page: Page) -> list[Article]:
	"""Pages through /newest via the "More" link until TARGET_COUNT articles are collected."""
	articles: list[Article] = []
	page.goto(START_URL)

	while len(articles) < TARGET_COUNT:
		page_articles = read_articles_on_page(page)
		if not page_articles:
			raise RuntimeError(f"No articles found on {page.url}")
		articles.extend(page_articles[: TARGET_COUNT - len(articles)])
		print(f"Collected {len(articles)}/{TARGET_COUNT} articles")

		if len(articles) < TARGET_COUNT:
			# "More" links to ?next=<id>, so new submissions don't shift the next page.
			with page.expect_navigation(url="**/newest?next=*"):
				page.locator("a.morelink").click()
	return articles


def iso(ts: int) -> str:
	return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def validate_articles(articles: list[Article]) -> tuple[bool, str]:
	"""Returns (passed, message) describing whether the articles are newest-to-oldest."""
	if len(articles) != TARGET_COUNT:
		return False, f"Expected exactly {TARGET_COUNT} articles, but got {len(articles)}."

	# Proves these are the *first* 100: ranks must be exactly 1..100 in order.
	for i, article in enumerate(articles):
		if article.rank != i + 1:
			return False, f"Expected rank {i + 1} at position {i + 1}, but found rank {article.rank}."

	# Equal timestamps are allowed: two posts can land in the same second.
	for current, nxt in zip(articles, articles[1:]):
		if current.timestamp < nxt.timestamp:
			return False, (
				f'Validation failed: rank {current.rank} ("{current.title}", {iso(current.timestamp)}) '
				f'is older than rank {nxt.rank} ("{nxt.title}", {iso(nxt.timestamp)}).'
			)

	return True, f"Validated: exactly {len(articles)} articles retrieved and confirmed sorted from newest to oldest."


def show_result(page: Page, passed: bool, message: str) -> None:
	"""Shows the result on the local results page; in headed mode, waits for Enter before closing."""
	params = urllib.parse.urlencode({"result": message, "status": "pass" if passed else "fail"})
	page.goto(f"file://{RESULT_PAGE}?{params}")
	if HEADED:
		input("Press Enter to close...")


def main() -> int:
	with sync_playwright() as p:
		browser = p.chromium.launch(headless=not HEADED, slow_mo=SLOW_MO)
		try:
			page = browser.new_page()
			articles = collect_articles(page)
			passed, message = validate_articles(articles)

			print(f"PASS: {message}" if passed else f"FAIL: {message}")
			show_result(page, passed, message)
			return 0 if passed else 1
		finally:
			browser.close()


if __name__ == "__main__":
	try:
		sys.exit(main())
	except Exception as e:
		print(f"ERROR: {e}", file=sys.stderr)
		sys.exit(1)
