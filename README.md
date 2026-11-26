# Real-Time Chat & Team Collaboration App

A college project MVP for real-time team communication and collaboration, built with **React 18 + Vite**, **Node.js + Express**, and **Socket.IO**.

---

## 🚀 Key Features

- **Authentication & Security**:
  - User registration and login.
  - Password hashing with `bcryptjs`.
  - Stateless session authorization with `jsonwebtoken` (JWT).
  - Server-side conversation membership authorization.
  - Ownership enforcement: users may edit or delete **only their own messages**.
- **Real-Time Communication (Socket.IO)**:
  - Authenticated WebSocket handshakes with JWT.
  - Live conversation rooms for instant message delivery without polling.
  - Real-time online/offline presence tracking across browser sessions.
  - Dynamic live typing indicators with debounced timeouts.
  - Real-time unread message counters updated dynamically across clients.
- **Messaging & Channels**:
  - One-to-one direct conversations.
  - Group collaboration channels with member management (add/remove members, admin roles).
  - Message editing with `(edited)` indicator tags.
  - Message deletion with placeholder tombstones.
- **Persistent Storage**:
  - MongoDB/Mongoose stores users, conversations, messages, unread counts, and read receipts.
  - Message history loads in cursor-based pages (30 messages by default; maximum 100).
  - Configure `MONGODB_URI` in `backend/.env` (see `backend/.env.example`). MongoDB must be available before starting the backend.

---

## 📁 Project Structure

```
Chat app/
├── backend/
│   ├── .env.example
│   ├── .env
│   ├── package.json
│   └── src/
│       ├── config/              # Environment & JWT configuration
│       ├── controllers/         # Auth, User, Conversation & Message controllers
│       ├── middleware/          # JWT auth & Socket.IO auth middleware
│       ├── repositories/        # Data access layer (User, Conv, Message)
│       ├── routes/              # Express API routers
│       ├── sockets/             # Socket.IO connection & event handlers
│       ├── storage/             # Seed hooks and persistent JSON compatibility data
│       └── server.js            # Express app + HTTP server + Socket.IO boot
├── frontend/
│   ├── .env.example
│   ├── .env
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/                 # Fetch client with auto JWT injection
│       ├── components/
│       │   ├── auth/            # Sign in / Register screen
│       │   ├── chat/            # ChatArea, MessageBubble, TypingIndicator
│       │   ├── layout/          # Navbar, user chip, connection status
│       │   ├── modals/          # NewChatModal, NewGroupModal, GroupDetailsModal, EditMessageModal
│       │   └── sidebar/         # Search, filters, conversation list, unread badges
│       ├── context/             # AuthContext, SocketContext, ChatContext
│       ├── index.css            # Responsive styles and design system
│       ├── App.jsx              # Main responsive workspace
│       └── main.jsx             # React 18 root
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Prerequisites

- **Node.js**: v18+ (tested on Node.js `v24.4.0`)
- **npm**: v9+ (tested on npm `11.4.2`)
- **MongoDB**: A running local or remote MongoDB instance.

---

## ⚙️ Setup & Installation

### Option 1: Root Convenient Script

```bash
# In the project root:
npm run install:all
```

### Option 2: Individual Folders

```bash
# Terminal 1 - Backend:
cd backend
npm install

# Terminal 2 - Frontend:
cd frontend
npm install
```

---

## 🏃 Running the Application

### 1. Start the Backend Server

Before starting the backend, create `backend/.env` from `backend/.env.example` and set `MONGODB_URI` to your MongoDB instance. Ensure MongoDB is running.

```bash
cd backend
npm start
```

_Backend will start on port `5000` (`http://localhost:5000`). Data is stored in MongoDB; no demo accounts are seeded automatically._

### 2. Start the Frontend Dev Server

Open a second terminal window:

```bash
cd frontend
npm run dev
```

_Frontend will start on `http://localhost:5173`._

### Quick Links

