# Tuition Management App - Mangalore Centre

A mobile-first, single-user tuition management application built for a tutoring centre in Mangalore, Karnataka. The app helps log sessions, attendance, student profiles, test scores, monthly fees, and student notes, with direct integration for WhatsApp notification links for absent students.

## Tech Stack
*   **Frontend:** React + Vite (JavaScript)
*   **Styling:** Tailwind CSS + Lucide Icons
*   **Backend/Database:** Supabase
*   **Mobile Packaging:** Capacitor (Android)

---

## Environment Setup

Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

For remote database migrations/management, you can also include:
```env
SUPABASE_ACCESS_TOKEN=your_supabase_personal_access_token
```

---

## Getting Started Locally

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the local development server:**
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser. Toggle mobile view (`F12` -> Mobile Device Toggle) for the best design experience.

---

## Database Schema (Applied)

The database contains the following tables (already created in Supabase):

*   **`students`**: Personal details, standard (e.g., 9th, 10th), attending subjects, parent name, phone, and monthly fee amount.
*   **`sessions`**: Class log showing date, subject, and topic covered.
*   **`attendance`**: Junction table mapping student attendance (present/absent) to sessions.
*   **`tests`**: Record of test marks (score / max score) by date per student.
*   **`fees`**: Log of payments made by students per month (paid, partial, unpaid).
*   **`notes`**: Custom progress or behavioural notes per student.

---

## Android APK Build Instructions

To build the debug APK package:

1.  **Sync Web Assets:**
    Build the React application and sync it into Capacitor:
    ```bash
    npm run build
    npx cap sync
    ```

2.  **Compile & Assemble the APK:**
    Using Java 21, run the Gradle wrapper command to assemble the debug build:
    ```bash
    export JAVA_HOME=/opt/homebrew/opt/openjdk@21
    export PATH="$JAVA_HOME/bin:$PATH"
    cd android && ./gradlew assembleDebug
    ```

3.  **Find the APK:**
    Once compiled, the output package will be available at:
    `android/app/build/outputs/apk/debug/app-debug.apk`
