# EzChat 💬

A real-time chat application built with React, Node.js, Socket.IO, and MongoDB.

**Live**: [ez-chat-gamma.vercel.app](https://ez-chat-gamma.vercel.app)

## Features

- 🔐 **Authentication** — Register & login with email/password
- 👤 **Profiles** — Unique usernames, display names, profile photos (Cloudinary)
- 💬 **Real-time Messaging** — Instant delivery via Socket.IO
- 🔍 **User Search** — Find users by username to start chatting
- ✓✓ **Read Receipts** — See when your messages are read
- 📱 **Responsive** — Works on desktop and mobile
- 🌙 **Dark Theme** — Glassmorphism-inspired UI

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, Axios |
| Backend | Node.js, Express |
| Real-time | Socket.IO |
| Database | MongoDB (Mongoose) |
| Auth | JWT, bcryptjs |
| Images | Cloudinary |
| Hosting | Vercel (frontend), Railway (backend) |

## Project Structure

```
├── server/            # Backend
│   ├── index.js       # Express app, routes, Cloudinary
│   ├── socket.js      # Socket.IO events
│   ├── auth.js        # JWT helpers
│   ├── db.js          # MongoDB connection
│   ├── room.js        # Room ID generation
│   └── models/        # Mongoose schemas (User, Message)
├── chat-frontend/     # React frontend
│   └── src/
│       ├── App.jsx    # Main app, auth, state
│       └── components/
├── .env               # Backend env vars (not committed)
└── package.json
```

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account

### 1. Clone & install

```bash
git clone https://github.com/Coding-enthu/EzChat.git
cd EzChat
npm install
cd chat-frontend && npm install
```

### 2. Configure environment

Create `.env` in the root:
```
PORT=3000
JWT_SECRET=your_secret
MONGO_URI=mongodb://127.0.0.1:27017/ezchat
CORS_ORIGIN=*
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Create `chat-frontend/.env`:
```
VITE_API_URL=http://localhost:3000
```

### 3. Run

```bash
# Terminal 1 — Backend
npm run dev

# Terminal 2 — Frontend
cd chat-frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## License

MIT
