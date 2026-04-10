const jwt = require("jsonwebtoken");

const signToken = (userId) => {
	return jwt.sign(
        { userId }, 
        process.env.JWT_SECRET,
		{expiresIn: "1d"}
    );
};

const verifyToken = (token) => {
	return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { signToken, verifyToken };
