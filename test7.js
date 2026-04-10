const { io } = require("socket.io-client");

const token =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjcsImlhdCI6MTc3MDY0ODUwNSwiZXhwIjoxNzcwNzM0OTA1fQ.Ce0Gzia6iOIiBqm55RI7bHZ1fJpvaJJ5-TjIJ5cUU60";

const socket = io("http://localhost:3000", {
	auth: { token: token },
});

socket.on("connect", () => {
	console.log("CONNECTED: ", socket.id);
});

socket.on("connect_error", (err) => {
	console.log("CONNECTION ERROR: ", socket.id);
});

socket.on("new_message", (msg) => {
	console.log("MESSAGE RECIEVED: ", msg);
});
