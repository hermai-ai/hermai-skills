# JSONPlaceholder API Endpoints

JSONPlaceholder (`jsonplaceholder.typicode.com`) is a free fake REST API for testing and prototyping. It provides 6 main resources, each with standard REST endpoints. All responses are JSON. No authentication required.

## Base URL

```
https://jsonplaceholder.typicode.com
```

## Resources & Endpoints

### /posts (100 posts)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts` | List all posts |
| GET | `/posts/1` | Get post by ID |
| GET | `/posts/1/comments` | Get comments for a post |
| POST | `/posts` | Create a post |
| PUT | `/posts/1` | Update a post (full replace) |
| PATCH | `/posts/1` | Update a post (partial) |
| DELETE | `/posts/1` | Delete a post |

### /comments (500 comments)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/comments` | List all comments |
| GET | `/comments/1` | Get comment by ID |
| GET | `/comments?postId=1` | Filter comments by post |

### /albums (100 albums)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/albums` | List all albums |
| GET | `/albums/1` | Get album by ID |
| GET | `/albums/1/photos` | Get photos in an album |

### /photos (5000 photos)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/photos` | List all photos |
| GET | `/photos/1` | Get photo by ID |

### /todos (200 todos)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/todos` | List all todos |
| GET | `/todos/1` | Get todo by ID |

### /users (10 users)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users |
| GET | `/users/1` | Get user by ID |
| GET | `/users/1/albums` | Get albums by user |
| GET | `/users/1/todos` | Get todos by user |
| GET | `/users/1/posts` | Get posts by user |

## Nested Resources

You can access nested resources in two ways:

```
# Via nested route
GET /posts/1/comments

# Via query parameter filtering
GET /comments?postId=1
```

Both return the same data.

## Example Response Shapes

**Post:**
```json
{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
  "body": "quia et suscipit..."
}
```

**Comment:**
```json
{
  "postId": 1,
  "id": 1,
  "name": "id labore ex et quam laborum",
  "email": "Eliseo@gardner.biz",
  "body": "laudantium enim quasi..."
}
```

**User:**
```json
{
  "id": 1,
  "name": "Leanne Graham",
  "username": "Bret",
  "email": "Sincere@april.biz",
  "address": {
    "street": "Kulas Light",
    "suite": "Apt. 556",
    "city": "Gwenborough",
    "zipcode": "92998-3874",
    "geo": { "lat": "-37.3159", "lng": "81.1496" }
  },
  "phone": "1-770-736-8031 x56442",
  "website": "hildegard.org",
  "company": {
    "name": "Romaguera-Crona",
    "catchPhrase": "Multi-layered client-server neural-net",
    "bs": "harness real-time e-markets"
  }
}
```

**Todo:**
```json
{
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false
}
```

**Album:**
```json
{
  "userId": 1,
  "id": 1,
  "title": "quidem molestiae enim"
}
```

**Photo:**
```json
{
  "albumId": 1,
  "id": 1,
  "title": "accusamus beatae ad facilis cum similique qui sunt",
  "url": "https://via.placeholder.com/600/92c952",
  "thumbnailUrl": "https://via.placeholder.com/150/92c952"
}
```

## Notes for Testing

- **Write operations (POST/PUT/PATCH/DELETE) are faked** -- the server returns the expected response but does not actually persist changes.
- All GET requests return real static data you can rely on for assertions.
- No rate limiting, no auth required.
- Supports CORS, so you can call it from browser-based apps too.
- Use query params for filtering on any field: `GET /posts?userId=1`
