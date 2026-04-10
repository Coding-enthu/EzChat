const getPrivateRoomId = (userA, userB) => {
	const [min, max] = [String(userA), String(userB)].sort();
	return `chat:${min}:${max}`;
};

module.exports = { getPrivateRoomId };
