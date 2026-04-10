const mongoose = require("mongoose");

const connectDB = async () => {
	await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp");
	console.log("MongoDB connected📈");
};

module.exports = connectDB;
