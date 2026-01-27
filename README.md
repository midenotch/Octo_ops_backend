# OctoOps Backend - Intelligence Core

The backend server for OctoOps provides the persistent data layer and AI agent logic for project orchestration.

## 🧠 Intelligence Features

- **Automated Risk Analyzer**: Scans the database for potential mission failure points (Overdue tasks, Unassigned critical units).
- **Persistent Mission Tracking**: Manages `timerStartedAt` timestamps for synchronization across client sessions.
- **QA Feedback Orchestration**: Handles the workflow from 'in-review' to 'done' or 'todo' (rejection) with stored commentary.
- **Project Progress Calculation**: Real-time aggregation of task statuses into project-level health scores.

## 🛠️ Technical Stack

- **Runtime**: Node.js, Express.
- **Database**: MongoDB with Mongoose ODM.
- **Types**: TypeScript with strict Request/Response interfaces.

## 📡 API Endpoints

- `GET /api/projects`: Fetches project health and AI-detected autoRisks.
- `GET /api/tasks`: Retrieves missions for specific project sectors.
- `PUT /api/tasks/:id`: Updates task status and initializes timers.
- `POST /api/tasks/:id/submit`: Moves missions to the QA review queue.
- `POST /api/tasks/:id/approve`: Finalizes missions and updates global progress.

## 🏗️ Running the Server

1.  **Install dependencies**: `npm install`.
2.  **Environment Setup**: Configure `MONGODB_URI` and `PORT`.
3.  **Start Core**: `npm run dev`.
