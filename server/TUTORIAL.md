# Chat App Backend — Tutorial

This tutorial walks you through every file in the `server/` folder so you understand
exactly what each piece does and how they all connect.

---

## Prerequisites

Before running the backend, make sure you have:

- Node.js installed
- MongoDB running locally on the default port (27017)
- A `.env` file in the project root with:

```
PORT=3000
JWT_SECRET=<your-secret-here>
MONGO_URI=mongodb://127.0.0.1:27017/chatapp
```

## Starting the Server

From the project root:

```bash
npm run dev    # development (auto-restarts on file changes via nodemon)
npm start      # production
```

Both commands run `server/index.js` as the entry point.

---

## How the Files Connect

Here is the dependency chain — every arrow means "requires / uses":

```
index.js  (entry point — Express app, HTTP routes, server bootstrap)
├── dotenv          ← loads .env variables into process.env
├── express         ← creates the HTTP server and REST API routes
├── auth.js         ← JWT helpers (sign and verify tokens)
├── db.js           ← connects Mongoose to MongoDB
├── room.js         ← generates room IDs for private chats
├── models/Message.js ← Mongoose model for chat messages
└── socket.js       ← all real-time Socket.IO logic
    ├── auth.js
    ├── room.js
    └── models/Message.js
```

Two files share code: both `index.js` and `socket.js` use `auth.js`, `room.js`,
and `Message.js`. This is because HTTP routes and WebSocket events both need to
authenticate users, compute room IDs, and read/write messages.

---

## File-by-File Walkthrough

### 1. `db.js` — Database Connection

This is the simplest file. It connects Mongoose to your MongoDB instance.

```js
const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp");
    console.log("MongoDB connected📈");
};
```

**What's happening:**

- `mongoose.connect()` opens a connection pool to MongoDB.
- The URL comes from your `.env` file (`MONGO_URI`), with a localhost fallback.
- This function is called once when the server starts (inside the `server.listen` callback in `index.js`).

---

### 2. `auth.js` — JWT Authentication Helpers

Two functions that wrap the `jsonwebtoken` library:

**`signToken(userId)`**

- Takes a user ID (a number).
- Creates a JWT payload containing `{ userId }`.
- Signs it with `JWT_SECRET` from your `.env`.
- Token expires in 1 day (`{expiresIn: "1d"}`).

**`verifyToken(token)`**

- Takes a JWT string.
- Verifies it against `JWT_SECRET`.
- Returns the decoded payload `{ userId }` if valid.
- Throws an error if invalid or expired.

**Where these are used:**

- `signToken` → called in the `/login` route (`index.js`) to generate tokens.
- `verifyToken` → called in the Socket.IO auth middleware (`socket.js`).

---

### 3. `room.js` — Room ID Generator

```js
const getPrivateRoomId = (userA, userB) => {
    const [min, max] = [userA, userB].sort((a, b) => a - b);
    return `chat:${min}:${max}`;
};
```

**What's happening:**

- Two users chatting need to be in the same "room" — a shared identifier.
- This function takes both user IDs, sorts them numerically, and creates a string like `chat:7:42`.
- Sorting is the key trick: `getPrivateRoomId(42, 7)` and `getPrivateRoomId(7, 42)` both return `chat:7:42`.
- This room ID is used in two places:
  1. As the Socket.IO room name (so `io.to(roomId).emit(...)` reaches both users).
  2. As the `roomId` field stored on each Message document (so you can query all messages in a conversation).

---

### 4. `models/Message.js` — Message Schema

This defines the shape of every chat message stored in MongoDB:

| Field       | Type    | Default    | Purpose                                                   |
|-------------|---------|------------|-----------------------------------------------------------|
| `roomId`    | String  | —          | Which conversation this belongs to (e.g. `chat:7:42`)     |
| `from`      | Number  | —          | Sender's user ID                                          |
| `to`        | Number  | —          | Recipient's user ID                                       |
| `text`      | String  | —          | The message content                                       |
| `time`      | Date    | `Date.now` | When the message was sent                                 |
| `delivered` | Boolean | `false`    | Has the recipient's client received this message?         |
| `read`      | Boolean | `false`    | Has the recipient opened/read this message?               |

**Why `delivered` and `read` are separate:**

- A message is **delivered** when the recipient's socket receives the `new_message` event (they might be looking at a different screen).
- A message is **read** when the recipient actively opens that specific conversation and the client emits `mark_read`.

**Indexes:**

The schema defines three indexes for fast queries:

| Index                    | Used by                                           |
|--------------------------|---------------------------------------------------|
| `{ roomId, time }`       | `GET /messages/:otherUserId` — fetch history sorted by time |
| `{ to, delivered }`      | Undelivered sync on socket connect                |
| `{ to, read }`           | `GET /unread` and `/conversations` unread counts  |

Without these indexes, MongoDB would scan every message document for these queries.

---

### 5. `index.js` — Entry Point & REST API

This is the main file. It does three things:

