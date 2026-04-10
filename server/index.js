require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const { signToken } = require("./auth.js");
const connectDB = require("./db.js");
const { getPrivateRoomId } = require("./room.js");
const Message = require("./models/Message.js");
const User = require("./models/User.js");

// ---------- CLOUDINARY ----------

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadToCloudinary(fileBuffer) {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder: "ezchat-avatars",
				transformation: [{ width: 256, height: 256, crop: "fill" }],
			},
			(error, result) => {
				if (error) reject(error);
				else resolve(result);
			},
		);
		stream.end(fileBuffer);
	});
}

// ---------- EXPRESS ----------

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Multer — memory storage (files go to Cloudinary, not disk)
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
	fileFilter: (req, file, cb) => {
		const allowed = /jpeg|jpg|png|gif|webp/;
		const ext = allowed.test(path.extname(file.originalname).toLowerCase());
		const mime = allowed.test(file.mimetype);
		cb(null, ext && mime);
	},
});

const server = http.createServer(app);

// socket setup
require("./socket.js")(server);

server.listen(PORT, () => {
	connectDB();
	console.log("Server running at PORT: ", PORT);
});

// ---------- AUTH MIDDLEWARE ----------

const authenticate = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: "No Token" });
	}

	const token = authHeader.split(" ")[1];

	try {
		const payload = jwt.verify(token, process.env.JWT_SECRET);
		req.userId = payload.userId;
		next();
	} catch (err) {
		console.log(err.message);
		return res.status(401).json({ error: "Invalid Token" });
	}
};

app.get("/", (req, res) => {
	return res.send("hello");
});

// ---------- AUTH ROUTES ----------

app.post("/register", upload.single("photo"), async (req, res) => {
	try {
		const { email, password, username, name } = req.body;

		if (!email || !password || !username || !name) {
			return res.status(400).json({ error: "All fields are required" });
		}

		const existingEmail = await User.findOne({
			email: email.toLowerCase(),
		});
		if (existingEmail) {
			return res.status(409).json({ error: "Email already registered" });
		}

		const existingUsername = await User.findOne({
			username: username.toLowerCase(),
		});
		if (existingUsername) {
			return res.status(409).json({ error: "Username already taken" });
		}

		const hash = await bcrypt.hash(password, 10);

		// Upload photo to Cloudinary if provided
		let photoUrl = "";
		if (req.file) {
			const result = await uploadToCloudinary(req.file.buffer);
			photoUrl = result.secure_url;
		}

		const user = await User.create({
			email: email.toLowerCase(),
			password: hash,
			username: username.toLowerCase(),
			name,
			photo: photoUrl,
		});

		const token = signToken(user._id.toString());

		res.status(201).json({
			token,
			user: {
				_id: user._id,
				email: user.email,
				username: user.username,
				name: user.name,
				photo: user.photo,
			},
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

app.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res
				.status(400)
				.json({ error: "Email and password required" });
		}

		const user = await User.findOne({ email: email.toLowerCase() });
		if (!user) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		const token = signToken(user._id.toString());

		res.json({
			token,
			user: {
				_id: user._id,
				email: user.email,
				username: user.username,
				name: user.name,
				photo: user.photo,
			},
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

// ---------- USER ROUTES ----------

app.get("/users/search", authenticate, async (req, res) => {
	try {
		const q = req.query.q;
		if (!q || !q.trim()) {
			return res.json([]);
		}

		const users = await User.find(
			{
				username: { $regex: q.trim(), $options: "i" },
				_id: { $ne: req.userId },
			},
			"-password",
		).limit(20);

		res.json(users);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

app.put("/users/me", authenticate, upload.single("photo"), async (req, res) => {
	try {
		const { name, username } = req.body;
		const updates = {};
		let usernameChanged = false;

		const currentUser = await User.findById(req.userId);
		if (!currentUser) {
			return res.status(404).json({ error: "User not found" });
		}

		if (name && name.trim()) {
			updates.name = name.trim();
		}

		if (username && username.toLowerCase() !== currentUser.username) {
			const existing = await User.findOne({
				username: username.toLowerCase(),
				_id: { $ne: req.userId },
			});
			if (existing) {
				return res
					.status(409)
					.json({ error: "Username already taken" });
			}
			updates.username = username.toLowerCase();
			usernameChanged = true;
		}

		// Upload new photo to Cloudinary if provided
		if (req.file) {
			const result = await uploadToCloudinary(req.file.buffer);
			updates.photo = result.secure_url;
		}

		const user = await User.findByIdAndUpdate(
			req.userId,
			{ $set: updates },
			{ new: true, select: "-password" },
		);

		res.json({ user, usernameChanged });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

app.get("/users/:id", authenticate, async (req, res) => {
	try {
		const user = await User.findById(req.params.id, "-password");
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		res.json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

// ---------- MESSAGE ROUTES ----------

app.get("/messages/:otherUserId", authenticate, async (req, res) => {
	try {
		const userA = req.userId;
		const userB = req.params.otherUserId;

		const roomId = getPrivateRoomId(userA, userB);

		const messages = await Message.find({ roomId }).sort({ time: 1 });

		res.json(messages);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

app.get("/unread", authenticate, async (req, res) => {
	try {
		const userId = req.userId;

		const count = await Message.countDocuments({
			to: userId,
			read: false,
		});

		res.json({ count: count });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

app.get("/conversations", authenticate, async (req, res) => {
	try {
		const userId = req.userId;

		const messages = await Message.find({
			$or: [{ from: userId }, { to: userId }],
		}).sort({ time: -1 });

		const conversation = new Map();

		for (const msg of messages) {
			const otherUser = msg.from === userId ? msg.to : msg.from;

			if (!conversation.has(otherUser)) {
				const unreadCount = await Message.countDocuments({
					from: otherUser,
					to: userId,
					read: false,
				});

				conversation.set(otherUser, {
					lastMessage: msg,
					unreadCount: unreadCount,
				});
			}
		}

		// Fetch user info for all conversation partners
		const partnerIds = Array.from(conversation.keys());
		const users = await User.find(
			{ _id: { $in: partnerIds } },
			"-password",
		);
		const userMap = {};
		for (const u of users) {
			userMap[u._id.toString()] = u;
		}

		res.json(
			Array.from(conversation.entries()).map(([user, data]) => ({
				userId: user,
				user: userMap[user] || null,
				lastMessage: data.lastMessage,
				unread: data.unreadCount,
			})),
		);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});
