# Push Notifications Added

This update adds **offline push notifications** using **Web Push + Service Worker** and **in-app (online) notifications** via Socket.io.

## Quick Start

1. Install deps (make sure `web-push` is installed; it's added to server code usage):
   ```bash
   npm install web-push
   ```

2. Generate VAPID keys and put them in `.env` (create it from `.env.example`):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Copy the **Public Key** and **Private Key** into `.env`:
   ```env
   VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
   VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
   VAPID_SUBJECT=mailto:you@example.com
   ```

3. Run your app:
   ```bash
   npm start
   ```

4. Open the site in a browser (Chrome recommended), **Allow notifications** when prompted.

## What was added

- `public/sw.js` — service worker to receive push and display notifications.
- `public/js/push.js` — client helper to register SW and subscribe to push.
- Server changes in `server.js`:
  - VAPID + `web-push` setup.
  - `subscription` field added to `User` model.
  - `POST /api/save-subscription` to store user's push subscription.
  - Sends a **push notification** to the receiver if they are **offline** when a new message arrives.

## How it works

- When a user logs in (or loads the app), the browser registers `sw.js` and subscribes to push using your VAPID public key.
- The subscription object is saved to your server via `/api/save-subscription` using the user's email.
- On `send_message`, if the receiver is **online**, they get real-time via Socket.io; if **offline**, the server sends a **Web Push**.

## Notes

- You **must** provide valid VAPID keys in `.env` or push will be disabled (a warning appears in server logs).
- If your app is served from a different origin or behind HTTPS, ensure SW scope and paths are correct.
- For file messages, notifications show "Sent a file: <name>".

