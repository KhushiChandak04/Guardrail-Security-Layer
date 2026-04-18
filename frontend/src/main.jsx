import React from "react"
import { createRoot } from "react-dom/client"

import { ChatProvider } from "./context/ChatContext"
import Home from "./pages/Home"
import "./styles/globals.css"

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChatProvider>
      <Home />
    </ChatProvider>
  </React.StrictMode>
)
