# Smart Health Companion (NuFi) — Complete Project Architecture & Implementation Guide

## 1. Executive Summary & Vision

**Smart Health Companion (branded as NuFi)** is a production-grade, AI-first personal health, nutrition, and clinical companion mobile ecosystem. Built with React Native and Node.js/Express, the platform bridges the gap between manual dietary logging, biometric telemetry, autonomous AI coaching, and clinical doctor consultations.

The platform combines five foundational pillars:
1. **Multimodal AI Food Vision**: Instant meal recognition using Google Gemini Vision (`gemini-3.5-flash-lite` / `gemini-3.6-flash`) to estimate calories, macronutrients (protein, carbs, fat), micronutrients (fiber, sugar, sodium), identify ingredients, and compute standardized **Nutri-Scores (A–E)**.
2. **NuFi Autonomous Health Agent**: An intelligent conversational companion powered by Google Gemini / Groq Llama 3.3 70B and **Mastra Tool Calling**. Users can converse naturally, log meals directly from chat, query remaining macro budgets, and receive personalized feedback based on live biometrics.
3. **Android Health Connect & Google Fit Integration**: Direct synchronization with Android Health Connect across 18 read-only health metrics (steps, active calories burned, resting heart rate, sleep duration, distance, etc.), with deduplicated native aggregations and end-to-end encrypted cloud backup.
4. **Scientific Biometric Target Engine**: Automated computation of Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) via the **Mifflin-St Jeor formula**, coupled with a dynamic **Daily Health Score (0–100)** and rolling weekly adherence analytics.
5. **Clinical Specialist Directory & Appointment Booking**: A curated doctor browsing and dynamic appointment scheduling system built with offline-first resilience for seamless access during network dropouts.

---

