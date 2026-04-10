import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";

import Sidebar from "./components/Sidebar";
import Conversations from "./components/Conversations";
import ChatPanel from "./components/ChatPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
	// Auth state
	const [authMode, setAuthMode] = useState("login");
	const [token, setToken] = useState(null);
	const [currentUser, setCurrentUser] = useState(null);
	const [socket, setSocket] = useState(null);
	const [authError, setAuthError] = useState("");

	// Login fields
	const [loginEmail, setLoginEmail] = useState("");
	const [loginPassword, setLoginPassword] = useState("");

	// Register fields
	const [regEmail, setRegEmail] = useState("");
	const [regPassword, setRegPassword] = useState("");
	const [regUsername, setRegUsername] = useState("");
	const [regName, setRegName] = useState("");
	const [regPhoto, setRegPhoto] = useState(null);
	const [regPhotoPreview, setRegPhotoPreview] = useState(null);

	// Chat state
	const [conversations, setConversations] = useState([]);
	const [selectedUser, setSelectedUser] = useState(null);
	const [selectedUserInfo, setSelectedUserInfo] = useState(null);
	const [messages, setMessages] = useState([]);

	// UI state
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [mobileShowChat, setMobileShowChat] = useState(false);
	const [newChatOpen, setNewChatOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);

	// Profile edit state
	const [profileOpen, setProfileOpen] = useState(false);
	const [editName, setEditName] = useState("");
	const [editUsername, setEditUsername] = useState("");
	const [editPhoto, setEditPhoto] = useState(null);
	const [editPhotoPreview, setEditPhotoPreview] = useState(null);
	const [profileError, setProfileError] = useState("");
	const [profileSaving, setProfileSaving] = useState(false);

	// Refs for socket callbacks
	const selectedUserRef = useRef(null);
	const currentUserRef = useRef(null);

	useEffect(() => {
		selectedUserRef.current = selectedUser;
	}, [selectedUser]);

	useEffect(() => {
		currentUserRef.current = currentUser;
	}, [currentUser]);

	// ---------- LOGIN ----------
	const handleLogin = async () => {
		setAuthError("");
		if (!loginEmail || !loginPassword) {
			setAuthError("Please fill in all fields");
			return;
		}

		try {
			const res = await axios.post(`${API_URL}/login`, {
				email: loginEmail,
				password: loginPassword,
			});
			setToken(res.data.token);
			setCurrentUser(res.data.user);
		} catch (err) {
			setAuthError(
				err.response?.data?.error || "Login failed. Please try again.",
			);
		}
	};

	// ---------- REGISTER ----------
	const handleRegister = async () => {
		setAuthError("");
		if (!regEmail || !regPassword || !regUsername || !regName) {
			setAuthError("Please fill in all required fields");
			return;
		}

		try {
			const formData = new FormData();
			formData.append("email", regEmail);
			formData.append("password", regPassword);
			formData.append("username", regUsername);
			formData.append("name", regName);
			if (regPhoto) {
				formData.append("photo", regPhoto);
			}

			const res = await axios.post(`${API_URL}/register`, formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			setToken(res.data.token);
			setCurrentUser(res.data.user);
		} catch (err) {
			setAuthError(
				err.response?.data?.error ||
					"Registration failed. Please try again.",
			);
		}
	};

	// ---------- LOGOUT ----------
	const handleLogout = () => {
		if (socket) socket.disconnect();
		setToken(null);
		setCurrentUser(null);
		setSocket(null);
		setConversations([]);
		setMessages([]);
		setSelectedUser(null);
		setSelectedUserInfo(null);
		setLoginEmail("");
		setLoginPassword("");
		setAuthError("");
	};

	// ---------- PHOTO PREVIEW (Register) ----------
	const handlePhotoChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			setRegPhoto(file);
			const reader = new FileReader();
			reader.onload = (ev) => setRegPhotoPreview(ev.target.result);
			reader.readAsDataURL(file);
		}
	};

	// ---------- PROFILE EDIT ----------
	const handleOpenProfile = () => {
		setEditName(currentUser?.name || "");
		setEditUsername(currentUser?.username || "");
		setEditPhoto(null);
		setEditPhotoPreview(currentUser?.photo || null);
		setProfileError("");
		setProfileOpen(true);
		setSidebarOpen(false);
	};

	const handleEditPhotoChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			setEditPhoto(file);
			const reader = new FileReader();
			reader.onload = (ev) => setEditPhotoPreview(ev.target.result);
			reader.readAsDataURL(file);
		}
	};

	const handleSaveProfile = async () => {
		setProfileError("");
		setProfileSaving(true);
		try {
			const formData = new FormData();
			if (editName.trim()) formData.append("name", editName.trim());
			if (editUsername.trim())
				formData.append("username", editUsername.trim());
			if (editPhoto) formData.append("photo", editPhoto);

			const res = await axios.put(`${API_URL}/users/me`, formData, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "multipart/form-data",
				},
			});

			if (res.data.usernameChanged) {
				setProfileOpen(false);
				alert("Username changed successfully. Please log in again.");
				handleLogout();
			} else {
				setCurrentUser(res.data.user);
				setProfileOpen(false);
			}
		} catch (err) {
			setProfileError(
				err.response?.data?.error || "Failed to update profile",
			);
		} finally {
			setProfileSaving(false);
		}
	};

	// ---------- SOCKET ----------
	useEffect(() => {
		if (!token) return;

		const newSocket = io(API_URL, { auth: { token } });

		newSocket.on("connect", () => {
			console.log("Socket connected.");
		});

		newSocket.on("new_message", (msg) => {
			const sel = selectedUserRef.current;
			const me = currentUserRef.current;

			if (sel && (msg.from === sel || msg.to === sel)) {
				setMessages((prev) => {
					if (prev.some((m) => m._id === msg._id)) return prev;
					return [...prev, msg];
				});
			}

			updateConversationsWithMessage(msg, me?._id);

			// Fetch user info for new conversation partners (prevents showing raw ObjectId)
			const otherId = msg.from === me?._id ? msg.to : msg.from;
			axios
				.get(`${API_URL}/users/${otherId}`, {
					headers: { Authorization: `Bearer ${token}` },
				})
				.then((res) => {
					setConversations((prev) =>
						prev.map((c) =>
							c.userId === otherId && !c.user
								? { ...c, user: res.data }
								: c,
						),
					);
				})
				.catch(() => {});
		});

		newSocket.on("message_read", ({ _id }) => {
			setMessages((prev) =>
				prev.map((m) => (m._id === _id ? { ...m, read: true } : m)),
			);
		});

		setSocket(newSocket);

		return () => newSocket.disconnect();
	}, [token]);

	// ---------- FETCH CONVERSATIONS ----------
	const fetchConversations = useCallback(async () => {
		if (!token) return;
		try {
			const res = await axios.get(`${API_URL}/conversations`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setConversations(res.data);
		} catch (err) {
			console.error("Failed to fetch conversations:", err);
		}
	}, [token]);

	useEffect(() => {
		fetchConversations();
	}, [fetchConversations]);

	// ---------- FETCH MESSAGES ----------
	useEffect(() => {
		if (!selectedUser || !token) {
			setMessages([]);
			return;
		}

		const fetchMessages = async () => {
			try {
				const res = await axios.get(
					`${API_URL}/messages/${selectedUser}`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				setMessages(res.data);
			} catch (err) {
				console.error("Failed to fetch messages:", err);
			}
		};

		fetchMessages();

		if (socket) {
			socket.emit("mark_read", { from: selectedUser });
		}
	}, [selectedUser, token, socket]);

	// ---------- SEARCH USERS FOR NEW CHAT ----------
	useEffect(() => {
		if (!newChatOpen || !searchQuery.trim() || !token) {
			setSearchResults([]);
			return;
		}

		const timer = setTimeout(async () => {
			try {
				const res = await axios.get(
					`${API_URL}/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				setSearchResults(res.data);
			} catch (err) {
				console.error("Search failed:", err);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [searchQuery, newChatOpen, token]);

	// ---------- HELPERS ----------
	function updateConversationsWithMessage(msg, myId) {
		setConversations((prev) => {
			const otherId = msg.from === myId ? msg.to : msg.from;
			const exists = prev.find((c) => c.userId === otherId);

			if (exists) {
				return prev.map((c) => {
					if (c.userId === otherId) {
						return {
							...c,
							lastMessage: msg,
							unread:
								msg.from !== myId &&
								selectedUserRef.current !== otherId
									? c.unread + 1
									: c.unread,
						};
					}
					return c;
				});
			}

			return [
				{
					userId: otherId,
					user: null,
					lastMessage: msg,
					unread: msg.from !== myId ? 1 : 0,
				},
				...prev,
			];
		});
	}

	const handleSendMessage = (text) => {
		if (!socket || !selectedUser || !text.trim()) return;
		socket.emit("send_message", { to: selectedUser, text: text.trim() });
	};

	const handleSelectUser = (userId, userInfo) => {
		setSelectedUser(userId);
		setSelectedUserInfo(userInfo || null);
		setMobileShowChat(true);

		setConversations((prev) =>
			prev.map((c) =>
				c.userId === userId ? { ...c, unread: 0 } : c,
			),
		);
	};

	const handleBack = () => {
		setMobileShowChat(false);
	};

	const handleNewChat = () => {
		setNewChatOpen(true);
		setSearchQuery("");
		setSearchResults([]);
		setSidebarOpen(false);
	};

	const handleSearchSelect = (user) => {
		setNewChatOpen(false);
		setSearchQuery("");
		setSearchResults([]);
		handleSelectUser(user._id, user);
	};

	// ---------- RENDER: AUTH ----------
	if (!token) {
		return (
			<div className="login-container">
				<div className="login-card">
					<div className="login-logo">EzChat</div>
					<div className="login-subtitle">
						{authMode === "login"
							? "Sign in to continue"
							: "Create your account"}
					</div>

					<div className="auth-tabs">
						<button
							className={`auth-tab ${authMode === "login" ? "active" : ""}`}
							onClick={() => {
								setAuthMode("login");
								setAuthError("");
							}}
						>
							Login
						</button>
						<button
							className={`auth-tab ${authMode === "register" ? "active" : ""}`}
							onClick={() => {
								setAuthMode("register");
								setAuthError("");
							}}
						>
							Register
						</button>
					</div>

					{authError && (
						<div className="auth-error">{authError}</div>
					)}

					{authMode === "login" ? (
						<>
							<input
								className="login-input"
								type="email"
								placeholder="Email"
								value={loginEmail}
								onChange={(e) => setLoginEmail(e.target.value)}
								onKeyDown={(e) =>
									e.key === "Enter" && handleLogin()
								}
							/>
							<input
								className="login-input"
								type="password"
								placeholder="Password"
								value={loginPassword}
								onChange={(e) =>
									setLoginPassword(e.target.value)
								}
								onKeyDown={(e) =>
									e.key === "Enter" && handleLogin()
								}
							/>
							<button
								className="login-btn"
								onClick={handleLogin}
							>
								Login
							</button>
						</>
					) : (
						<>
							<div className="photo-upload">
								<label
									className="photo-upload-preview"
									htmlFor="photo-input"
								>
									{regPhotoPreview ? (
										<img
											src={regPhotoPreview}
											alt="Preview"
										/>
									) : (
										<span className="photo-upload-placeholder">
											📷
										</span>
									)}
								</label>
								<input
									id="photo-input"
									className="photo-upload-input"
									type="file"
									accept="image/*"
									onChange={handlePhotoChange}
								/>
								<span className="photo-upload-label">
									Profile photo (optional)
								</span>
							</div>
							<input
								className="login-input"
								type="text"
								placeholder="Full Name"
								value={regName}
								onChange={(e) => setRegName(e.target.value)}
							/>
							<input
								className="login-input"
								type="text"
								placeholder="Username"
								value={regUsername}
								onChange={(e) => setRegUsername(e.target.value)}
							/>
							<input
								className="login-input"
								type="email"
								placeholder="Email"
								value={regEmail}
								onChange={(e) => setRegEmail(e.target.value)}
							/>
							<input
								className="login-input"
								type="password"
								placeholder="Password"
								value={regPassword}
								onChange={(e) =>
									setRegPassword(e.target.value)
								}
								onKeyDown={(e) =>
									e.key === "Enter" && handleRegister()
								}
							/>
							<button
								className="login-btn"
								onClick={handleRegister}
							>
								Create Account
							</button>
						</>
					)}
				</div>
			</div>
		);
	}

	// ---------- RENDER: MAIN APP ----------
	return (
		<>
			<div className="app-layout">
				<Sidebar
					currentUser={currentUser}
					sidebarOpen={sidebarOpen}
					onClose={() => setSidebarOpen(false)}
					onNewChat={handleNewChat}
					onLogout={handleLogout}
					onOpenProfile={handleOpenProfile}
				/>

				<Conversations
					conversations={conversations}
					selectedUser={selectedUser}
					onSelect={handleSelectUser}
					onMenuToggle={() => setSidebarOpen(true)}
					mobileShowChat={mobileShowChat}
				/>

				<ChatPanel
					token={token}
					socket={socket}
					currentUser={currentUser}
					selectedUser={selectedUser}
					selectedUserInfo={selectedUserInfo}
					messages={messages}
					onSendMessage={handleSendMessage}
					onBack={handleBack}
					mobileShowChat={mobileShowChat}
				/>
			</div>

			{/* New Chat Modal — Username Search */}
			{newChatOpen && (
				<div
					className="modal-overlay"
					onClick={() => setNewChatOpen(false)}
				>
					<div
						className="modal-card"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-title">New Chat</div>
						<div className="modal-subtitle">
							Search for a user by username
						</div>
						<input
							className="login-input"
							type="text"
							placeholder="Search username..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							autoFocus
						/>

						<div className="search-results">
							{searchQuery.trim() &&
								searchResults.length === 0 && (
									<div className="search-empty">
										No users found
									</div>
								)}

							{searchResults.map((user) => (
								<button
									key={user._id}
									className="search-result-item"
									onClick={() => handleSearchSelect(user)}
								>
									<div
										className="avatar avatar-sm"
										style={{
											background: user.photo
												? "transparent"
												: getAvatarColor(user._id),
										}}
									>
										{user.photo ? (
											<img
												className="avatar-img"
												src={user.photo}
												alt={user.name}
											/>
										) : (
											user.name?.charAt(0).toUpperCase()
										)}
									</div>
									<div>
										<div className="search-result-name">
											@{user.username}
										</div>
										<div className="search-result-username">
											{user.name}
										</div>
									</div>
								</button>
							))}
						</div>

						<div className="modal-actions">
							<button
								className="modal-btn-secondary"
								onClick={() => setNewChatOpen(false)}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Profile Edit Modal */}
			{profileOpen && (
				<div
					className="modal-overlay"
					onClick={() => setProfileOpen(false)}
				>
					<div
						className="modal-card"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-title">Edit Profile</div>

						{profileError && (
							<div className="auth-error">{profileError}</div>
						)}

						<div className="photo-upload">
							<label
								className="photo-upload-preview"
								htmlFor="edit-photo-input"
								style={{ width: 80, height: 80 }}
							>
								{editPhotoPreview ? (
									<img
										src={editPhotoPreview}
										alt="Preview"
									/>
								) : (
									<span className="photo-upload-placeholder">
										📷
									</span>
								)}
							</label>
							<input
								id="edit-photo-input"
								className="photo-upload-input"
								type="file"
								accept="image/*"
								onChange={handleEditPhotoChange}
							/>
							<span className="photo-upload-label">
								Change photo
							</span>
						</div>

						<div className="profile-field-label">Name</div>
						<input
							className="login-input"
							type="text"
							placeholder="Full Name"
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
						/>

						<div className="profile-field-label">Username</div>
						<input
							className="login-input"
							type="text"
							placeholder="Username"
							value={editUsername}
							onChange={(e) => setEditUsername(e.target.value)}
						/>
						{editUsername.toLowerCase() !==
							currentUser?.username && (
							<div className="profile-warning">
								⚠️ Changing your username will require you to
								log in again.
							</div>
						)}

						<div className="modal-actions">
							<button
								className="modal-btn-secondary"
								onClick={() => setProfileOpen(false)}
							>
								Cancel
							</button>
							<button
								className="modal-btn-primary"
								onClick={handleSaveProfile}
								disabled={profileSaving}
							>
								{profileSaving ? "Saving..." : "Save"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

// Avatar color from string ID
const AVATAR_COLORS = [
	"#2dd4a0",
	"#3b82f6",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316",
];

function getAvatarColor(id) {
	let hash = 0;
	const str = String(id);
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export { API_URL, AVATAR_COLORS, getAvatarColor };
export default App;
