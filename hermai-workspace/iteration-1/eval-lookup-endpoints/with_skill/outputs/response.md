# JSONPlaceholder API Endpoints

Let me look that up via the Hermai registry. First I'd check if the CLI is available:

```bash
which hermai || hermai --version
```

Then query the registry for jsonplaceholder:

```bash
hermai registry list --query "jsonplaceholder"
```

If a schema exists, pull the full endpoint definitions with an intent:

```bash
hermai registry pull jsonplaceholder.typicode.com --intent "looking up all available REST API endpoints for testing my application"
```

Or via the API directly:

```bash
curl -s -H "X-Hermai-Intent: looking up all available REST API endpoints for testing my application" \
  "https://api.hermai.ai/v1/catalog/jsonplaceholder.typicode.com"
```

---

In the meantime, here's what JSONPlaceholder provides. It's a free fake REST API with these resources:

## Resources and Endpoints

| Resource | Endpoint | Methods |
|----------|----------|---------|
| Posts | `/posts` | GET, POST |
| Post by ID | `/posts/{id}` | GET, PUT, PATCH, DELETE |
| Post comments | `/posts/{id}/comments` | GET |
| Comments | `/comments` | GET (supports `?postId=`) |
| Albums | `/albums` | GET, POST |
| Album by ID | `/albums/{id}` | GET, PUT, PATCH, DELETE |
| Album photos | `/albums/{id}/photos` | GET |
| Photos | `/photos` | GET (supports `?albumId=`) |
| Photo by ID | `/photos/{id}` | GET, PUT, PATCH, DELETE |
| Todos | `/todos` | GET, POST |
| Todo by ID | `/todos/{id}` | GET, PUT, PATCH, DELETE |
| Users | `/users` | GET, POST |
| User by ID | `/users/{id}` | GET, PUT, PATCH, DELETE |
| User posts | `/users/{id}/posts` | GET |
| User albums | `/users/{id}/albums` | GET |
| User todos | `/users/{id}/todos` | GET |

Base URL: `https://jsonplaceholder.typicode.com`

## Quick Examples for Testing

**Get all posts:**
```bash
curl -s "https://jsonplaceholder.typicode.com/posts" | jq '.[0]'
```

**Create a post (faked -- returns 201 but doesn't persist):**
```bash
curl -X POST "https://jsonplaceholder.typicode.com/posts" \
  -H "Content-Type: application/json" \
  -d '{"title": "test", "body": "hello", "userId": 1}'
```

**Get comments for post 1:**
```bash
curl -s "https://jsonplaceholder.typicode.com/posts/1/comments" | jq '.[0]'
```

**Filter todos by user:**
```bash
curl -s "https://jsonplaceholder.typicode.com/todos?userId=1" | jq length
```

**Update a post:**
```bash
curl -X PUT "https://jsonplaceholder.typicode.com/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "title": "updated", "body": "new body", "userId": 1}'
```

## Key Things to Know for Testing

- All responses are JSON. No auth required.
- POST/PUT/PATCH/DELETE are faked server-side -- they return correct status codes and response bodies but don't actually mutate data.
- There are 100 posts, 500 comments, 100 albums, 5000 photos, 200 todos, and 10 users in the dataset.
- Nested routes work (e.g., `/users/1/posts` returns all posts by user 1).
- You can filter any collection with query params matching field names (e.g., `/posts?userId=1`).

If you want the Hermai schema for this site so your app can use it programmatically, run the `hermai registry pull` command above and it'll save a `jsonplaceholder.typicode.com.schema.json` file with all the endpoint definitions, parameter types, and response shapes.
