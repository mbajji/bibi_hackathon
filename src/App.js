import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ShiftSchedule from './pages/ShiftSchedule';
import ResolutionPlan from './pages/ResolutionPlan';
import ActionQueue from './pages/ActionQueue';
import DiscordMonitor from './pages/DiscordMonitor';
import Login from './pages/Login';

function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppProvider>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/schedule" element={<ShiftSchedule />} />
                      <Route path="/callout/:id" element={<ResolutionPlan />} />
                      <Route path="/actions" element={<ActionQueue />} />
                      <Route path="/discord" element={<DiscordMonitor />} />
                    </Routes>
                  </Layout>
                </AppProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
