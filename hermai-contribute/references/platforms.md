# Known Platforms

A running list of e-commerce, CMS, and social platforms with their conventions. If `hermai detect` shows one of these in `script_hosts` / `preconnect_hosts` / `meta_generator`, look up the platform's documented API first before hand-discovering.

This list is not exhaustive. Add entries as you encounter new platforms. The authoritative list belongs in the registry (future work) — this file is a community reference.

## E-commerce

### Shopify

- **Signals**: `cdn.shopify.com`, `myshopify.com`
- **Public JSON APIs**:
  - `GET /products.json?page=N` — paginated products
  - `GET /products/{handle}.json` — single product
  - `GET /collections.json` — list collections
  - `GET /collections/{handle}/products.json` — products in collection
  - `GET /search/suggest.json?q=...` — search suggestions
  - `GET /cart.js` — current cart
  - `POST /cart/add.js` — add to cart (requires cart cookie)

### Shopline

- **Signals**: `cdn.shoplineapp.com`, `shoplineapp.com`, `shoplineimg.com`
- **URL patterns**: `/products/{slug}`, `/categories/{slug}`
- **Data extraction**: JSON-LD Product on detail pages (name, offers.price, offers.availability, brand, description)
- **Dynamic**: cart and search are XHR — use `hermai intercept`

### Cyberbiz

- **Signals**: `cdn.cybassets.com`, `cyberbiz.io`, `cyberbiz.co`
- **URL patterns**: `/products/{slug}`
- **Data extraction**: JSON-LD Product

### WACA / GoGoShop

- **Signals**: `waca.tw`, `gogoshop.cloud`, `img.cloudimg.in`, `ecpjimg.cloudimg.in`
- **URL patterns**: `/product/detail/{numeric_id}`, `/product/all`, `/product/category/{id}`
- **Data extraction**: JSON-LD Product
- **Sitemap**: `/sitemap.xml` includes product URLs

### EasyStore / Rinkel (easy.co)

- **Signals**: `cdn.store-assets.com`, `resources.easystore.co`, `store-themes.easystore.co`, `x-powered-by: Express`
- **URL patterns**: `/products/{slug}`, `/collections/{slug}`
- **Data extraction**: Open Graph product type with `og:price:amount`, `og:price:currency`

### 91APP

- **Signals**: `91app.com`, `cdn.91app.com`
- Taiwanese e-commerce, commonly seen on brand-owned shops

### Meepshop

- **Signals**: `meepshop.com`
- Taiwanese e-commerce platform

## CMS

### WordPress

- **Signals**: `wp-content/`, `wp-includes/`, `meta generator="WordPress X.Y.Z"`, `x-powered-by: WordPress VIP` (on hosted)
- **REST API**: `/wp-json/wp/v2/posts`, `/wp-json/wp/v2/pages`, `/wp-json/wp/v2/categories`, `/wp-json/wp/v2/search`
- Always check `/wp-json/` — it lists all available routes

### Drupal

- **Signals**: `meta generator="Drupal X"`, `drupal.js`
- **JSON:API**: `/jsonapi/node/{bundle}`

### Ghost

- **Signals**: `meta generator="Ghost X.Y"`
- **Content API**: `/ghost/api/content/posts/` (requires API key, but listed in schema)

## Social / UGC

### Reddit

- `.json` suffix on any URL returns JSON: `/r/golang/.json`, `/r/golang/comments/{id}.json`

### Hacker News

- Firebase API: `https://hacker-news.firebaseio.com/v0/item/{id}.json`, `/v0/topstories.json`

### YouTube

- oEmbed: `/oembed?url=...&format=json`
- `ytInitialData` embedded script on watch/search pages (use `hermai extract --pattern ytInitialData`)
- `ytInitialPlayerResponse` for player/stream info

### TikTok

- `__UNIVERSAL_DATA_FOR_REHYDRATION__` script tag
- `SIGI_STATE` on older pages
- APIs require session bootstrap + request signing — see [sessions.md](sessions.md)

## Framework signals

These tell you the front-end framework, which hints at where data lives:

| Framework | Marker | Data location |
|-----------|--------|---------------|
| Next.js | `__NEXT_DATA__` script tag | `props.pageProps` |
| Nuxt 3 | `__NUXT_DATA__` script tag | JSON array |
| Nuxt 2 | `window.__NUXT__` | often function-wrapped |
| Apollo | `window.__APOLLO_STATE__` | normalized cache keyed by `__typename:id` |
| Redux | `window.__INITIAL_STATE__`, `window.__PRELOADED_STATE__` | app state tree |
| Remix | `window.__remixContext` | route data |
| Frontity | `__FRONTITY_CONNECT_STATE__` | WordPress-backed state |

All of these are recognized by `hermai extract`.

## Adding a new platform

When you encounter a platform not listed here:

1. Note the distinctive signals in `script_hosts` / `preconnect_hosts`
2. Document the URL patterns (`/products/{slug}` vs `/item/{id}` etc.)
3. Note whether data is in JSON-LD, OG, or embedded scripts
4. Note the XHR endpoints for search/cart/dynamic content
5. Add a section here in your PR
