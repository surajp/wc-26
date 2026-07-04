# 🏆 FIFA World Cup 2026 Predictor & Interactive Bracket

A premium, responsive, and feature-rich client-side web application to track groups, standings, schedules, brackets, and predict scores for the 2026 FIFA World Cup (hosted across the USA, Canada, and Mexico).

Live at: [https://soccerworldcup.xyz](https://soccerworldcup.xyz)

---

## 🌟 Key Features

*   📊 **Real-time Standings & Groups:** Live calculations of points, goals scored/conceded, goal difference, wins, and group positions.
*   📅 **Interactive Matches Tab:** View, search, and filter matches by round, group, status, or team name.
*   🌿 **Interactive Tournament Bracket:** Drag-and-pan responsive visual bracket tracking progression from the Round of 32 all the way to the Final in New York/New Jersey.
*   🔮 **Score Predictor Workspace:** Set custom scorelines for group and knockout matches and watch the group tables and knockout brackets recalculate and progress dynamically.
*   ⚽ **Match Details Modals:** Click on any match card or list row to open a detailed popup with a chronological goal timeline, venue details, and prediction comparisons.
*   🌓 **Theme Switching:** Premium dark and light modes with custom CSS tokens.
*   💾 **Local Persistence:** All prediction states are automatically saved to your browser's `localStorage`.

---

## 🛠️ Technology Stack

*   **HTML5:** Semantic document structure.
*   **CSS3:** Vanilla CSS variables, animations, glassmorphism, responsive grid/flexbox layouts.
*   **JavaScript:** Vanilla ES6+ logic (data-driven state management, dynamic DOM rendering).
*   **VCS:** Managed using [Jujutsu (jj)](https://github.com/martinvonz/jj) backing Git.

---

## 🚀 How to Run Locally

You do not need to install complex dependencies. You can serve the static files using any simple web server:

1.  **Clone the repository:**
    ```bash
    jj git clone git@suraj.github.com:surajp/wc-26.git
    ```
2.  **Serve using Node.js:**
    ```bash
    npx http-server .
    ```
    Or if you prefer python:
    ```bash
    python3 -m http.server 8000
    ```
3.  Open `http://localhost:8080` (or `http://localhost:8000`) in your browser.

---

## 📂 Project Structure

```text
├── index.html           # Main application shell
├── app.js               # Application engine, data handlers, and DOM renderers
├── style.css            # Custom CSS variables, light/dark themes, animations
├── worldcup.json        # Baseline tournament match fixtures
├── sitemap.xml          # Search engine optimization index map
├── robots.txt           # Crawler accessibility directives
└── CNAME                # Domain routing mapping for GitHub Pages
```

---

## 🌐 SEO & Indexing

The project is fully configured for indexing and discovery:
*   Includes `robots.txt` and `sitemap.xml` at the root.
*   Registered and verified with Google Search Console and Bing Webmaster Tools.
*   Fully optimized semantic headings and meta tags.
