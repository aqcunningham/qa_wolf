"""
Hacker News Scraper / newest sort validator.

This script collects 100 articles from Hacker News across 4 pages (30 articles per) 
and validates that they are sorted from newest to oldest based on their timestamps in ISO-8601 format.

"""
import os
import urllib.parse

from playwright.sync_api import sync_playwright
p = sync_playwright().start()
b = p.chromium.launch(headless=False, slow_mo=2000)

page = b.new_page()
currentPage = ("https://news.ycombinator.com/newest")


try:
	articles = {}
	alltimestamps = []
	article_number = []
	while (len(articles) < 100):
		try:
			page.goto(currentPage)
		except Exception as e:
			print(f"Error occured: page took too long to load (over 30sec) - {e}")
			b.close()
			p.stop()
			break

		ranks_raw = page.locator("td.title span.rank").all_text_contents()
		ranks = [int(rank.strip(".")) for rank in ranks_raw]
		article_number.extend(ranks)
		ages = page.locator("span.subline span.age")
		
		for i in range(30):
			if len(articles) == 100:
				break

			timestamps = ages.nth(i).get_attribute("title")
			if timestamps is None:
				print(f"Error: timestamp for article at rank {ranks[i]} is None. Skipping this article.")
				continue
			articles[ranks[i]] = timestamps
			alltimestamps.append(timestamps)
		print(f"Number of articles collected: {len(articles)}")

		moreButton = page.locator("td.title a.morelink")
		if len(articles) < 100:
			moreButton.click()
			currentPage = page.url
except Exception as e:
	print(f"An error occurred: {e}")
	b.close()
	p.stop()	
	exit()

# before moving forward we ensure that we have exactly 100 articles, otherwise we raise an error
assert len(articles) == 100, f"Expected exactly 100 articles, but got {len(articles)}"

check = True
for i in range(len(articles)-1):
	if alltimestamps[i] < alltimestamps[i+1]:
		check = False		
		result_text = f"Validation failed: articles at rank {article_number[i]} and {article_number[i+1]} are out of order. Article {article_number[i]} has timestamp {alltimestamps[i]} and article {article_number[i+1]} has timestamp {alltimestamps[i+1]}."
		break
	else:
		result_text = f"Validated: exactly {len(articles)} articles retrieved and confirmed sorted from newest to oldest."

encoded = urllib.parse.quote(result_text)
result_page_path = os.path.abspath("qa_result.html")
page.goto(f"file://{result_page_path}?result={encoded}")
# print(timestamps)

input("Press Enter to close...")  # keeps the browser open so the page is actually visible

b.close()
p.stop()
exit()
