import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AppProvider } from './context/AppContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ShiftSchedule from './pages/ShiftSchedule';
import ResolutionPlan from './pages/ResolutionPlan';
import ActionQueue from './pages/ActionQueue';
import DiscordMonitor from './pages/DiscordMonitor';
import ConnectDiscord from './pages/ConnectDiscord';
import Login from './pages/Login';

function RequireAuth({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login/*" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <WorkspaceProvider>
                <AppProvider>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/schedule" element={<ShiftSchedule />} />
                      <Route path="/callout/:id" element={<ResolutionPlan />} />
                      <Route path="/actions" element={<ActionQueue />} />
                      <Route path="/discord" element={<DiscordMonitor />} />
                      <Route path="/connect-discord" element={<ConnectDiscord />} />
                    </Routes>
                  </Layout>
                </AppProvider>
              </WorkspaceProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
