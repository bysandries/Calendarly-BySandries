1. Split api.js (god module, 115 dependents)
Domain-specific files like api/tasks.js, api/habits.js, etc. Currently a single 180-line file with all 50+ endpoints. Every component imports it, making refactors risky.
2. Extract inline sub-components from PersonalCarePage.jsx (445 lines)
SleepKPI, BuildKPI, QuitKPI, ProjectsKPI, SleepSparklinePanel, NextSessionPanel, HabitBalancePanel, GoalsPanel, CareProjectsPanel — all defined in the same file. Each should be its own file under components/PersonalCare/.
3. Abstract the loading/error pattern from hooks into a reusable useQuery
Every hook (useTasks, usePeople, useProjects, etc.) duplicates the same state machine:
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
A single useQuery(fn, deps) would eliminate ~80% of hook boilerplate.
4. Uncouple PersonalCarePage.jsx from Analytics.css
It imports ../components/Analytics.css — a cross-component CSS dependency that creates implicit coupling.
5. Replace manual polling in Sidebar.jsx with a dedicated health-check hook
The sidebar currently mixes: responsive layout, health polling (30s), UI config polling (30s), and collapsed-state persistence. Extract health and config into custom hooks.
6. Add React Error Boundaries
Components handle errors inline with try/catch in useEffect — error boundaries would prevent entire page crashes and centralize error UI.
7. Move magic constants and helpers out of render code
STROKE = 188.5, sleepColor(), goalStatus() in PersonalCarePage.jsx — these are utility functions that should live in utils/ or a constants file.