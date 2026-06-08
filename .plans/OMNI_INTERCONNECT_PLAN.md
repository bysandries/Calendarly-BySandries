# Omni-Capture Interconnectivity & Disambiguation Plan

To realize your vision of a deeply interconnected "second brain," we need to elevate Omni Capture from a simple "insert" button into a smart graph-builder. When you do a brain dump, the AI will detect who you are talking about, what projects are involved, and connect everything together.

## Open Questions

> [!IMPORTANT]
> 1. **Disambiguation UI:** If the AI finds multiple people named "John", I plan to have the Capture modal momentarily pause, show a popup asking "Which John?", and then proceed to save once you click the right one. Does this interactive pause work for you, or do you prefer the AI just guess or save it as a "draft" to fix later? Yes, it works for me.
> 2. **Generic Linking:** Do you want to be able to link *any* item (Tasks, Pomodoros, Therapy, Memories) to People and Projects? My plan implements a generic linking system so the AI can weave a web of connections across your entire database. Yes, you can link everything together. I dont want a generic linking. I want to be able to create all, events, thearpy sessions, qwuick logs, pomodoroes, tasks, projects. 

## Proposed Architecture

To solve the "disambiguation" problem without running the AI multiple times, we will split Omni Capture into a two-step process under the hood:
1. **Analyze Phase:** The AI reads your brain dump and drafts the operations. It identifies all `people_mentioned`. The backend checks the database. If there are duplicates, it stops and asks the frontend for help.
2. **Execute Phase:** The frontend provides the missing last names, and the backend officially commits the data to SQLite.

## Proposed Changes

### 1. Database Schema Additions
#### [MODIFY] `server/db.js`
- **New Table `memories`:**
  - `id` (TEXT PRIMARY KEY)
  - `content` (TEXT)
  - `memory_date` (TEXT)
  - `created_at` (TEXT)
- **New Table `entity_people_links`:**
  - A generic Many-to-Many table to link ANY brain dump item to people.
  - `entity_type` (TEXT) e.g., 'task', 'therapy', 'memory'
  - `entity_id` (TEXT)
  - `person_id` (TEXT)
  - `PRIMARY KEY(entity_type, entity_id, person_id)`
- **New Table `entity_project_links`:**
  - Similar generic table, allowing memories or therapy entries to link to Projects.

### 2. Backend Routes
#### [MODIFY] `server/routes/omni.js`
- **POST `/analyze`:**
  - Calls OpenCode LLM to parse the text into operations.
  - The AI prompt will be updated to extract a `people_mentioned: ["Name"]` array for every operation.
  - Backend queries the `people` table for every name.
  - If a name has 0 matches -> flags it to "create new".
  - If a name has >1 match -> returns a `409 Conflict` with `requires_disambiguation: true` and a list of candidates.
  - If all names have 0 or 1 match -> automatically proceeds to execute.
- **POST `/execute`:**
  - Receives the finalized operations and a `resolved_people` map (e.g., `{"John": "person-xyz"}`).
  - Creates new people in the `people` table if needed.
  - Inserts the tasks, therapy entries, and memories.
  - Inserts rows into `entity_people_links` to tie it all together.
  - Logs the event to `omni_logs` for your history.

### 3. Frontend App
#### [MODIFY] `client/src/components/CaptureModal.jsx`
- Add UI state for the disambiguation step.
- When `status === 'disambiguating'`, render a list of ambiguous names with a dropdown to select the correct person (or an input to provide a last name for a new person).
- Once resolved, fire the `/execute` endpoint to finish.
#### [MODIFY] `client/src/utils/api/omni.js`
- Replace `submitOmniCapture` with `analyzeOmniCapture` and `executeOmniCapture`.

## Verification Plan
1. Create two people named "John Doe" and "John Smith" in the database.
2. Submit a brain dump: "I had a great memory of going to the park with John. Also log a therapy entry about my anxiety."
3. Verify the modal pauses and asks "Which John?".
4. Select "John Doe". Verify the memory and therapy entry are created and successfully linked to John Doe in `entity_people_links`.
