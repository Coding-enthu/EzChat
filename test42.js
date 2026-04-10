const { io } = require("socket.io-client");

const token =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyLCJpYXQiOjE3NzA3Mjg2MDIsImV4cCI6MTc3MDgxNTAwMn0.hzJ_GsvxVSNUKv2t4X2BxjuHWVLO2hvzBVhTtGAXQRQ";

const socket = io("http://localhost:3000", {
	auth: { token: token },
});

socket.on("connect", () => {
	console.log("CONNECTED: ", socket.id);

	socket.emit("send_message", {
		to: 7,
		text: " from 42",
	});
});

socket.on("connect_error", (err) => {
	console.log("CONNECTION ERROR: ", socket.id);
});

socket.on("new_message", (msg) => {
	console.log("MESSAGE RECIEVED: ", msg);
});
