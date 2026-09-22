# 🧠 AccessAI Brain: Codebase & Architecture Guide

Welcome to the **AccessAI** developer manual and AI context file. This document provides a complete guide to the architecture, directory structure, core modules, state management, API routes, and accessibility patterns implemented in the project.

---

## 📌 Project Overview
**AccessAI** is an adaptive, accessibility-first e-learning platform. It dynamically changes its user experience, interactions, inputs, and output channels based on the user's registered disability profile:
1. **Deaf Mode**: Visual-first UI with Persistent Captions, custom flash notifications, and text filters.
2. **Blind Mode**: Screen-reader friendly architecture, automated Text-to-Speech (TTS) narration on element focus, and voice commands (Speech-to-Text).
3. **Motor Mode**: Designed for physical/motor control interfaces. Includes dwell-click functionality (hover auto-clicks), switch scan button cycling, and oversized navigation controls.

The stack comprises a **React Frontend** communicating with a **Flask Backend** that persists data in **Firestore** and handles user authentication with **Firebase Authentication**.

---

## 📂 Codebase Layout

```directory
DBM/
├── accessai-frontend/               # React Web Application
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── CaptionBar.jsx       # Persistent captions panel at screen bottom
│   │   │   ├── CourseCard.jsx       # Individual course tile UI component
│   │   │   ├── CoursePlayer.jsx     # Course content visual/accessibility player
│   │   │   ├── ProgressBar.jsx      # Generic visual progress indicator
│   │   │   └── VoiceCommand.jsx     # [Empty] Dedicated container for voice handlers
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Authentication wrapper and profile retriever
│   │   ├── hooks/
│   │   │   └── useVoice.js          # [Empty] Reserved for reusable speech hooks
│   │   ├── pages/
│   │   │   ├── Landing.jsx          # Initial routing/onboarding portal
│   │   │   ├── Login.jsx            # Multi-mode adaptive auth page
│   │   │   ├── DeafDashboard.jsx    # Dashboard for hearing-impaired users
│   │   │   ├── BlindDashboard.jsx   # Voice-controlled & audio dashboard
│   │   │   └── MotorDashboard.jsx   # Dwell-click and switch scan dashboard
│   │   ├── services/
│   │   │   ├── api.js               # Axios instance with request token-interceptors
│   │   │   └── firebase.js          # Firebase Client configuration and instance export
│   │   ├── App.jsx                  # Main routing configuration & Route guards
│   │   ├── index.css                # Global styling resets & base themes
│   │   └── index.js                 # Frontend application entry point
│   ├── package.json                 # Node package metadata & scripts
│   └── tailwind.config.js           # Tailwind utility customization definitions
│
└── backend/                         # Flask REST API Server
    ├── database/
    │   └── db.py                    # [Empty] Local database connector stub
    ├── middleware/
    │   ├── auth_middleware.py       # token_required decorator for Firebase JWTs
    │   └── validators.py            # Schemas validation for registration, login, courses, progress
    ├── routes/
    │   ├── auth.py                  # User registration and token-login verification
    │   ├── courses.py               # Public course listings & protected course additions
    │   ├── progress.py              # User course progress tracking (percent complete)
    │   └── users.py                 # Protected profile retrieval, updating, and account deletion
    ├── services/
    │   └── mode_collections.py      # Firestore mode-based collections & migration logic
    ├── app.py                       # REST application entry point & error handlers
    ├── firebase_config.py           # Firebase Admin SDK credentials and Firestore client init
    ├── requirements.txt             # Python environment dependencies
    ├── serviceAccountKey.json       # Private JSON key for Firebase Admin operations
    └── vercel.json                  # Vercel Serverless configuration for backend deployment
```

---

## 🔌 API Route Architecture
All protected backend endpoints expect an authorization header:
`Authorization: Bearer <Firebase_ID_Token>`

| Endpoint | Method | Security | Validator Function | Description |
| :--- | :---: | :---: | :--- | :--- |
| `/register` | POST | Public | `validate_register` | Verifies a client's Firebase `idToken` and updates display name. Creates a new profile document in the Firestore `users` collection with fields like `name`, `email`, `disabilityType`, and optional fields `firstName`, `lastName`, `phone`, `age`, `gender`. |
| `/login` | POST | Public | `validate_login` | Verifies a client's Firebase `idToken` and returns profile metadata from Firestore. |
| `/courses` | GET | Public | None | Streams and lists all courses from the Firestore `courses` collection. |
| `/courses` | POST | Protected | `validate_course` | Registers a new course (needs title, description, video, audio, category). |
| `/progress` | POST | Protected | `validate_progress` | Sets/updates course completion status (saved as document `{userId}_{courseId}`). |
| `/progress/<user_id>` | GET | Protected | None | Returns all course progress objects registered for a user. |
| `/users/<user_id>` | GET | Protected | None | Retrieves a user's details. Must match the decoded JWT's `uid`. |
| `/users/<user_id>` | PUT | Protected | `validate_user_update` | Updates user details (`name`, `disabilityType`). |
| `/users/<user_id>` | DELETE | Protected | None | Deletes profile document in Firestore and deletes user from Firebase Auth. |

