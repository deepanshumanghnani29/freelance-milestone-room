// client/src/main.jsx
// The entry point for the React app.
// React renders the <App /> component into the #root div in index.html.

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // global styles

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
