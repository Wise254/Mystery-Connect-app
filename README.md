Mystery Connect 🎭

> **Where conversations reveal more than profiles**

Mystery Connect is an anonymous chat application where users connect based on conversation quality rather than photos or surface-level profiles. Personal details are revealed gradually as chats deepen — putting mystery, personality, and meaningful conversation first.

Overview

Mystery Connect flips the traditional social/dating app model on its head. Instead of browsing photos and bios, you're matched with strangers and given a **time-limited chat**. As you exchange messages, new details about your partner unlock at milestones — starting with just an avatar emoji and gradually revealing gender, country, real name, and more.

The project is currently a **frontend-first prototype** (HTML/CSS/JS) backed by a planned Node.js/Express API.

Features

Authentication
- **Sign up / Login** with a tabbed single-page interface
- **Age verification** (18+) via a date-of-birth picker with automatic age calculation
- **Password strength meter** with live feedback (weak / medium / strong)
- **Confirm-password matching** with instant validation
- **Avatar selection** from a set of animal emojis (🦊 🐼 🦉 🐱 🐯 🦁 🐰 🐻)
- **Two security questions** for account recovery
- **One-time recovery code** generated on signup (shown in a modal — displayed only once)
- **Forgot password flow** — recover via security answer *or* recovery code

Profile Completion
- **Hidden personal info** (real name, country, gender) that unlocks progressively in chats
- **Interest picker** (choose up to 5 from 35 categories) used for matchmaking
- **Bio** (up to 500 characters) with live character counter
- **Chat style** and **"looking for"** preferences
- **Free-form conversation topics** (comma-separated)
- **+10 points** reward for completing your profile
- Avatar customization
Dashboard
- Welcome view with the user's avatar, level badge, and points
- **Quick Chat** — short time-limited anonymous sessions
- **Deep Chat** — longer, milestone-based conversations
- **Explore** — browse explorers (planned/partially implemented)
- Stats cards for tracking activity
- Responsive, glassmorphic UI with animated gradient accents

UX / Mobile
- Fully **mobile-optimized** — safe-area insets for notched phones, 44px touch targets, sticky input bars
- **Password strength** and **match indicators**
- **Error shake animations**, loading spinners, and toast-style notifications
- Dark theme with purple/gold gradient branding

Project Structure

```
mystery-connect/
├── auth.html                 # Login + Signup page
├── complete-profile.html     # Post-signup profile setup
├── dashboard.html            # Main dashboard
├── css/
│   ├── auth.css              # Auth page styles
│   ├── mobile-optimized.css  # Global mobile/responsive overrides
│   └── profile.css           # Profile page styles
├── js/                       # (planned) shared scripts
│   └── ...
└── README.md
```

> Additional pages referenced by the app but not yet included in this repo: `quick-chat.html`, `deep-chat.html`, `persistent-chat.html`, `explore.html`, `profile.html`.

Getting Started
Prerequisites
- A modern browser (Chrome, Firefox, Edge, Safari)
- **Node.js + npm** — only needed if you're running the backend API
- A simple static server (or just open `auth.html` directly for UI testing)

1. Clone the repository
```bash
git clone https://github.com/Wise254/Mystery-Connect-app.git
cd Mystery-Connect-app
```

### 2. Run the frontend
Because the app makes API calls to `http://localhost:3000`, you'll want a **backend running** (see below). To preview the UI alone, you can serve the folder statically:

```bash
# Option A — Python
python3 -m http.server 8080

# Option B — Node (npx)
npx serve .
```
Then open `http://localhost:8080/auth.html`.

### 3. Run the backend (required for login/signup)
The frontend expects a REST API at `http://localhost:3000` with the following endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account (returns `recoveryCode`) |
| `POST` | `/api/auth/login` | Authenticate, returns JWT + user |
| `GET`  | `/api/auth/verify` | Validate JWT on page load |
| `POST` | `/api/auth/profile/complete` | Save profile data |
| `POST` | `/api/auth/forgot-password` | Look up security question |
| `POST` | `/api/auth/reset-password` | Reset password via answer/recovery code |

A minimal Express server example:
```bash
npm init -y
npm install express cors jsonwebtoken bcrypt
node server.js
```

> 💡 The backend is **not included** in this repo yet — it's the next milestone. Without it, the UI will show *"Network error. Is the server running?"*
Security Notes

- Passwords and recovery codes **must be hashed server-side** (bcrypt/argon2) — never stored in plain text.
- JWTs should be signed with a strong secret and have a reasonable expiry.
- The recovery code is **one-time use** and shown only once at signup.
- CORS must allow `http://localhost:3000` (or your frontend origin) during development.

> ⚠️ **Current limitation:** `localStorage` is used to persist the session token. For production, prefer **httpOnly cookies** to protect against XSS.
Roadmap

- [ ] Implement Express/Node backend + database (MongoDB or PostgreSQL)
- [ ] Real-time chat via WebSockets (Socket.IO)
- [ ] Matchmaking algorithm using interests, chat style, and topics
- [ ] Gradual profile-reveal milestones (5 / 10 / 30+ messages)
- [ ] Points, levels, and badges system
- [ ] Explore page — browse and interact with other users
- [ ] Conversation timeline / heat-map
- [ ] Email verification and password reset emails
- [ ] Rate limiting and abuse protection
- [ ] Replace `localStorage` token with httpOnly cookies

Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Styling | Custom CSS, glassmorphism, CSS animations |
| Icons | Font Awesome 6.4 |
| Backend *(planned)* | Node.js, Express |
| Auth *(planned)* | JWT, bcrypt |
| Realtime *(planned)* | Socket.IO |

Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please keep the existing mobile-first, dark-theme design language consistent when adding UI.
License
This project is currently **unlicensed**. Add a `LICENSE` file (MIT is a good default) before distributing or accepting contributions publicly.
👤 Author
Wise254
- GitHub: [@Wise254](https://github.com/Wise254)
- Repo: [Mystery-Connect-app](https://github.com/Wise254/Mystery-Connect-app)

Acknowledgements
- Font Awesome for icons
- Inspiration from anonymous chat apps that prioritize conversation over appearance

---

**Built with curiosity, mystery, and a lot of purple gradients.** 💜
