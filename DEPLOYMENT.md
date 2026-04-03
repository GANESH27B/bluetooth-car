# 🚀 Professional Deployment Guide

Your RC Car Dashboard is built with **Vite + React**, making it easy to deploy on modern edge platforms.

## Option 1: Vercel (Recommended)
1.  **Login to Vercel**: Go to [vercel.com](https://vercel.com).
2.  **New Project**: Select your `pro_car_dashboard` folder.
3.  **Deploy**: Vercel will automatically build the React app and give you a public URL (e.g., `cyber-drive.vercel.app`).
4.  **Usage**: Open this URL on your phone anytime. Use the **Settings Cog (Disconnected Badge)** to enter your car's local IP address (usually `192.168.4.1`).

## Option 2: Netlify
1.  Drag and drop the `dist/` folder (after running `npm run build`) into Netlify's "Sites" dashboard.
2.  Your app is now live with a secure HTTPS URL.

## Option 3: Local "Development" Access
If you want to test on your local network without deploying to the cloud:
1.  Run `npm run dev -- --host` in the `pro_car_dashboard` directory.
2.  Vite will provide a URL like `http://192.168.1.XX:5173`.
3.  Type this URL into your phone's browser.

---

## 📱 Mobile "Native" Installation (PWA Tip)
To make your dashboard feel like a real app:
1.  Open the deployed URL on your phone (Safari for iOS, Chrome for Android).
2.  Tap the **Share** button (iOS) or **Three Dots** (Android).
3.  Select **"Add to Home Screen"**.
4.  Launch the app from your home screen. It will now run in **Full Screen** without browser address bars!

---

## ⚠️ Security Note
Browsers often block "Mixed Content" (accessing HTTP from HTTPS).
- **If your deployed site is HTTPS** (standard for Vercel/Netlify), it may block WebSocket calls to a plain IP like `192.168.4.1`.
- **Solution**: Open the dashboard using `http://` instead of `https://` if available, or use the local Vite `--host` method for the best reliability.
