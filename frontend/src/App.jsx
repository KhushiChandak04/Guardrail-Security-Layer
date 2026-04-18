import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import SolutionPage from './pages/SolutionPage';
import AuthPage from './pages/AuthPage';
import Home from './pages/Home';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import Dashboard from './pages/dashboard/Dashboard';
import SecureChat from './pages/dashboard/SecureChat';
import AuditLogs from './pages/dashboard/AuditLogs';
import Policies from './pages/dashboard/Policies';

export default function App() {
  // For now, let's assume the user is logged in.
  // In a real app, you'd have some auth state.
  const isAuthenticated = true;

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/solution" element={<SolutionPage />} />
          <Route path="/auth" element={<AuthPage />} />
          
          {/* Redirect to dashboard if logged in */}
          <Route 
            path="/home" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Home />} 
          />

          {/* Dashboard Routes */}
          {isAuthenticated ? (
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="secure-chat" element={<SecureChat />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="policies" element={<Policies />} />
            </Route>
          ) : (
            // Redirect to auth page if not logged in and trying to access dashboard
            <Route path="/dashboard/*" element={<Navigate to="/auth" />} />
          )}

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
