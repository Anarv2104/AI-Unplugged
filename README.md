# AI Unplugged

Static multi-page site for AI Unplugged with a small local Node server for form handling.

## What This Project Includes

- Multi-page static site: `index.html`, `events.html`, `event.html`, `apply.html`, `node-lead.html`, `about.html`, `thank-you.html`
- Shared styling in `css/styles.css`
- Shared frontend scripts in `js/`
- Mock event source in `js/events-data.js`
- Local form submission endpoint in `server.js`
- Server-side CSV logging in `data/submissions.csv`

## Requirements

- Node.js installed

Check your version:

```bash
node -v
```

## Project Structure

```text
AI Unplugged/
├── index.html
├── events.html
├── event.html
├── apply.html
├── node-lead.html
├── about.html
├── thank-you.html
├── server.js
├── css/
│   └── styles.css
├── js/
│   ├── main.js
│   ├── events-data.js
│   ├── events.js
│   ├── event-detail.js
│   └── forms.js
└── data/
    └── submissions.csv
```

`data/submissions.csv` is created automatically the first time the server starts.

## How To Run

From the project folder:

```bash
cd "path/to/file"
node server.js
```

Then open:

```text
http://localhost:8000
```

## Exact Commands

Start the server:

```bash
cd "path/to/file"
node server.js
```

Start on a different port:

```bash
cd "path/to/file"
PORT=3000 node server.js
```

Open the site in browser after changing the port:

```text
http://localhost:3000
```

Stop the server:

```bash
Ctrl + C
```

## How Form Submissions Work

- User submits either the attend form or the Node Lead form
- Frontend sends the form payload to `POST /api/submissions`
- `server.js` appends that data to `data/submissions.csv`
- User is redirected to `thank-you.html`

This means submissions are stored on the server side of your local setup, not shown to the user in the UI.

## CSV Output Location

When the server is running, submissions are saved here:

```text
path/to/folder/data/submissions.csv
```

## Main Files You’ll Edit

- `js/events-data.js`
  Edit event cards, event detail content, dates, formats, and slugs.

- `index.html`
  Landing page content and CTA structure.

- `apply.html`
  Attend form fields and copy.

- `node-lead.html`
  Node Lead form fields and copy.

- `about.html`
  About page copy.

- `css/styles.css`
  Shared design system and all page styling.

## Notes

- This project has no build step.
- Do not open the HTML files directly if you want form submission to work.
- Use `node server.js`, not `python3 -m http.server`, because the forms need the POST endpoint in `server.js`.

## Quick Test Flow

1. Start the server with `node server.js`
2. Open `http://localhost:8000`
3. Go to `Apply Now` or `Node Lead`
4. Submit a form
5. Check `data/submissions.csv`

## Troubleshooting

If port `8000` is busy:

```bash
PORT=3001 node server.js
```

If the forms do not submit:

- Make sure you started the site with `node server.js`
- Make sure you are visiting `http://localhost:8000` or the custom port you chose
- Check that `data/submissions.csv` exists