---

## 🗄️ Database Schema & Multi-Mode Migration
To optimize querying and security, user profiles and progress data are split into specialized mode-based Firestore collections. A migration utility runs dynamically on route access if legacy data exists.

### Collection Mapping
| Mode / Disability Type | User Collection | Progress Collection |
| :--- | :--- | :--- |
| **Motor Mode** | `motor_users` | `motor_progress` |
| **Blind Mode** | `blind_users` | `blind_progress` |
| **Deaf Mode** | `deaf_users` | `deaf_progress` |
| **None (General)** | `general_users` | `general_progress` |

### Legacy Migration Logic
When a client hits `/users/<user_id>` or `/progress/<user_id>` endpoints:
1. The backend checks for user profile document existence in the legacy `users` collection.
2. If found, it reads the `disabilityType`, copies the document to the corresponding mode-specific user collection, and deletes the legacy document.
3. It performs a similar migration for progress records in the legacy `progress` collection (migrating them to the corresponding mode-specific progress collection with the added `disabilityType` field).

---

## 🎨 Accessibility Patterns & UI Logic

### 1. Deaf Mode (`DeafDashboard.jsx`)
- **CC Subtitles System**: Persistent captions panel (`CaptionBar.jsx`) positioned at the bottom of the screen.
- **Visual Alert System**: High-contrast, slide-down border screen flashes for important actions or warnings without relying on sound.
- **Filters**: Searching and visual category filters (Programming, Math, Science, Language, Life).

### 2. Blind Mode (`BlindDashboard.jsx`)
- **TTS Narration**: Powered by the browser's `speechSynthesis` API via a `useTTS` hook. Automatically reads sections/descriptions on element hover/focus (`onFocus`).
- **Hands-Free Navigation**: Continuous Speech Recognition (`SpeechRecognition` / `webkitSpeechRecognition`) engine processes global/contextual voice commands:
  - `"list courses"`: Reads names of available courses.
  - `"open course <number>"`: Starts the target course.
  - `"my progress"`: Speaks total stats.
  - `"stop"`: Instantly cancels TTS speech.
  - `"repeat"`: Narrates the current section again.
  - `"next" / "previous"`: Switches course player sections.
  - `"complete"`: Marks course progress as 100% and closes.
- **Accessible Layouts**: Includes `tabIndex={0}`, role labels (`role="article"`), detailed `aria-label` properties, and a hidden "Skip to main content" link.

### 3. Motor Mode (`MotorDashboard.jsx`)
- **Dwell-Click Engine**: Hovering over a `DwellButton` for 1.4 seconds (`DWELL_MS = 1400`) triggers its action automatically with an animated progress background overlay.
- **Switch Scanning**: Spacebar or Tab key cycles the active document focus sequentially between all active interactive items. Pressing Enter executes the action.
- **Hands-Free Speech Control**: Alternate Speech-to-Text listener supports switch commands like `"turn on dwell"`, `"turn on switch"`, `"settings"`, or `"courses"`.
- **Large Layout Target Elements**: All buttons are scaled, spaced, and visually highlighted (`outline: 4px solid #0284c7`) on focus.

---

## 🛠 Setup & Launch Details

### Frontend (`accessai-frontend/`)
Create a `.env` configuration file containing the following variables:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

Run frontend in development mode (starts on port 3000):
```powershell
npm start
```

### Backend (`backend/`)
Ensure `serviceAccountKey.json` is located in the `backend/` root directory.

To activate the virtual environment and install dependencies on Windows:
```powershell
.\venv_win\Scripts\activate
pip install -r requirements.txt
```

Start the Flask backend server (starts on port 5000):
```powershell
.\venv_win\Scripts\python.exe app.py
```

---

## 🟢 Current Services Status
Both the frontend and backend servers have been successfully started and are running as background processes:
- **Frontend**: Accessible at [http://localhost:3000](http://localhost:3000)
- **Backend**: API active at [http://localhost:5000](http://localhost:5000) (Health check: [http://localhost:5000/](http://localhost:5000/))

