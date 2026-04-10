import { useEffect, useRef, useState, Fragment } from "react";
import { getAvatarColor } from "../App";

function formatTime(dateStr) {
	const date = new Date(dateStr);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatPanel({
	token,
	socket,
	currentUser,
	selectedUser,
	selectedUserInfo,
	messages,
	onSendMessage,
	onBack,
	mobileShowChat,
}) {
	const messagesEndRef = useRef(null);
	const inputRef = useRef(null);
	const [showUserInfo, setShowUserInfo] = useState(false);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		if (selectedUser && inputRef.current) {
			inputRef.current.focus();
		}
		setShowUserInfo(false);
	}, [selectedUser]);

	const handleSend = () => {
		const text = inputRef.current?.value?.trim();
		if (!text || !selectedUser) return;
		onSendMessage(text);
		inputRef.current.value = "";
	};

	const handleKeyDown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const mobileClass =
		typeof mobileShowChat !== "undefined" && !mobileShowChat
			? "hidden-mobile"
			: "";

	if (!selectedUser) {
		return (
			<section className={`glass-panel chat-panel ${mobileClass}`}>
				<div className="empty-state">
					<div className="empty-state-icon">💬</div>
					<div className="empty-state-title">Welcome to EzChat</div>
					<div className="empty-state-text">
						Select a conversation or start a new chat to begin
						messaging.
					</div>
				</div>
			</section>
		);
	}

	const displayName = selectedUserInfo?.username
		? `@${selectedUserInfo.username}`
		: `User ${selectedUser}`;
	const displaySubtext = selectedUserInfo?.name || "";
	const photoUrl = selectedUserInfo?.photo || null;

	return (
		<section className={`glass-panel chat-panel ${mobileClass}`}>
			{/* Chat Header */}
			<div className="chat-header">
				<button
					className="chat-back-btn"
					onClick={onBack}
					title="Back to conversations"
				>
					←
				</button>

				<div
					className="chat-header-clickable"
					onClick={() => setShowUserInfo(!showUserInfo)}
					title="View contact info"
				>
					<div
						className="avatar"
						style={{
							background: photoUrl
								? "transparent"
								: getAvatarColor(selectedUser),
						}}
					>
						{photoUrl ? (
							<img
								className="avatar-img"
								src={photoUrl}
								alt={displayName}
							/>
						) : (
							(
								selectedUserInfo?.name?.charAt(0) || "?"
							).toUpperCase()
						)}
					</div>

					<div className="chat-header-info">
						<div className="chat-header-name">{displayName}</div>
						<div className="chat-header-status">
							{displaySubtext}
						</div>
					</div>
				</div>
			</div>

			{/* Messages */}
			<div className="messages-area">
				{messages.length === 0 && (
					<div className="empty-state">
						<div className="empty-state-text">
							No messages yet. Say hello! 👋
						</div>
					</div>
				)}

				{messages.map((msg, i) => {
					const isSent = msg.from === currentUser?._id;
					const showDateDivider =
						i === 0 ||
						new Date(msg.time).toDateString() !==
							new Date(messages[i - 1].time).toDateString();

					return (
						<Fragment key={msg._id || i}>
							{showDateDivider && (
								<div className="msg-date-divider">
									<span>
										{formatDateLabel(msg.time)}
									</span>
								</div>
							)}
							<div
								className={`message-row ${isSent ? "sent" : "received"}`}
							>
								<div className="message-bubble">
									<div>{msg.text}</div>
									<div className="message-meta">
										<span className="message-time">
											{formatTime(msg.time)}
										</span>
										{isSent && (
											<span
												className={`message-read-indicator ${msg.read ? "read" : ""}`}
											>
												{msg.read ? "✓✓" : "✓"}
											</span>
										)}
									</div>
								</div>
							</div>
						</Fragment>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			{/* User Info Drawer */}
			{showUserInfo && (
				<>
					<div
						className="user-info-backdrop"
						onClick={() => setShowUserInfo(false)}
					/>
					<div className="user-info-drawer">
						<button
							className="user-info-close"
							onClick={() => setShowUserInfo(false)}
						>
							✕
						</button>

						<div
							className="user-info-avatar"
							style={{
								background: photoUrl
									? "transparent"
									: getAvatarColor(selectedUser),
							}}
						>
							{photoUrl ? (
								<img
									className="avatar-img"
									src={photoUrl}
									alt={displayName}
								/>
							) : (
								(
									selectedUserInfo?.name?.charAt(0) || "?"
								).toUpperCase()
							)}
						</div>

						<div className="user-info-username">
							{displayName}
						</div>
						<div className="user-info-name">
							{selectedUserInfo?.name || ""}
						</div>

						{selectedUserInfo?.email && (
							<div className="user-info-detail">
								<span className="user-info-label">Email</span>
								<span className="user-info-value">
									{selectedUserInfo.email}
								</span>
							</div>
						)}
					</div>
				</>
			)}

			{/* Input */}
			<div className="message-input-area">
				<div className="message-input-wrapper">
					<input
						ref={inputRef}
						className="message-input"
						type="text"
						placeholder="Type here..."
						onKeyDown={handleKeyDown}
					/>
					<button
						className="send-btn"
						onClick={handleSend}
						title="Send message"
					>
						➤
					</button>
				</div>
			</div>
		</section>
	);
}

function formatDateLabel(dateStr) {
	const date = new Date(dateStr);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) return "Today";
	if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default ChatPanel;