## 2. System Architecture & High-Level Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 REACT NATIVE MOBILE APP                                  │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                    AppNavigator                                    │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────────────────────┐  │  │
│  │  │   AuthStack (Public)    │  │                AppStack (Modal & Main)          │  │  │
│  │  │  - LoginScreen          │  │  - FoodScannerScreen (AI Vision Camera)         │  │  │
│  │  │  - RegisterScreen       │  │  - MealNutritionDetailScreen (Macro Confirmation)│  │  │
│  │  └─────────────────────────┘  │  - ManualMealEntryScreen (Manual Fast Log)      │  │  │
│  │                               └────────────────────────┬────────────────────────┘  │  │
│  │                                                        │                           │  │
│  │  ┌─────────────────────────────────────────────────────┴────────────────────────┐  │  │
│  │  │                   MainTabs (Stationary Bottom Dock Navigation)                │  │  │
│  │  │  ┌───────────────────┬──────────────┬──────────────────┬───────────────────┐ │  │  │
│  │  │  │ DietDashboard     │ NuFi AI Chat │ MealHistory      │ Profile & Targets │ │  │  │
│  │  │  └───────────────────┴──────────────┴──────────────────┴───────────────────┘ │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┬────────────────────────────────────────┘  │
│                                              │                                           │
│         ┌──────────────────┬─────────────────┴───────────────┬───────────────────┐       │
│         ▼                  ▼                                 ▼                   ▼       │
│   [AuthContext]      [DietContext]                [HealthConnectContext]    [AppContext] │
│   JWT & Sessions     Meals & Dashboard Cache      HC Sync & Permissions     Global State │
│         │                  │                                 │                   │       │
│         └──────────────────┼─────────────────────────────────┴───────────────────┘       │
│                            ▼                                                             │
│       Axios API Client (Token Interceptor, Auto-Timeout, Dual-Endpoint Fallback)         │
│                            │                                 │                           │
└────────────────────────────┼─────────────────────────────────┼───────────────────────────┘
                             │                                 │
                             ▼                                 ▼
              ┌───────────────────────────────┐ ┌──────────────────────────────────────────┐
              │     EXPRESS.JS BACKEND        │ │        ANDROID HEALTH CONNECT            │
              │                               │ │  - Steps (Daily Native Aggregation)      │
              │  /api/auth/*     (JWT & User) │ │  - Active & Total Calories Burned        │
              │  /api/diet/*     (Meals/Logs) │ │  - Heart Rate & Resting BPM              │
              │  /api/chat       (Mastra AI)  │ │  - Sleep Sessions & Duration             │
              │  /api/v1/health-connect (Enc) │ │  - 18 Read-Only Metrics (Zero Background)│
              │  /api/doctors    (Appointments)│└──────────────────────────────────────────┘
              └──────────────┬────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────────┐┌──────────────────┐┌──────────────────────────────────────────────────┐
│  MongoDB Atlas   ││  Gemini Vision   ││           Mastra AI Tools Engine                 │
│  - Users         ││  (3.5/3.6 Flash) ││  - logMeal (Natural language meal logging)       │
│  - MealLogs      │└──────────────────┘│  - getDietDashboard (Daily totals vs targets)   │
│  - HealthSnapshots│                   │  - getHealthConnectSummary (Steps/Burn/Sleep)    │
│    (AES-256-GCM) │                    │  - getUserTargets / updateUserTargets            │
│  - Doctors       │                    │  - getMealHistory (Historical date inspection)   │
└──────────────────┘                    └──────────────────────────────────────────────────┘
```

---

## 3. Core Feature Implementations

### 3.1. Multimodal AI Food Vision Scanner
- **Files**: `src/screens/FoodScannerScreen.jsx`, `server/services/aiService.js`, `src/screens/MealNutritionDetailScreen.jsx`
- **Image Acquisition**: Users can snap a live photo or pick from their gallery via `react-native-image-picker` with optimized compression (JPEG, 0.8 quality, 1024x1024 max dimensions).
- **Vision Inference**: Sends clean base64 data to `POST /api/diet/scan`. The backend utilizes Google Gemini Vision (`gemini-3.5-flash-lite` with fallback to `gemini-3.6-flash`).
- **Safety Guardrail**: Detects non-food objects. If a user scans a pet, keyboard, or vehicle, the prompt instructs Gemini to flag `isFood: false`, prompting the user to photograph an edible item.
- **Nutri-Score Computation**: Automatically classifies meal quality from **A** (healthiest) down to **E** based on nutrient density, fiber, protein vs. sodium and sugar levels.
- **Review & Confirm**: Navigates to `MealNutritionDetailScreen` where users inspect detected ingredients, tweak portion sizes or macros, and save to their daily log.

### 3.2. NuFi Autonomous AI Coach & Mastra Tool Calling
- **Files**: `src/screens/NuFiAIScreen.jsx`, `server/routes/chatRoute.js`, `server/tools/mastraNutritionTools.js`
- **Conversational Meal Logging**: Users can type natural phrases like *"I ate 2 boiled eggs and a cup of black coffee for breakfast"*. The AI agent executes `logMeal`, estimates accurate portion calories and macros, writes to MongoDB, and returns confirmation with updated score and remaining budget.
- **Mastra Function Calling Loop**:
  - `getDietDashboard`: Retrieves today's consumed calories, remaining calories, macronutrients, and logged meals.
  - `getHealthConnectSummary`: Retrieves today's live steps, active calories burned, sleep duration, and resting heart rate.
  - `getMealHistory`: Fetches historical dietary logs for any specific date.
  - `getUserTargets` & `updateUserTargets`: Inspects and updates physical targets dynamically.
  - `getWeeklyProgress`: Evaluates 7-day adherence trends.
  - `logMeal`: Directly commits verified meal entries into the database during dialogue.
- **Deterministic Animated Keyboard UI**: Uses a pure React Native `Animated.Value` spacer (`keyboardSpacerAnim`) with zero `KeyboardAvoidingView` conflicts:
  - **Resting**: Positioned at `Math.max(insets.bottom, 8) + 68 + 12px` above the floating navigation pill.
  - **Open**: Expands smoothly by `keyboardHeight + insets.bottom + 40px`, comfortably clearing the Android soft keyboard, predictive toolbar, and system navigation bar.
  - **Close / Back Button**: Smoothly returns to resting height without lingering.
- **Session Persistence**: Stores past chat threads in `AsyncStorage` with custom titles, creation dates, message counts, and drawer navigation.

### 3.3. Android Health Connect & Google Fit Sync
- **Files**: `src/services/healthConnectService.js`, `src/context/HealthConnectContext.jsx`, `server/models/HealthConnectSnapshot.js`, `server/utils/crypto.js`
- **18 Read-Only Metrics**: Steps, Heart Rate, Resting Heart Rate, Active Calories, Total Calories, BMR, Distance, Floors Climbed, Sleep Sessions, Blood Pressure, Blood Glucose, Oxygen Saturation, Respiratory Rate, VO2 Max, HRV Rmssd, Hydration, Body Fat, and Exercise Sessions.
- **Native Aggregation**: Calls `HealthConnect.aggregateRecord` for `Steps` to extract Google Fit's official deduplicated step count (`COUNT_TOTAL`), preventing double-counting between multiple source apps (e.g. phone sensors vs. smartwatches).
- **Time Window Precision**:
  - Uses device-local midnight (`setHours(0,0,0,0)`) rather than UTC midnight to avoid dropping steps walked in non-UTC timezones.
  - Uses `operator: 'after'` for 30-day reads, today's step aggregation, and sleep queries, completely eliminating the Android SDK `startTime must be before endTime` exception.
- **Encrypted Cloud Sync**: Snapshots are synced to `PUT /api/v1/health-connect` and stored in MongoDB using **AES-256-GCM** encryption with authenticated tags and initialization vectors (IVs).
- **Infinite Loop Prevention**: Throttled on focus with a 60-second cooldown and stabilized via `useRef` to maintain constant callback identity.

### 3.4. Diet Dashboard & Health Score Algorithm
- **Files**: `src/screens/DietDashboardScreen.jsx`, `src/context/DietContext.jsx`
- **Daily Health Score (0–100)**: Evaluates dietary quality dynamically:
  $$\text{Score} = 100 - \sum \text{Deficit Penalties} - \sum \text{Excess Penalties}$$
  - Caloric balance against target ($\pm 10\%$ is optimal).
  - Protein adherence ($\ge 90\%$ of target rewarded).
  - Fiber intake ($\ge 25\text{g}$ rewarded).
  - Sugar restriction ($> 50\text{g}$ penalizes up to 15 points).
  - Sodium restriction ($> 2300\text{mg}$ penalizes up to 15 points).
- **Circular Progress Ring**: Visualizes daily calorie budget with percentage fill and remaining counts.
- **Weekly Adherence Strip**: Tracks 7-day adherence with health score dots from Monday through Sunday.
- **Daily Healthy Habits**: Interactive toggles for Water Intake, Daily Vitamins, Veggie Servings, 30-Min Workout, and Sugar-Free Drinks.

### 3.5. Biometrics & BMR Calculation Engine
- **Files**: `src/screens/ProfileScreen.jsx`, `server/models/User.js`
- **Mifflin-St Jeor Formula**:
  $$\text{BMR}_{\text{male}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (years)} + 5$$
  $$\text{BMR}_{\text{female}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (years)} - 161$$
- **Activity Multipliers**:
  - Sedentary: $\times 1.2$
  - Light: $\times 1.375$
  - Moderate: $\times 1.55$
  - Active: $\times 1.725$
- **Goal Offsets**:
  - Weight Loss: $\text{TDEE} - 500\text{ kcal}$
  - Maintenance: $\text{TDEE}$
  - Muscle Gain: $\text{TDEE} + 400\text{ kcal}$
- **Macro Distribution**: Automatically derives 30% Protein, 45% Carbohydrates, and 25% Fat.

### 3.6. Specialist Directory & Doctor Appointment Booking
- **Files**: `server/models/Doctor.js`, `server/index.js`, `src/screens/DoctorScreen.jsx`
- **Specialist Profiles**: Clinical doctor listings categorized by specialty, experience, verified patient ratings, and clinic availability hours.
- **Dynamic Scheduling**: Interactive day and slot picker strictly constrained to doctor clinic hours.
- **Offline-First Resilience**: Intercepts network interruptions by falling back to cached specialist listings in local device storage.

---

## 4. Mastra AI Tools Engine Specification

NuFi equips the AI Agent with 9 domain tools defined in `server/tools/mastraNutritionTools.js`:

| Tool Name | Parameters | Purpose & Description |
| :--- | :--- | :--- |
| `getDietDashboard` | *(none)* | Returns today's consumed calories, macros, target goals, remaining budget, and logged meals. |
| `getTodaySummary` | *(none)* | Compact summary of today's nutrition and calorie score for quick conversational check-ins. |
| `getMealHistory` | `date` (YYYY-MM-DD) | Retrieves full meal breakdown and macronutrients for any requested historical date. |
| `getUserTargets` | *(none)* | Fetches the user's active BMR, TDEE, calorie target, and macro goals. |
| `updateUserTargets` | `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium` | Dynamically updates user nutritional goals based on progress or conversational preferences. |
| `getWeeklyProgress` | *(none)* | Calculates 7-day adherence metrics, average calories consumed, and weekly score. |
| `getHealthConnectSummary` | *(none)* | Accesses decrypted Health Connect snapshot to provide live steps, active burn, sleep, and heart rate. |
| `logMeal` | `name`, `mealType`, `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium` | Primary tool that persists a new meal record directly to MongoDB during conversation. |
| `logMealFromChat` | `name`, `mealType`, `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium` | Alias with automated Nutri-Score calculation for conversational meal confirmation. |

---

## 5. Defense-in-Depth Safety & Guardrails Architecture

NuFi implements safety guardrails across its AI and biometric pipeline:

| Guardrail Layer | Implementation Location | Mechanism & Purpose |
| :--- | :--- | :--- |
| **Domain Scope & Off-Topic Guardrail** | `server/routes/chatRoute.js` (`getSystemInstructions`) | Restricts NuFi strictly to nutrition, diet, fitness, and wellness. Rejects programming code (e.g., reversing a string, scripting algorithms), math puzzles, or general non-health topics with a polite redirect back to nutrition. |
| **Non-Food Vision Guardrail** | `server/services/aiService.js` (`analyzeFoodImage`) | Enforces structured prompt output with `isFood: false` if a user photographs non-edible items (pets, electronics, scenery), preventing erroneous meal logs. |
| **Biometric Non-Diagnostic Guardrail** | `server/routes/chatRoute.js` (`getSystemInstructions`) | Prohibits AI from prescribing medication or giving clinical diagnoses from sensor readings. Biometrics are treated as wellness telemetry, not clinical diagnoses. |
| **Explicit Consent Guardrail** | `server/tools/mastraNutritionTools.js` (`getHealthConnectSummary`) | Checks `consentGiven === true` in the encrypted `HealthConnectSnapshot`. If consent is missing or revoked, biometric access is blocked and the user is directed to settings. |
| **Data Freshness Guardrail** | `server/tools/mastraNutritionTools.js` & `chatRoute.js` | Drops or alerts on biometric records older than 30 days or stale by >24 hours, preventing old metrics from being hallucinated as today's activity. |

---

## 6. Technology Stack & Dependencies

### Mobile Application (Frontend)
| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2.3 | Core UI library |
| `react-native` | 0.85.0 | Mobile framework |
| `@react-navigation/native` | ^7.2.2 | Core navigation container |
| `@react-navigation/bottom-tabs` | ^7.18.18 | Stationary floating bottom dock tabs |
| `@react-navigation/native-stack` | ^7.14.11 | Native stack screens and modal sheets |
| `react-native-health-connect` | ^4.1.3 | Android Health Connect client |
| `react-native-image-picker` | ^8.2.1 | Camera capture and gallery photo selection |
| `react-native-safe-area-context` | ^5.7.0 | Dynamic notch, status bar, and home indicator insets |
| `react-native-screens` | ^4.24.0 | Native screen primitives |
| `react-native-svg` | ^15.15.5 | Vector health rings and custom icons |
| `lucide-react-native` | ^1.33.0 | Modern icon iconography |
| `axios` | ^1.15.0 | HTTP client with token and dual-endpoint interceptors |
| `@react-native-async-storage/async-storage` | ^3.0.2 | Persistent device cache for JWT, offline snapshots, chat |

### Backend API (Server)
| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.21.2 | REST API routing and server framework |
| `mongoose` | ^8.10.1 | MongoDB Object-Document Modeling (ODM) |
| `@google/generative-ai` | ^0.21.0 | Google Gemini multimodal Vision and text SDK |
| `@mastra/core` | ^0.1.32 | Mastra agent tool definition framework |
| `jsonwebtoken` | ^9.0.2 | Cryptographic user authentication tokens |
| `bcryptjs` | ^3.0.2 | Password salt and hashing |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing middleware |
| `dotenv` | ^16.4.7 | Environment configuration management |

---

## 7. Database Schemas & Models

### 1. User (`server/models/User.js`)
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  profile: {
    age: { type: Number, default: 25 },
    weight: { type: Number, default: 70 },       // kg
    height: { type: Number, default: 170 },      // cm
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    goal: { type: String, enum: ['lose', 'maintain', 'gain'], default: 'maintain' },
    activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active'], default: 'moderate' }
  },
  dailyTargets: {
    calories: { type: Number, default: 2000 },
    protein:  { type: Number, default: 115 },    // g
    carbs:    { type: Number, default: 250 },    // g
    fat:      { type: Number, default: 65 },     // g
    fiber:    { type: Number, default: 30 },     // g
    sugar:    { type: Number, default: 50 },     // g
    sodium:   { type: Number, default: 2300 }    // mg
  },
  habits: [
    { title: String, completed: Boolean, icon: String }
  ],
  createdAt: { type: Date, default: Date.now }
}
```

### 2. MealLog (`server/models/MealLog.js`)
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], default: 'lunch' },
  imageBase64: { type: String },
  calories: { type: Number, required: true },
  protein:  { type: Number, default: 0 },
  carbs:    { type: Number, default: 0 },
  fat:      { type: Number, default: 0 },
  fiber:    { type: Number, default: 0 },
  sugar:    { type: Number, default: 0 },
  sodium:   { type: Number, default: 0 },
  nutriScore: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], default: 'C' },
  ingredients: [String],
  loggedAt: { type: Date, default: Date.now, index: true }
}
```

### 3. HealthConnectSnapshot (`server/models/HealthConnectSnapshot.js`)
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  encryptedPayload: { type: String, required: true }, // AES-256-GCM ciphertext
  iv: { type: String, required: true },               // 12-byte hex Initialization Vector
  tag: { type: String, required: true },              // 16-byte hex Auth Tag
  historyRefreshedOn: { type: String },               // YYYY-MM-DD
  connected: { type: Boolean, default: true },
  syncEnabled: { type: Boolean, default: true },
  assistantAccessEnabled: { type: Boolean, default: true },
  grantedMetrics: [String],
  sourceApps: [String],
  lastSyncedAt: { type: Date, default: Date.now }
}
```

### 4. Doctor (`server/models/Doctor.js`)
```javascript
{
  name: { type: String, required: true },
  specialization: { type: String, required: true },
  rating: { type: Number, default: 4.5 },
  experienceYears: { type: Number, default: 5 },
  availableDays: [String],
  clinicHours: { start: String, end: String },
  contact: { phone: String, email: String }
}
```

---

## 8. Complete REST API Reference

### Authentication Routes (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Registers user, calculates Mifflin-St Jeor targets, returns JWT token |
| `POST` | `/api/auth/login` | Authenticates user credentials and issues JWT token |
| `GET` | `/api/auth/me` | Fetches authenticated user profile and daily targets |

### Diet & Nutrition Routes (`/api/diet`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/diet/dashboard` | Fetches today's consumed macros, targets, meals, habits, and health score |
| `POST` | `/api/diet/scan` | Analyzes base64 food photo using Gemini Vision AI |
| `POST` | `/api/diet/log` | Saves a meal log to database and recalibrates daily consumed totals |
| `GET` | `/api/diet/history?date=YYYY-MM-DD` | Returns logged meals and macro breakdown for a specific date |
| `PUT` | `/api/diet/targets` | Updates user physical attributes and recalculates nutrition goals |
| `PUT` | `/api/diet/habits/toggle` | Toggles status of daily routine habit item |

### NuFi AI Assistant Routes (`/api/chat`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | AI conversational endpoint with Mastra Tool Calling (natural language queries & meal logging) |

### Health Connect Routes (`/api/v1/health-connect`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health-connect` | Decrypts and retrieves the user's latest Health Connect snapshot |
| `PUT` | `/api/v1/health-connect` | Encrypts (AES-256-GCM) and upserts 30-day health snapshot |
| `PATCH` | `/api/v1/health-connect` | Updates sync settings (`sync_enabled`, `assistant_access_enabled`) |
| `DELETE` | `/api/v1/health-connect` | Deletes stored Health Connect snapshot from cloud storage |

### Doctors & Appointments (`/api/doctors`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/doctors` | Retrieves specialist directory with ratings, clinic hours, and availability |

---

## 9. Directory & File Organization

```
Smart-Health-Companion/
├── src/
│   ├── components/
│   │   ├── BottomNavBar.jsx        # Stationary floating bottom navigation bar with modal quick-action sheet
│   │   ├── CircleProgress.jsx      # SVG animated circular score and calorie ring
│   │   ├── Icons.jsx               # Custom SVG health, food, and tab icons
│   │   └── NutriTrackLogo.jsx      # Vector branded NuFi logo component
│   ├── context/
│   │   ├── AppContext.jsx          # Top-level global state provider
│   │   ├── AuthContext.jsx         # User auth, JWT token persistence, and dual-endpoint API client
│   │   ├── DietContext.jsx         # Diet dashboard, meal caching, meal logging, and scan state
│   │   └── HealthConnectContext.jsx# Health Connect availability, permissions, sync, and local storage
│   ├── navigation/
│   │   └── AppNavigator.jsx        # Root Navigation with AppStack, AuthStack, and directional slide tabs
│   ├── screens/
│   │   ├── DietDashboardScreen.jsx # Daily score, calorie ring, macro splits, Health Connect strip, meal feed
│   │   ├── FoodScannerScreen.jsx   # Camera capture, gallery picker, and AI scanning animation
│   │   ├── MealNutritionDetailScreen.jsx # Nutritional breakdown review, manual macro tweaks, and save action
│   │   ├── ManualMealEntryScreen.jsx # Direct manual meal logging form with Nutri-Score calculator
│   │   ├── MealHistoryScreen.jsx   # 7-day horizontal calendar strip and historical meal logs
│   │   ├── NuFiAIScreen.jsx        # Conversational AI coach, tool execution, session drawer, animated keyboard
│   │   ├── ProfileScreen.jsx       # Physical stats, Mifflin-St Jeor target editor, Health Connect settings
│   │   ├── LoginScreen.jsx         # User sign-in screen with form validation and branding
│   │   └── RegisterScreen.jsx      # Onboarding questionnaire and goal selection
│   ├── services/
│   │   ├── api.js                  # Axios configuration with token injection and dual-endpoint switching
│   │   └── healthConnectService.js # Health Connect native bindings, 18 metrics, local midnight aggregation
│   ├── theme.js                    # Design tokens (colors, lime accents, card styling, typography, shadows)
│   └── config.js                   # API base URLs for physical devices and emulators
├── server/
│   ├── index.js                    # Express application entrypoint and MongoDB connection
│   ├── middleware/
│   │   └── authMiddleware.js       # JWT extraction and authentication guard
│   ├── models/
│   │   ├── User.js                 # User schema and Mifflin-St Jeor BMR equation logic
│   │   ├── MealLog.js              # Meal logs with nutrients, ingredients, and Nutri-Scores
│   │   ├── HealthConnectSnapshot.js# Encrypted Health Connect snapshot schema
│   │   └── Doctor.js               # Clinical doctor profile schema
│   ├── routes/
│   │   ├── authRoutes.js           # Registration and login endpoints
│   │   ├── dietRoutes.js           # Dashboard, AI scan, meal log, history, and target routes
│   │   ├── chatRoute.js            # NuFi AI agent conversation and Mastra tool calling execution
│   │   └── healthConnectRoutes.js  # Encrypted Health Connect sync endpoints
│   ├── services/
│   │   └── aiService.js            # Google Gemini Vision prompt and image analysis service
│   ├── tools/
│   │   └── mastraNutritionTools.js # Mastra tools for AI agent (dashboard, meal logs, HC data)
│   ├── utils/
│   │   └── crypto.js               # AES-256-GCM encryption and decryption utilities
│   └── seed.js                     # Initial test database seeding script
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml     # Health Connect 18 read permissions, rationale filter, activity alias
│       └── java/com/smc/
│           └── MainActivity.kt     # Permission delegate initialization
├── App.tsx                         # Root React Native component with Context Providers
├── description.md                  # Comprehensive project architecture documentation
├── README.md                       # Project overview and setup documentation
└── package.json                    # Project dependencies and run scripts
```

---

## 10. Setup & Execution Guide

### Prerequisites
- **Node.js**: v18+ recommended (tested on v20+)
- **Android Studio**: Android SDK 34+ (Health Connect native support)
- **MongoDB**: MongoDB Atlas URI or local instance
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)
- **Groq API Key**: (Optional, recommended for ultrafast chat) From [Groq Console](https://console.groq.com/)

### 1. Backend Configuration
1. Navigate to `server/`:
   ```bash
   cd server
   npm install
   ```
2. Create or verify `server/.env`:
   ```env
   PORT=3000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smarthealth?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   DEFAULT_TIMEZONE_OFFSET=-330
   ```
3. *(Optional)* Seed initial doctor directory:
   ```bash
   node seed.js
   ```
4. Start the server:
   ```bash
   node index.js
   ```

### 2. Frontend Configuration
1. In the project root, install dependencies:
   ```bash
   npm install
   ```
2. If developing with a physical Android device via USB:
   ```bash
   adb reverse tcp:3000 tcp:3000
   adb reverse tcp:8081 tcp:8081
   ```
3. Start the Metro bundler:
   ```bash
   npm run start -- --reset-cache
   ```
4. Build and run on Android:
   ```bash
   npx react-native run-android
   ```

---

## 11. Key Engineering Solutions Implemented

1. **Android Soft Keyboard Double-Compensation**:
   - Resolved by replacing `KeyboardAvoidingView` with a pure `Animated.Value` spacer.
   - Computes dynamic clearance (`keyboardHeight + insets.bottom + 40px`), lifting the input field past Android's navigation bar and predictive text toolbar while maintaining a clean resting position above the floating bottom dock.

2. **Health Connect `startTime must be before endTime` Exception**:
   - Resolved by transitioning queries from `operator: 'between'` to `operator: 'after'`.
   - Native Android `TimeRangeFilter.after(startTime)` removes the `endTime` parameter entirely, making boundary inversion errors impossible.

3. **Infinite Health Connect Sync Loop**:
   - Stabilized `syncNow` dependencies in `HealthConnectContext.jsx` using `useRef` to prevent recreation on state updates.
   - Added a 60-second focus throttle in `DietDashboardScreen.jsx` to prevent continuous database write hammering.

4. **Single Source of Truth for Steps & Active Burn**:
   - Relies exclusively on `HealthConnect.aggregateRecord` for `Steps` to align with Google Fit's official deduplicated counts, avoiding double-counting between multiple device sensors.
   - Synchronized Mastra AI tool `getHealthConnectSummary` to match the dashboard calculation logic.

5. **Strict Domain Scope Guardrail**:
   - Implemented an explicit guardrail rule in `server/routes/chatRoute.js` (`getSystemInstructions`) instructing the model to reject non-wellness queries (e.g., writing code to reverse a string or software debugging) and politely redirect users back to their nutrition goals.
