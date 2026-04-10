# Backend Documentation

This document explains how the backend works so you can quickly resume development later.

## Tech Stack

- Node.js + Express
- Socket.IO for realtime chat
- MongoDB + Mongoose for message persistence
- JWT for authentication

## Backend Entry Point

Main file: `server/index.js`

What happens on startup:

1. Loads environment variables with `dotenv`.
2. Creates an Express app with:
    - `cors()`
    - `express.json()`
3. Creates an HTTP server from Express.
4. Attaches Socket.IO by calling `require("./socket.js")(server)`.
5. Starts listening on `process.env.PORT || 3000`.
6. Connects to MongoDB by calling `connectDB()`.

Run commands (from project root):

- Development: `npm run dev`
- Production style run: `npm start`

## Environment Variables

Required:

- `JWT_SECRET`: used to sign and verify JWT tokens.

Optional:

- `PORT`: defaults to `3000`.

Note: `db.js` currently uses a hardcoded Mongo URL:

- `mongodb://127.0.0.1:27017/chatapp`

## Authentication

Files:

- `server/auth.js`
- `server/index.js` (HTTP middleware)
- `server/socket.js` (Socket.IO middleware)

### Token helpers (`auth.js`)

- `signToken(userId)`: signs `{ userId }` with `JWT_SECRET`, expires in 1 day.
- `verifyToken(token)`: verifies and returns payload.

### HTTP auth middleware (`index.js`)

- Reads `Authorization` header.
- Expects format: `Bearer <token>`.
- Verifies token and sets `req.userId`.
- Returns `401` for missing/invalid token.

### Socket auth middleware (`socket.js`)

- Reads token from `socket.handshake.auth.token`.
- Verifies token.
- Sets `socket.userId` for the connection.
- Rejects connection on auth failure.

## Room Logic

File: `server/room.js`

- `getPrivateRoomId(userA, userB)` returns a stable room id:
    - Sorts users numerically.
    - Format: `chat:<min>:<max>`.

This ensures both users always map to the same room id.

## Data Model

File: `server/models/Message.js`

Message fields:

- `roomId: String`
- `from: Number`
- `to: Number`
- `text: String`
- `time: Date` (default: now)
- `delivered: Boolean` (default: false)
- `read: Boolean` (default: false)

Collection stores chat history and delivery/read state.

## REST API Endpoints

All routes are in `server/index.js`.

### 1) Health route

- `GET /`
- Returns: `"hello"`

### 2) Login token route (temporary)

- `GET /login?userId=<number>`
- Purpose: generate JWT for a user id.
- Validation: `userId` required.
- Response:

```json
{ "token": "<jwt>" }
```

### 3) Get message history with another user (auth required)

- `GET /messages/:otherUserId`
- Header: `Authorization: Bearer <token>`
- Logic:
    - Uses `req.userId` from JWT.
    - Builds private room id for `(currentUser, otherUser)`.
    - Fetches messages sorted by `time` ascending.

### 4) Unread count for a user id (currently not auth-protected)

- `GET /unread?userId=<number>`
- Returns unread count where `to=userId` and `read=false`.
- Response:

```json
{ "count": 3 }
```

### 5) Conversation list for current user (auth required)

- `GET /conversations`
- Header: `Authorization: Bearer <token>`
- Logic:
    - Fetches all messages where current user is sender or receiver.
    - Sorts by newest first.
    - Keeps latest message per conversation partner.
    - Calculates unread count per partner.
- Returns array of:

```json
[
	{
		"userId": 7,
		"lastMessage": { "...": "message document" },
		"unread": 2
	}
]
```

## Socket.IO Events

All realtime logic is in `server/socket.js`.

## Connection lifecycle

On connect:

1. Authenticate using JWT from handshake.
2. Track socket in `onlineUsers` map:
    - key: `userId`
    - value: `Set` of socket ids
3. Join chat rooms.
4. Load undelivered messages for this user and emit them.
5. Mark those messages as delivered.

On disconnect:

- Remove socket id from `onlineUsers`.
- If user has no active sockets left, mark user offline in map.

### Current temporary room-join behavior

There is temporary hardcoded partner logic:

- User `42` joins room with `7`
- Any other user joins room with `42`

This is a placeholder and should later be replaced by real partner discovery.

### Incoming socket events

#### `send_message`

Payload:

```json
{ "to": 7, "text": "Hi" }
```

Behavior:

1. Computes `roomId`.
2. Checks if recipient is online via `onlineUsers`.
3. Creates message in DB.
4. Sets `delivered=true` if recipient online, else `false`.
5. Emits `new_message` to room.

#### `mark_read`

Payload:

```json
{ "from": 7 }
```

Behavior:

1. Finds unread messages in room where current user is recipient.
2. Marks each message as `read=true`.
3. Emits `message_read` for each message id.

### Outgoing socket events

- `new_message`: emitted when a message is sent/delivered.
- `message_read`: emitted when message read state is updated.

## Request and Event Flow Summary

Message send flow:

1. Client connects socket with JWT.
2. Client emits `send_message`.
3. Server saves `Message` document.
4. Server emits `new_message` to room.
5. Recipient sees message live (if connected) or receives later during undelivered sync.

Read receipt flow:

1. Client opens chat and emits `mark_read`.
2. Server updates unread messages to `read=true`.
3. Server emits `message_read` for affected message ids.

## Known Gaps / Things To Improve Later

1. Remove temporary user pairing (`42` and `7`) and implement dynamic room join strategy.
2. Move Mongo URI to env variable (for different environments).
3. Protect `/unread` with JWT middleware for consistency.
4. Add input validation and error handling for route and socket payloads.
5. Remove debug logs that print secrets or sensitive data.
6. Add indexes for query-heavy fields (`roomId`, `to`, `read`, `time`).
7. Add tests for auth middleware, endpoint behavior, and socket events.

## Quick Resume Checklist

When you return to this project:

1. Start MongoDB locally.
2. Ensure `.env` has `JWT_SECRET`.
3. Run backend with `npm run dev`.
4. Hit `GET /login?userId=42` (and another user id) to get tokens.
5. Connect frontend sockets with those tokens.
6. Verify:
    - message send
    - undelivered sync
    - unread count
    - read receipts
