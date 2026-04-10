const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	email: {
		type: String,
		unique: true,
		required: true,
		lowercase: true,
		trim: true,
	},
	password: {
		type: String,
		required: true,
	},
	username: {
		type: String,
		unique: true,
		required: true,
		lowercase: true,
		trim: true,
	},
	name: {
		type: String,
		required: true,
		trim: true,
	},
	photo: {
		type: String,
		default: "",
	},
});

userSchema.index({ username: 1 });

module.exports = mongoose.model("User", userSchema);
