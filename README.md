💬 Real-Time Chat App

A fully-responsive real-time chat application built with Node.js, Socket.IO, and MongoDB Atlas, featuring secure authentication, notifications, dark mode, and a modern UI.

🚀 Tech Stack
Layer	Technology
Frontend	HTML, CSS, JavaScript
Backend	Node.js, Express.js
Real-Time Communication	Socket.IO
Database	MongoDB Atlas (Mongoose ORM)
Authentication	JWT + bcryptjs
Notifications	Browser + In-app Alerts
📂 Project Structure
Chat-app/
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── responsive.css
│   └── js/
│       ├── app.js
│       ├── chat.js
│       ├── notification.js
│       └── utils.js
├── server.js
├── package.json
└── README.md

✅ Core Features
🔐 Authentication

Secure JWT Login + Registration

Password hashing with bcryptjs

Auto-signin using localStorage

💬 Real-Time Messaging

Instant delivery using Socket.IO

Typing indicators

Online/Offline status

Chat history stored in MongoDB

Read receipt support

🎨 UI & UX

Clean and modern chat UI

Fully responsive (mobile + desktop)

Smooth transitions & animations

Dark Mode toggle

Media Grid view for attachments

🔔 Notifications

Browser push notifications

In-app toast messages

Optional sound alerts

⚙️ Setup & Installation
Prerequisites

✅ Node.js Installed
✅ MongoDB Atlas Account (Free Tier works)

1️⃣ Clone the Repo
git clone https://github.com/<your-username>/chat-app.git
cd chat-app

2️⃣ Install Dependencies
npm install

3️⃣ Configure MongoDB

Edit server.js and update:

const MONGODB_URI = "YOUR_MONGODB_ATLAS_CONNECTION_URL";


Tip: Prefer using an .env file for production.

4️⃣ Start the Server
npm start


or

node server.js

5️⃣ Open in Browser
http://localhost:3000

🧪 Testing the App

✔ Register/Login new accounts
✔ Use multi-tab or multi-device for real-time test
✔ Click different contacts to load chat history
✔ Test dark mode + notifications + emojis
✔ File upload UI (extends later)

🔒 Security Notes

✅ Passwords hashed using bcryptjs
✅ JWT expiration applied
✅ CORS enabled
❌ Do NOT commit real MongoDB credentials to GitHub

📌 Roadmap (Upcoming Enhancements)
Feature	Status
File sharing: images, PDFs, videos	In progress
Delete for everyone + undo message	✅ Completed
Cloud file storage (Cloudinary)	Planned
Last message preview in sidebar	✅ Added
User search + chat search	Planned
🛠️ Scripts
npm install express socket.io mongoose bcryptjs jsonwebtoken cors #install dependencies 
npm start     # run production server

🤝 Contribution

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to improve.

📜 License

This project is licensed under the MIT License.

👤 Developer

Riya Gupta
📍 India