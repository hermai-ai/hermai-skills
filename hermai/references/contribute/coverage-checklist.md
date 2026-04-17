# Coverage Checklist

A schema with only a product detail page is **10% done**. Use this checklist by site type before declaring a schema complete.

## The failure mode to avoid

The default discovery pipeline (`detect → wellknown → probe --body | extract`) captures what's on the page you pointed it at. If you only point it at the homepage and a single product, you get 2 endpoints. That's not a useful schema — it's a single data extraction recipe.

**Ask the user's question, not the scraper's.** What does a person actually DO on this site? Map each verb to an endpoint. Then discover each one separately.

## Commerce / shop sites

| Interaction | Endpoint | Discovery method |
|-------------|----------|------------------|
| Browse catalog | GET `/products` or `/collections/{slug}` | Probe a category URL, extract pagination |
| Category listing | GET `/categories/{slug}` or `/{category}` | Same as above |
| Search | GET `/search?q=…` or XHR | Try GET first, fall back to `hermai intercept` |
| Search suggestions | XHR (type-ahead) | `hermai intercept`, search in the UI |
| Product detail | GET `/products/{slug}` | Probe + extract JSON-LD Product |
| Add to cart | POST to cart endpoint | `hermai intercept`, click "add to cart" |
| View cart | GET `/cart` or XHR | Intercept |
| Update/remove cart item | POST/DELETE | Intercept during update |
| Login | POST `/login` or similar | Intercept during login. CSRF token needed. |
| Register | POST | Intercept |
| Order history | GET (authenticated) | Session bootstrap + capture |
| Checkout | Multi-step POST | Intercept full checkout flow |
| Product reviews | GET `/products/{slug}/reviews` | Probe a review section |
| Submit review | POST (authenticated) | Intercept |
| Wishlist | GET/POST | Intercept |

**Minimum viable commerce schema**: catalog listing + search + product detail. Without search, the agent can't find anything by name.

## News / content sites

| Interaction | Endpoint |
|-------------|----------|
| Article list / homepage feed | GET `/` or `/latest` — often has RSS too |
| Article detail | GET `/article/{slug}` |
| Search articles | GET `/search?q=…` or XHR |
| Category/topic browsing | GET `/topic/{slug}` |
| Author page | GET `/author/{name}` |
| Comments on article | GET often, POST for submit |
| Subscribe / newsletter | POST |

## Social platforms

| Interaction | Endpoint |
|-------------|----------|
| Profile | GET `/user/{handle}` |
| User's posts | GET (scroll = pagination) |
| Single post | GET `/post/{id}` |
| Feed / timeline | GET authenticated, often XHR |
| Search users / posts | GET or XHR |
| Post content | POST authenticated |
| Like / comment | POST authenticated |
| Follow / unfollow | POST authenticated |
| Messages / DMs | GET/POST authenticated |

## Booking / travel

| Interaction | Endpoint |
|-------------|----------|
| Search listings | GET or XHR with many params (dates, guests, location) |
| Listing detail | GET `/listings/{id}` |
| Availability calendar | XHR per listing |
| Reservation / book | POST authenticated multi-step |
| User reviews on listing | GET, often paginated |

## SaaS / developer tools

| Interaction | Endpoint |
|-------------|----------|
| List resources | GET `/api/v1/{resource}` |
| Resource detail | GET `/api/v1/{resource}/{id}` |
| Create resource | POST |
| Update resource | PUT/PATCH |
| Delete resource | DELETE |
| Search resources | GET with query params |
| User's account / settings | GET/PUT authenticated |

## How to use this checklist

1. Pick the category that fits the site
2. Work down the list — for each row, either discover the endpoint or confirm the site doesn't support it
3. If you're stopping before reaching "Submit review / Post / Cart update", you're shipping an incomplete schema. Document what's missing with a top-level note so future contributors know to extend it.

## When it's OK to ship partial coverage

- The site genuinely doesn't support writes (read-only resource, public data, archived content)
- The write flow requires payment, account creation, or interactions outside the schema's scope (add `"interactions_out_of_scope": ["checkout"]` to document this)
- You're contributing the first schema and plan a follow-up — add a `coverage: "partial"` field and list what's missing in the description

Never ship a schema claiming "complete" when it's only product_detail.