- [Open the chat application](http://localhost:5173)
- [Check backend health](http://localhost:5000/api/health)

---

## 👥 Creating Test Accounts

Register at least two accounts through the sign-in screen. Use one browser window for the first account and a private/incognito window for the second account.

## 🧪 Evaluation Test Walkthrough

1. **Test 1-on-1 Real-Time Chat & Presence**:
   - Register two accounts, for example `Account A` and `Account B`.
   - Open Chrome at `http://localhost:5173` and log in with Account A.
   - Open an Incognito window at `http://localhost:5173` and log in with Account B.
   - Confirm that both users show an online presence indicator.
   - Create a direct chat and send a message from Account A; it should arrive instantly in Account B's window.
   - Start typing in one window and verify that the other window shows the typing indicator.
2. **Test Unread Counters**:
   - Send a message to a chat or group that the recipient currently has closed.
   - Notice the unread count badge increment for the recipient.
   - When the recipient selects the conversation, the unread count resets to zero.
3. **Test Message Editing & Deletion**:
   - Hover over your own sent message. Click the `⋮` action menu.
   - Select **Edit**: change the text and save. Notice the message updates on both screens with an `(edited)` tag.
   - Select **Delete**: confirm deletion. Notice the text changes to _"This message was deleted"_ on both screens.
   - Try to edit someone else's message: the option is not available, and any direct API attempt is rejected with HTTP 403.
4. **Test Group Channels & Member Management**:
   - Click **"New Group"** in the top bar.
   - Enter a name (e.g. _"Frontend Engineers"_) and select members.
   - Open **"Group Info"** to add members, change group title, or leave the channel.

---

## 📡 REST API Reference

| Method   | Endpoint                                 | Description                                  | Auth Required |
| :------- | :--------------------------------------- | :------------------------------------------- | :------------ |
| `POST`   | `/api/auth/register`                     | Register new user                            | No            |
| `POST`   | `/api/auth/login`                        | Log in and receive JWT                       | No            |
| `GET`    | `/api/auth/me`                           | Fetch authenticated user profile             | Yes           |
| `GET`    | `/api/users`                             | List/search registered users (`?q=`)         | Yes           |
| `GET`    | `/api/conversations`                     | List user's conversations with unread counts | Yes           |
| `POST`   | `/api/conversations/direct`              | Create/retrieve 1-on-1 direct conversation   | Yes           |
| `POST`   | `/api/conversations/group`               | Create new group conversation                | Yes           |
| `GET`    | `/api/conversations/:id`                 | Fetch conversation details & participants    | Yes           |
| `PUT`    | `/api/conversations/:id`                 | Update group name/description                | Yes           |
| `POST`   | `/api/conversations/:id/members`         | Add member to group                          | Yes           |
| `DELETE` | `/api/conversations/:id/members/:userId` | Remove member or leave group                 | Yes           |
| `POST`   | `/api/conversations/:id/read`            | Mark conversation as read                    | Yes           |
| `GET`    | `/api/conversations/:id/messages`        | Get message history                          | Yes           |
| `POST`   | `/api/conversations/:id/messages`        | Send message to conversation                 | Yes           |
| `PUT`    | `/api/messages/:id`                      | Edit own message                             | Yes           |
| `DELETE` | `/api/messages/:id`                      | Delete own message                           | Yes           |

---

## 🔐 Account security

Signed-in users can change their password from the profile dialog. The backend verifies the current password and stores only the bcrypt hash of the new password.
The controllers, routes, Socket.IO handlers, and frontend require zero modifications.

---

## 🗄️ Database (MongoDB + Mongoose)

All data is persisted in MongoDB via Mongoose ODM. The data layer consists of:

| Model          | Collection      | Description                                       |
| :------------- | :-------------- | :------------------------------------------------ |
| `User`         | `users`         | Registered user accounts                          |
| `Conversation` | `conversations` | Direct and group chat conversations               |
| `Message`      | `messages`      | Chat messages with read receipts and reactions    |
| `UnreadCount`  | `unreadcounts`  | Per-user unread message counters per conversation |

**Connection**: Configure `MONGODB_URI` in `backend/.env` (defaults to `mongodb://127.0.0.1:27017/chat_collaboration`).

The controllers, routes, Socket.IO handlers, and frontend interact with the repository interfaces (`userRepository`, `conversationRepository`, `messageRepository`). These repositories provide the data access layer using Mongoose.
