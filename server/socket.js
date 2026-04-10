const { Server } = require("socket.io");
const { verifyToken } = require("./auth.js");
const { getPrivateRoomId } = require("./room.js");
const Message = require("./models/Message.js");

const onlineUsers = new Map();

module.exports = function (server) {
	const io = new Server(server, {
		cors: { origin: process.env.CORS_ORIGIN || "*" },
	});

	// Socket authentication middleware 🔐
	io.use((socket, next) => {
		const token = socket.handshake.auth.token;



		if (!token) return next(new Error("Authentication Error"));

		try {
			const payload = verifyToken(token);
			socket.userId = payload.userId;
			next();
		} catch (err) {
			next(new Error("Invalid Token"));
		}
	});

	io.on("connection", async (socket) => {
		console.log("Socket connected for user: ", socket.userId);

		// register online user
		if (!onlineUsers.has(socket.userId)) {
			onlineUsers.set(socket.userId, new Set());
		}
		onlineUsers.get(socket.userId).add(socket.id);

		// join rooms for all existing conversations
		try {
			const sentTo = await Message.distinct("to", { from: socket.userId });
			const receivedFrom = await Message.distinct("from", { to: socket.userId });
			const chatPartners = [...new Set([...sentTo, ...receivedFrom])];

			chatPartners.forEach((partnerId) => {
				const roomId = getPrivateRoomId(socket.userId, partnerId);
				socket.join(roomId);
			});
		} catch (err) {
			console.error("Room join error:", err);
		}

		try {
			const undelivered = await Message.find({
				to: socket.userId,
				delivered: false,
			});

			for (const msg of undelivered) {
				const roomId = msg.roomId;

				io.to(roomId).emit("new_message", msg);

				msg.delivered = true;
				await msg.save();
			}
		} catch (err) {
			console.error("Undelivered sync error:", err);
		}

		socket.on("send_message", async ({ to, text }) => {
			try {
				const roomId = getPrivateRoomId(socket.userId, to);

				// ensure sender is in the room (handles new conversations)
				socket.join(roomId);

				// if recipient is online, add their sockets to the room too
				const recipientSockets = onlineUsers.get(to);
				if (recipientSockets) {
					for (const sid of recipientSockets) {
						const s = io.sockets.sockets.get(sid);
						if (s) s.join(roomId);
					}
				}

				const isOnline = onlineUsers.has(to);

				const message = await Message.create({
					roomId,
					from: socket.userId,
					to,
					text,
					delivered: isOnline,
				});

				io.to(roomId).emit("new_message", message);
			} catch (err) {
				console.error("send_message error:", err);
			}
		});

		socket.on("mark_read", async ({ from }) => {
			try {
				const roomId = getPrivateRoomId(socket.userId, from);

				const unreadMessages = await Message.find({
					roomId,
					to: socket.userId,
					read: false,
				});

				for (const msg of unreadMessages) {
					msg.read = true;
					await msg.save();

					io.to(roomId).emit("message_read", {
						_id: msg._id,
					});
				}
			} catch (err) {
				console.error("mark_read error:", err);
			}
		});

		socket.on("disconnect", () => {
			console.log("Disconnected: ", socket.userId);

			const userSockets = onlineUsers.get(socket.userId);
			if (userSockets) {
				userSockets.delete(socket.id);

				if (userSockets.size == 0) {
					onlineUsers.delete(socket.userId);
					console.log(`User ${socket.userId} is now offline😴`);
				}
			}
		});
	});
};
