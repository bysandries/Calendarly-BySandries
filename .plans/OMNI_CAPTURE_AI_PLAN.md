# Omni-Capture AI Plan (Frictionless Data Engine)

This document outlines the architectural plan to solve the "Overengineering vs. Data Hoarding" dilemma. 

You want the rich data of all 34 tables (Habits, Therapy, Pomodoros, Tasks, Projects) so you can measure everything, but you want **zero manual data entry**. 

## The Solution: "Omni-Capture" AI Router
Instead of ripping out the complex backend, we will keep the database exactly as it is. However, we will completely bypass the complex UI forms. We will build a **Natural Language AI Router**.

You will have a single text box (or voice dictation in the future mobile app) where you just brain-dump your thoughts. A small, fast AI will parse your paragraph and automatically distribute the data into the correct tables.

### Example Scenario
**You type:** *"I'm feeling really anxious today. I did a 25 minute pomodoro on my math homework, but I got distracted by Twitter. Also remind me to buy milk tomorrow."*

**The AI automatically does the following in the background:**
1. **Therapy Table:** Creates a therapy entry tagged with `mood: anxious`.
2. **Pomodoro Table:** Logs a 25-minute session linked to the "Math Homework" task.
3. **Distraction Table:** Logs "Twitter" linked to that Pomodoro session.
4. **Tasks Table:** Creates a new task: "Buy milk" with a due date of tomorrow.

You do **nothing** except type the sentence.

## Implementation Steps

### 1. The Backend AI Route (`/api/omni-capture`)
We will create a new endpoint that receives a single string of text. 
- It will use a fast LLM (we can use a local model via Ollama to keep it 100% private and free, or a fast cloud API like Gemini Flash if you prefer).
- We will write a strict "System Prompt" giving the AI the schema of your database (Tasks, Habits, Logs, Pomodoros, Therapy).
- The AI will return a structured JSON object representing the operations to perform.

### 2. The Data Dispatcher
The backend will read the AI's JSON and automatically call the existing internal functions to save the data:
- `insertTask(...)`
- `insertPomodoro(...)`
- `insertTherapyEntry(...)`
- `insertHabitLog(...)`

### 3. The Frontend "Brain Dump" UI
We will upgrade your existing Quick Capture modal (`G` key or `?capture=true`) to be the **Omni-Capture Box**. 
- You just type. 
- When you hit enter, a loading spinner shows while the AI parses it.
- A toast notification will pop up summarizing what the AI did: *"Added 1 task, logged 1 pomodoro, saved 1 journal entry."*

### 4. Mobile Migration Benefit
This makes your future mobile app incredibly easy to build. The mobile app doesn't need 34 different screens for 34 tables. It just needs **one screen with a microphone button** that transcribes your voice and sends the text to `/api/omni-capture`.

---

## User Review Required

This pivot keeps your rich data but removes the UI friction. It acts as an intelligent assistant managing your database.

## Open Questions

> [!IMPORTANT]
> Please let me know how you feel about this direction!

1. **AI Model Choice:** Do you want this to run completely locally (using something like Ollama, which requires downloading a model to your machine and uses your own computer's power), or are you okay using a fast API (like Gemini/Claude) which is faster and smarter but sends the text to the cloud?
2. **Current Capture:** Right now, when you have a thought, what is your instinct? Do you prefer typing a paragraph, or would you eventually want to just speak it into your phone?
3. **Approval:** If this sounds like the right solution, reply with "Approved" and I will start building the `/api/omni-capture` endpoint right away!
