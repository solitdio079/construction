import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./styles.css";
import "./sections.css";
import "./filters.css";
import "./hero-video.css";
import "./project-detail.css";
import "./corporate.css";
import "./routes.css";

createRoot(document.getElementById("root")).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