#### A. Server Bootstrap (top of file)

```js
require("dotenv").config();            // 1. load .env variables
const app = express();                 // 2. create Express app
app.use(cors());                       // 3. allow cross-origin requests
app.use(express.json());               // 4. parse JSON request bodies
const server = http.createServer(app); // 5. wrap Express in HTTP server
require("./socket.js")(server);        // 6. attach Socket.IO to the server
server.listen(PORT, () => {
    connectDB();                       // 7. connect to MongoDB
});
```

**Startup order matters:**

1. `.env` must load first so `process.env.PORT` and `process.env.JWT_SECRET` are available.
2. Express app and middleware are set up.
3. An HTTP server wraps Express (Socket.IO needs an HTTP server, not just an Express app).
4. `socket.js` receives the server and attaches Socket.IO to it.
5. The server starts listening, then MongoDB connects.

#### B. Authentication Middleware

```js
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No Token" });

    const token = authHeader.split(" ")[1];   // "Bearer <token>" → "<token>"

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;              // attach userId to the request
    next();                                   // continue to the route handler
};
```

**How clients use it:**

- Send an `Authorization` header with every request: `Authorization: Bearer <jwt-token>`.
- The middleware extracts the token part, verifies it, and puts the user ID on `req.userId`.
- If the token is missing or invalid → responds with `401 Unauthorized`.
- Routes that include `authenticate` as a middleware can access `req.userId`.

#### C. REST API Routes

| Route                     | Auth? | What it does                                                    |
|---------------------------|-------|-----------------------------------------------------------------|
| `GET /`                   | No    | Health check — returns `"hello"`                                |
| `GET /login?userId=N`     | No    | Generates a JWT for the given user ID (temporary/dev)           |
| `GET /messages/:otherUserId` | Yes | Returns all messages between you and another user, sorted by time |
| `GET /unread`             | Yes   | Returns how many unread messages you have                       |
| `GET /conversations`      | Yes   | Lists all your conversations with last message + unread count   |

**`GET /login?userId=N` in detail:**

This is a temporary development route. In production, you would replace this with a
real login system (username + password, OAuth, etc.). Right now it just takes any
user ID and hands back a JWT — useful for testing.

**`GET /messages/:otherUserId` in detail:**

1. Gets your userId from the JWT (via `authenticate` middleware).
2. Computes the room ID: `getPrivateRoomId(yourId, otherUserId)`.
3. Queries all messages in that room from MongoDB, sorted oldest-first.
4. Returns the array of message documents.

**`GET /conversations` in detail:**

1. Fetches all messages where you are sender OR receiver.
2. Sorts newest-first.
3. Loops through, keeping only the newest message per conversation partner.
4. For each partner, counts their unread messages to you.
5. Returns an array: each entry has `userId`, `lastMessage`, and `unread` count.

---

### 6. `socket.js` — Real-Time Messaging

This is the heart of the chat system. Everything that needs to happen instantly (sending
messages, receiving messages, read receipts) goes through here.

#### A. Setup & Auth Middleware

```js
module.exports = function (server) {
    const io = new Server(server, { cors: { origin: "*" } });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication Error"));

        const payload = verifyToken(token);
        socket.userId = payload.userId;
        next();
    });
```

- `socket.js` exports a function that takes the HTTP server.
- It creates a Socket.IO server attached to that HTTP server.
- The `io.use(...)` middleware runs for every new WebSocket connection.
- The client must pass a JWT in the connection handshake: `io({ auth: { token: "..." } })`.
- If auth fails, the connection is rejected — the client never gets a `connection` event.

#### B. Online User Tracking

```js
const onlineUsers = new Map();   // Map<userId, Set<socketId>>
```

- Each user can have multiple connections (multiple browser tabs, multiple devices).
- The Map tracks which socket IDs belong to which user.
- When a user connects:
  - Their socket ID is added to their Set.
- When a socket disconnects:
  - That socket ID is removed from the Set.
  - If the Set is now empty, the user is considered fully offline.
- This is used to check if a recipient is online when sending a message (to set `delivered`).

#### C. Connection Event

When a user connects (`io.on("connection")`), three things happen in order:

**1. Register as online:**

```js
if (!onlineUsers.has(socket.userId)) {
    onlineUsers.set(socket.userId, new Set());
}
onlineUsers.get(socket.userId).add(socket.id);
```

**2. Join chat rooms for existing conversations:**

```js
const sentTo = await Message.distinct("to", { from: socket.userId });
const receivedFrom = await Message.distinct("from", { to: socket.userId });
const chatPartners = [...new Set([...sentTo, ...receivedFrom])];

chatPartners.forEach((partnerId) => {
    const roomId = getPrivateRoomId(socket.userId, partnerId);
    socket.join(roomId);
});
```

This queries the database for every user you've sent a message to or received a
message from, deduplicates them, and joins the Socket.IO room for each conversation.
This means you'll receive real-time events for all your existing chats immediately.

**3. Deliver missed messages:**

