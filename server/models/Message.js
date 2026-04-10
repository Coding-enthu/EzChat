const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
	roomId: String,
	from: String,
	to: String,
	text: String,
	time: {
		type: Date,
		default: Date.now,
	},
	delivered: {
		type: Boolean,
		default: false,
	},
	read: {
		type: Boolean,
		default: false,
	},
});

messageSchema.index({ roomId: 1, time: 1 });
messageSchema.index({ to: 1, delivered: 1 });
messageSchema.index({ to: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
