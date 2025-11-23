# Shunya - AI Platform with MongoDB Integration

## Project Structure

```
Shunya/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api.ts    # API client for backend
│   │   └── ...
│   ├── .env
│   └── package.json
├── server/            # Express + MongoDB backend
│   ├── index.js       # Server entry point
│   ├── .env
│   └── package.json
└── package.json       # Root orchestration
```

## Setup

### 1. Install Dependencies

From the root directory:

```bash
# Install root dependencies
pnpm install

# Install frontend dependencies
cd frontend
pnpm install

# Install server dependencies
cd ../server
pnpm install
cd ..
```

Or use the helper script:

```bash
pnpm run install:all
```

### 2. Environment Variables

**Frontend** (`frontend/.env`):
```env
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_API_URL=http://localhost:5000
GROQ_API_KEY=your_groq_key
```

**Server** (`server/.env`):
```env
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:8080
PORT=5000
```

## Development

### Run Both Frontend and Backend

From the root directory:

```bash
pnpm run dev
```

This will start:
- Frontend on `http://localhost:8080` (Vite dev server)
- Backend API on `http://localhost:5000`

### Run Individually

**Frontend only:**
```bash
pnpm run dev:client
```

**Backend only:**
```bash
pnpm run dev:server
```

## API Endpoints

### Save User Settings
```
POST /api/settings
Body: {
  "userId": "string",
  "apiSettings": {
    "provider": "openai" | "gemini" | "groq",
    "model": "string",
    "apiKey": "string"
  }
}
```

### Get User Settings
```
GET /api/settings/:userId
```

### Health Check
```
GET /api/health
```

## Features

- ✅ **Live Code Preview & Execution** - Run generated code directly in the browser
- ✅ **Interactive Code Editor** - Edit and preview code in real-time with Sandpack
- ✅ **Multi-Framework Support** - React, Next.js, Vue, Vanilla JS, and more
- ✅ **Download Projects** - Export generated code as ZIP files
- ✅ MongoDB user settings persistence
- ✅ API provider configuration (OpenAI, Gemini, Groq)
- ✅ Secure backend API with CORS
- ✅ Auto-generated user IDs (can be replaced with Firebase auth)
- ✅ Real-time toast notifications
- ✅ Dropdown collision detection
- ✅ Responsive UI with glassmorphism design
- ✅ Chat history management
- ✅ File tree visualization

## What's New

### Live Preview Feature 🎉

Shunya now supports **live code preview** similar to Lovable, v0, and other vibe coding tools:

- **In-Browser Execution**: Generated code runs directly in the browser using Sandpack
- **Split View**: View code and preview side-by-side
- **Console Output**: Debug with integrated console
- **File Explorer**: Navigate through generated files
- **Download**: Export projects as ready-to-use ZIP files
- **Multi-Tab Interface**: Switch between Live Preview, Structure, and Raw Code views

See [LIVE_PREVIEW_DOCS.md](./LIVE_PREVIEW_DOCS.md) for detailed documentation.

## Build

### Frontend Production Build
```bash
pnpm run build
```

### Preview Production Build
```bash
pnpm run preview
```

## MongoDB Schema

### UserSettings Collection
```javascript
{
  userId: String (unique, indexed),
  apiSettings: {
    provider: String (enum: ['openai', 'gemini', 'groq']),
    model: String,
    apiKey: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Sonner (toast notifications)
- Firebase (optional auth)

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- CORS
- dotenv

## Notes

- User settings are now saved to MongoDB instead of localStorage
- Each user gets a unique ID stored in localStorage (can be replaced with Firebase auth UID)
- API keys are encrypted in transit but stored in plain text in MongoDB (consider adding encryption at rest for production)
- The backend validates all incoming data before saving
