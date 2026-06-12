One-Click Insight

**One-Click Insight** is a sleek, lightweight macOS desktop application built with Electron. It allows you to understand anything on your screen or browser in a single click. By leveraging local screenshot capabilities, AppleScript browser automation, and Google's Gemini multimodal models, it provides instant summaries, key takeaways, and action items without needing manual prompts.

---

 Key Features

*   **1-Click Capture**: Instant screen or active website analysis with zero friction.
*   **Dual Analysis Modes**:
    *   **Screen Mode**: Captures your current screen view silently and sends it to the Gemini multimodal API. Perfect for emails, PDFs, IDEs, code editors, or private applications.
    *   **Website Mode**: Uses AppleScript to extract the title and URL of the frontmost browser tab (Safari or Google Chrome), scrapes the text content directly, and analyzes it.
*   **Intelligent Content Classification**:
    *   **Article** → Focuses on summarizing core ideas and key arguments.
    *   **Homework/Assignment** → Identifies assignment questions, deadlines, and tasks.
    *   **Email**  → Summarizes threads and extracts required actions.
    *   **Documentation/Code** → Explains technical implementations and developer docs.
    *   **Other** → General summarization.
*   **Local History Logs**: Saves all previous captures with timestamps, metadata, and reference previews. Screenshots are saved to your local disk to keep local storage overhead minimal.
*   **Premium Glassmorphism UI**: A fluid dark theme utilizing glassmorphism cards, HSL colors, custom scrollbars, and interactive micro-animations.

---

 Architecture

The application is structured using Electron's main/renderer architecture to balance native system access with a modern frontend:

```
├── package.json         # NPM configuration and dependencies
├── main.js             # Electron main process (native OS bindings, AppleScript, screencapture)
├── preload.js          # Secure context bridge between Main and Renderer
├── index.html          # Application UI layout
├── index.css           # Custom styling (Glassmorphism, animations, layouts)
├── renderer.js         # Frontend controller (Gemini API client, localStorage management)
└── .gitignore          # Prevents tracking node_modules and local system files
```

---

 Prerequisites

*   **Operating System**: macOS (required for native `screencapture` and browser AppleScript interactions).
*   **Runtime Environment**: Node.js (v18.0.0 or higher).
*   **API Key**: A Google Gemini API Key (you can get one for free at [Google AI Studio](https://aistudio.google.com/)).

---

 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/omarmsigad-collab/desk.git
   cd desk
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

---

 How to Use

### 1. Set Your API Key
*   Click the **Gear icon (⚙️)** in the top-right header of the app.
*   Paste your Gemini API key from Google AI Studio.
*   Select your preferred model (recommended: `Gemini 2.5 Flash` for near-instant responses).
*   Click **Save Configurations**. The status badge in the header will turn green (`Ready`).

### 2. Screen Mode
*   Select **Screen Mode** on the radio toggle.
*   Keep the window/application you want to analyze visible on your screen.
*   Click the glowing **Capture Insight** button.
*   The One-Click Insight window will hide itself, capture your screen, restore itself, and display the structured analysis.

### 3. Website Mode
*   Open a public article, tutorial, or blog post in **Safari** or **Google Chrome**.
*   Select **Website Mode** on the toggle in the One-Click Insight app.
*   Click **Capture Insight**. The app will extract the text, analyze it, and output the summary alongside a link back to the source URL.
*   *Note: For private or login-restricted pages (like Gmail, private Notion pages, or dashboards), use Screen Mode to analyze the visual contents.*

### 4. Navigating History
*   Click any past capture in the left sidebar to reload its summary, details, and reference materials.
*   Click the **Trash icon (🗑️)** at the top of the sidebar to clear all local logs.

---

 Security & Privacy

*   **API Key Storage**: Your Gemini API key is saved directly inside your local Electron configuration using browser `localStorage` and never leaves your computer except to make requests to the official Google API.
*   **Screenshot Storage**: Screenshots taken in Screen Mode are saved locally on your computer in your Electron application's `userData` folder.
*   **No Analytics**: The application has no tracking, cookies, or remote analytics servers.

---

 macOS Permissions Note

On the first capture, macOS will prompt you for permissions:
1. **Screen Recording**: Required to take a snapshot of your screen in *Screen Mode*.
2. **Automation (System Events / Browsers)**: Required to query Safari or Google Chrome for active URL details in *Website Mode*.

If captures fail, ensure these permissions are toggled **ON** under **System Settings > Privacy & Security**.

---