```js
const undelivered = await Message.find({ to: socket.userId, delivered: false });
for (const msg of undelivered) {
    io.to(msg.roomId).emit("new_message", msg);
    msg.delivered = true;
    await msg.save();
}
```

If messages were sent while the user was offline, those messages have `delivered: false`.
When the user reconnects, the server finds them, emits them to the user, and marks
them as delivered.

#### D. `send_message` Event

When a client emits `send_message` with `{ to, text }`:

```
Client → socket.emit("send_message", { to: 7, text: "Hello" })
```

Server does:

1. Compute the room ID from `(socket.userId, to)`.
2. Join the sender into the room (in case this is a brand-new conversation).
3. If the recipient is online, join their sockets into the room too.
4. Check if the recipient is online via `onlineUsers.has(to)`.
5. Save the message to the database with `delivered: true` if online, `false` if offline.
6. Emit `new_message` to the room — both sender and recipient (if online) receive it.

The dynamic room joining in steps 2-3 is what makes new conversations work.
Neither user needs to be pre-assigned to a room — the first message creates the link.

#### E. `mark_read` Event

When a client opens a conversation and emits `mark_read` with `{ from }`:

```
Client → socket.emit("mark_read", { from: 42 })
```

Server does:

1. Compute the room ID from `(socket.userId, from)`.
2. Find all unread messages in that room where the current user is the recipient.
3. For each message: set `read = true`, save it, and emit `message_read` with the message ID.
4. The sender's client receives `message_read` and can show a read indicator (e.g. blue ticks).

#### F. Disconnect Event

When a socket disconnects:

1. Remove the socket ID from the user's Set in `onlineUsers`.
2. If the user has no more active sockets, delete them from the Map entirely.
3. Log that the user is now offline.

---

## Complete Message Flow (End to End)

Here's what happens when User 42 sends "Hello" to User 7:

```
1. User 42's client emits:
   socket.emit("send_message", { to: 7, text: "Hello" })

2. Server receives the event in socket.js:
   → Computes roomId: "chat:7:42"
   → Checks if user 7 is in onlineUsers → true or false
   → Saves to MongoDB: {
       roomId: "chat:7:42",
       from: 42,
       to: 7,
       text: "Hello",
       delivered: true/false
     }
   → Emits to room "chat:7:42":
     io.to("chat:7:42").emit("new_message", savedMessage)

3. If User 7 is connected and in room "chat:7:42":
   → User 7's client receives the "new_message" event instantly.

4. If User 7 is offline:
   → Message is saved with delivered: false.
   → When User 7 connects later, the undelivered sync picks it up
     and emits it then.
```

---

## Read Receipt Flow (End to End)

```
1. User 7 opens the chat with User 42.

2. Client emits:
   socket.emit("mark_read", { from: 42 })

3. Server finds all messages where:
   → roomId = "chat:7:42"
   → to = 7 (User 7 is the recipient)
   → read = false

4. For each unread message:
   → Sets read = true, saves to DB.
   → Emits to room "chat:7:42":
     io.to("chat:7:42").emit("message_read", { _id: messageId })

5. User 42's client receives "message_read" and shows a read indicator.
```

---

## Quick Reference

### Environment Variables

| Variable     | Required | Default                                  | Description                      |
|--------------|----------|------------------------------------------|----------------------------------|
| `PORT`       | No       | `3000`                                   | Server port                      |
| `JWT_SECRET` | Yes      | —                                        | Secret key for signing JWTs      |
| `MONGO_URI`  | No       | `mongodb://127.0.0.1:27017/chatapp`      | MongoDB connection URL           |

### Socket Events (Client → Server)

| Event          | Payload                         | Description                        |
|----------------|---------------------------------|------------------------------------|
| `send_message` | `{ to: Number, text: String }`  | Send a message to another user     |
| `mark_read`    | `{ from: Number }`              | Mark messages from a user as read  |

### Socket Events (Server → Client)

| Event          | Payload               | Description                          |
|----------------|-----------------------|--------------------------------------|
| `new_message`  | Message document      | A new or undelivered message arrived |
| `message_read` | `{ _id: String }`     | A message was marked as read         |

### REST API

| Method | Route                     | Auth | Response                                    |
|--------|---------------------------|------|---------------------------------------------|
| GET    | `/`                       | No   | `"hello"`                                   |
| GET    | `/login?userId=N`         | No   | `{ token: "<jwt>" }`                        |
| GET    | `/messages/:otherUserId`  | Yes  | `[ ...message documents ]`                  |
| GET    | `/unread`                 | Yes  | `{ count: N }`                              |
| GET    | `/conversations`          | Yes  | `[{ userId, lastMessage, unread }]`         |

---

## Known Temporary Things

These are placeholders still in the code that should be replaced for production:

1. **Fake login route** (`GET /login`) — No real authentication. Anyone can get a token for any user ID.
2. **No User model** — Users are just numbers. A real app needs a User collection with profiles, passwords, etc.
