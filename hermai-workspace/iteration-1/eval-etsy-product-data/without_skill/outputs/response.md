# Getting Structured Product Data from Etsy

There are several approaches, ranging from official to scraping-based. Here is the landscape and what I would recommend.

---

## Option 1: Etsy Open API v3 (Official, Recommended)

Etsy provides an official REST API. This is the most reliable and legal route.

**Setup:**
1. Create an Etsy developer account at https://www.etsy.com/developers
2. Register an application to get an API key (keystring)
3. For public listing data, you only need the API key (no OAuth needed)

**Example — Search listings:**

```bash
curl -s "https://openapi.etsy.com/v3/application/listings/active?keywords=handmade+mug&limit=10" \
  -H "x-api-key: YOUR_ETSY_API_KEY" | jq '.results[] | {title, price: .price.amount, currency: .price.currency_code, shop_id, listing_id, url}'
```

**Example — Get shop info for a listing:**

```bash
curl -s "https://openapi.etsy.com/v3/application/shops/SHOP_ID" \
  -H "x-api-key: YOUR_ETSY_API_KEY" | jq '{shop_name: .shop_name, url: .url}'
```

**Python example:**

```python
import requests

API_KEY = "your_etsy_api_key"
BASE = "https://openapi.etsy.com/v3/application"

# Search active listings
resp = requests.get(f"{BASE}/listings/active", params={
    "keywords": "vintage lamp",
    "limit": 25,
    "includes": "Images,Shop"
}, headers={"x-api-key": API_KEY})

for listing in resp.json()["results"]:
    print({
        "title": listing["title"],
        "price": f"{listing['price']['amount'] / listing['price']['divisor']:.2f} {listing['price']['currency_code']}",
        "shop_name": listing.get("shop", {}).get("shop_name"),
        "listing_id": listing["listing_id"],
        "url": listing["url"],
    })
```

**Key endpoints:**
| Endpoint | What it returns |
|----------|----------------|
| `GET /listings/active` | Search all active listings (keywords, taxonomy, price range) |
| `GET /shops/{shop_id}/listings/active` | All listings for a specific shop |
| `GET /listings/{listing_id}` | Single listing detail |
| `GET /shops/{shop_id}` | Shop metadata (name, location, ratings) |

**Rate limits:** 10 requests/second per API key. Plenty for most use cases.

**Limitations:** The v3 API does not expose review text, sold counts, or some seller analytics. For those you would need scraping.

---

## Option 2: Scraping Etsy Directly

If the official API does not cover your needs (e.g., you need review data, sold counts, or trending/search ranking), you can scrape.

**Etsy's HTML structure:**

Etsy embeds structured data in their pages. Look for:
- `<script type="application/ld+json">` blocks (JSON-LD with Product schema)
- Server-rendered HTML with predictable CSS selectors

**Python with requests + BeautifulSoup:**

```python
import requests
from bs4 import BeautifulSoup
import json

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
}

url = "https://www.etsy.com/search?q=handmade+ceramic+mug"
resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.text, "html.parser")

# Extract JSON-LD structured data
for script in soup.find_all("script", type="application/ld+json"):
    data = json.loads(script.string)
    if data.get("@type") == "Product":
        print({
            "title": data.get("name"),
            "price": data.get("offers", {}).get("price"),
            "currency": data.get("offers", {}).get("priceCurrency"),
        })
```

**Caveats:**
- Etsy uses anti-bot measures (CAPTCHA, rate limiting, IP blocking)
- Search results pages may require JavaScript rendering (headless browser)
- Scraping violates Etsy's ToS; use at your own risk
- You will likely need rotating proxies and stealth headers for scale

**With a headless browser (Playwright):**

```python
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://www.etsy.com/listing/123456789/example-product")
    
    # Wait for content to render
    page.wait_for_selector('[data-appears-component-name="listing_page"]')
    
    # Extract from JSON-LD
    ld_json = page.evaluate('''
        () => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            return Array.from(scripts).map(s => JSON.parse(s.textContent));
        }
    ''')
    
    for item in ld_json:
        if item.get("@type") == "Product":
            print(json.dumps(item, indent=2))
    
    browser.close()
```

---

## Option 3: Third-Party Scraping APIs

If you want structured data without managing scraping infrastructure:

- **ScraperAPI / ScrapingBee** — handle proxies and anti-bot for you, return HTML
- **Oxylabs / BrightData** — e-commerce-specific scrapers with structured output for Etsy
- **SerpApi** — has an Etsy search engine endpoint that returns structured JSON directly

**SerpApi example:**

```python
import requests

params = {
    "engine": "etsy",
    "etsy_domain": "etsy.com",
    "q": "leather wallet",
    "api_key": "YOUR_SERPAPI_KEY"
}

resp = requests.get("https://serpapi.com/search", params=params)
for result in resp.json().get("organic_results", []):
    print({
        "title": result["title"],
        "price": result["price"],
        "shop": result.get("shop_name"),
        "url": result["link"],
    })
```

---

## My Recommendation

**Start with the Etsy Open API v3.** It is free, legal, well-documented, and returns clean JSON. It covers searching listings, getting prices, titles, shop names, images, and categories. Registration takes a few minutes.

Only resort to scraping if you specifically need data the API does not expose (review text, exact sold counts, competitor analytics).

| Approach | Cost | Reliability | Legality | Setup |
|----------|------|-------------|----------|-------|
| Etsy API v3 | Free (rate-limited) | High | Fully compliant | 5 min |
| Direct scraping | Free + proxy costs | Medium (anti-bot) | ToS violation | 30+ min |
| Third-party APIs | $30-100+/mo | High | Gray area | 10 min |
