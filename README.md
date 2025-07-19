# CodePilot

CodePilot is a web application that generates full HTML/CSS/JS code from a natural language prompt using OpenAI's API. The interface includes an editor and live preview so you can tweak the generated code in real time.

## Project Structure

```
/codepilot-app
  /client      - React frontend built with Vite and Tailwind CSS
  /server      - Express backend
```

## Setup

### Prerequisites
- Node.js 18+
- npm

### Backend

1. Copy `.env.example` to `.env` and add your OpenAI API key. The `.env` file is
   ignored by git so your secret stays local.
2. Install dependencies and start the server:

```bash
cd server
npm install
node index.js
```

### Frontend

In a new terminal:

```bash
cd client
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend on port `5000`.

## Usage

1. Enter a prompt such as `"Create a landing page for a coffee shop with a hero banner, menu section, and contact form"`.
2. Click **Generate** to send the prompt to the backend.
3. The generated HTML appears in the editor and is rendered in the preview pane.
4. Edit the code if desired and copy it from the editor.

## Exporting

To export the generated code manually, copy it from the editor and save it as an `.html` file. (A zip export button can be implemented as an improvement.)

## License
MIT
