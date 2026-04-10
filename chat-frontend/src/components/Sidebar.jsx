import { getAvatarColor } from "../App";

function Sidebar({
	currentUser,
	onNewChat,
	onLogout,
	onOpenProfile,
	sidebarOpen,
	onClose,
}) {
	const photoUrl = currentUser?.photo || null;

	return (
		<>
			{sidebarOpen && (
				<div className="sidebar-overlay" onClick={onClose} />
			)}

			<aside
				className={`glass-panel sidebar ${sidebarOpen ? "open" : ""}`}
			>
				<div className="sidebar-header">
					<span className="sidebar-logo">EzChat</span>
					<button
						className="sidebar-collapse-btn"
						onClick={onClose}
						title="Close sidebar"
					>
						✕
					</button>
				</div>

				<button className="new-chat-btn" onClick={onNewChat}>
					<span>＋</span> New Chat
				</button>

				<div className="sidebar-section-label">Main Menu</div>

				<nav className="sidebar-nav">
					<button className="sidebar-nav-item active">
						<span className="sidebar-nav-icon">🏠</span>
						Home
					</button>
				</nav>

				<div className="sidebar-bottom">
					<div
						className="sidebar-user clickable"
						onClick={onOpenProfile}
						title="Edit profile"
					>
						<div
							className="avatar avatar-sm"
							style={{
								background: photoUrl
									? "transparent"
									: "#2dd4a0",
							}}
						>
							{photoUrl ? (
								<img
									className="avatar-img"
									src={photoUrl}
									alt={currentUser.name}
								/>
							) : (
								currentUser?.name?.charAt(0).toUpperCase() ||
								"?"
							)}
						</div>
						<div className="sidebar-user-info">
							<div className="sidebar-user-name">
								{currentUser?.name || "User"}
							</div>
							<div className="sidebar-user-username">
								@{currentUser?.username || "unknown"}
							</div>
						</div>
					</div>
					<button className="logout-btn" onClick={onLogout}>
						<span>🚪</span> Logout
					</button>
				</div>
			</aside>
		</>
	);
}

export default Sidebar;
