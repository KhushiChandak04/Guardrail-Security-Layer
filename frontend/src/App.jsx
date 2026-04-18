import React from "react"
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom"

import { ChatProvider } from "./context/ChatContext"
import { ThemeProvider } from "./context/ThemeContext"
import AuthPage from "./pages/AuthPage"
import Home from "./pages/Home"
import LandingPage from "./pages/LandingPage"
import SolutionPage from "./pages/SolutionPage"
import "./styles/globals.css"

export default function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/solution" element={<SolutionPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/chat" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ChatProvider>
    </ThemeProvider>
  )
}
