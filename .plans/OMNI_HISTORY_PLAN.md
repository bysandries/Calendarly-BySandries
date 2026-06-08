# Omni History Tracking Plan

To allow you to review, edit, or delete items created by the Omni-Capture AI, and to keep a "hidden history" for future AI training, we need to add a new database table and a dedicated UI.

## Open Questions

> [!IMPORTANT]
> 1. **Page Location:** Where do you want the "Omni History" page to live? I plan to add a new page (`/omni-history`) and a link in the Sidebar under the "System" group. Is that okay, or would you prefer it embedded somewhere else?
> 2. **Deletion Behavior:** For the "hidden history", if you delete an item from the history view, should we also automatically delete the underlying tasks/pomodoros it created, or just hide the history log itself? 

## Proposed Changes

### 1. Database Schema
#### [MODIFY] `server/db.js`
- Create a new table `omni_logs`:
  - `id` (TEXT PRIMARY KEY)
  - `prompt` (TEXT) — The original brain dump you typed.
  - `raw_json` (TEXT) — The raw JSON returned by the OpenCode API.
  - `created_entities` (TEXT) — A JSON array of the specific items created (e.g. `[{"type": "task", "id": "task-abc"}, ...]`).
  - `is_hidden` (INTEGER DEFAULT 0) — Allows you to hide a log from the UI while keeping it in the database for AI training.
  - `created_at` (TEXT)

### 2. Backend Routes
#### [MODIFY] `server/routes/omni.js`
- **POST `/`**: Update the existing capture logic to insert a record into `omni_logs`, keeping track of every `id` generated during the dispatch.
- **GET `/history`**: New endpoint to fetch the history of Omni captures.
- **PATCH `/history/:id/hide`**: New endpoint to set `is_hidden = 1` for a log.

#### [NEW] `client/src/utils/api/omni.js`
- Add API functions: `fetchOmniHistory()` and `hideOmniHistory(id)`.

### 3. Frontend App & Routing
#### [NEW] `client/src/pages/OmniHistoryPage.jsx`
- Create a page that displays a chronological timeline of your brain dumps.
- For each entry, show the original text and visually list what was created.
- Provide quick links to navigate to the created entities (e.g. click to go to the Task Detail page).
- Provide a "Hide" button to mark the log as hidden.

#### [MODIFY] `client/src/App.jsx`
- Register `<Route path="/omni-history" element={<OmniHistoryPage />} />`.

#### [MODIFY] `client/src/components/Layout/Sidebar.jsx`
- Add an "Omni History" navigation link.

## Verification Plan
1. Send a test brain dump through the Quick Capture modal.
2. Navigate to the new "Omni History" page.
3. Verify the prompt and created items are listed correctly.
4. Verify hiding an item removes it from the view but keeps it in the SQLite database.
