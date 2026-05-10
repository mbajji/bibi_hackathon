import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ShiftSchedule from './pages/ShiftSchedule';
import ResolutionPlan from './pages/ResolutionPlan';
import ActionQueue from './pages/ActionQueue';
import TelegramMonitor from './pages/TelegramMonitor';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<ShiftSchedule />} />
            <Route path="/callout/:id" element={<ResolutionPlan />} />
            <Route path="/actions" element={<ActionQueue />} />
            <Route path="/telegram" element={<TelegramMonitor />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}
