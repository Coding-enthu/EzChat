import { useState, useMemo } from "react";
import { getAvatarColor } from "../App";

function formatTime(dateStr) {
	const date = new Date(dateStr);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) {
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	}
	if (date.toDateString() === yesterday.toDateString()) {
		return "Yesterday";
	}
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDateGroup(dateStr) {
	const date = new Date(dateStr);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) return "Today";
	if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Conversations({
	conversations,
	selectedUser,
	onSelect,
	onMenuToggle,
	mobileShowChat,
}) {
	const [search, setSearch] = useState("");

	const { grouped, order } = useMemo(() => {
		const filtered = conversations.filter((conv) => {
			if (!search.trim()) return true;
			const q = search.trim().toLowerCase();
			const name = conv.user?.name?.toLowerCase() || "";
			const username = conv.user?.username?.toLowerCase() || "";
			return name.includes(q) || username.includes(q);
		});

		const groups = {};
		const groupOrder = [];

		for (const conv of filtered) {
			const group = getDateGroup(conv.lastMessage?.time || new Date());
			if (!groups[group]) {
				groups[group] = [];
				groupOrder.push(group);
			}
			groups[group].push(conv);
		}

		return { grouped: groups, order: groupOrder };
	}, [conversations, search]);

	const mobileClass =
		typeof mobileShowChat !== "undefined" && mobileShowChat
			? "hidden-mobile"
			: "";

	return (
		<section className={`glass-panel conversations-panel ${mobileClass}`}>
			<div className="conv-header">
				<div className="conv-title-row">
					<button
						className="menu-toggle-btn"
						onClick={onMenuToggle}
						title="Open menu"
					>
						☰
					</button>
					<span className="conv-title">Messages</span>
					<span style={{ width: 28 }} />
				</div>
			</div>

			<div className="search-bar">
				<span className="search-icon">🔍</span>
				<input
					className="search-input"
					type="text"
					placeholder="Search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<div className="conv-list">
				{conversations.length === 0 && (
					<div className="empty-conv-text">
						No conversations yet. Start a new chat!
					</div>
				)}

				{order.map((group) => (
					<div key={group}>
						<div className="date-separator">
							<span>{group}</span>
						</div>
						{grouped[group].map((conv) => {
							const user = conv.user;
							const displayName = user?.username
								? `@${user.username}`
								: `User ${conv.userId}`;
							const photoUrl = user?.photo || null;

							return (
								<button
									key={conv.userId}
									className={`conv-item ${selectedUser === conv.userId ? "selected" : ""}`}
									onClick={() =>
										onSelect(conv.userId, user)
									}
								>
									<div
										className="avatar"
										style={{
											background: photoUrl
												? "transparent"
												: getAvatarColor(conv.userId),
										}}
									>
										{photoUrl ? (
										<img
											className="avatar-img"
											src={photoUrl}
											alt={displayName}
										/>
									) : (
										(user?.name?.charAt(0) || "?").toUpperCase()
									)}
									</div>

									<div className="conv-item-body">
										<div className="conv-item-top">
											<span className="conv-item-name">
												{displayName}
											</span>
											<span className="conv-item-time">
												{formatTime(
													conv.lastMessage?.time ||
														new Date(),
												)}
											</span>
										</div>
										<div className="conv-item-bottom">
											<span className="conv-item-preview">
												{conv.lastMessage?.text || ""}
											</span>
											{conv.unread > 0 && (
												<span className="unread-badge">
													{conv.unread}
												</span>
											)}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				))}
			</div>
		</section>
	);
}

export default Conversations;
