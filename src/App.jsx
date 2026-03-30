import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './components/pages/LoginPage'
import DashboardPage from './components/pages/DashboardPage'
import AccountsPage from './components/pages/AccountsPage'
import TemplatesPage from './components/pages/TemplatesPage'
import SchedulesPage from './components/pages/SchedulesPage'
import ProxiesPage from './components/pages/ProxiesPage'
import PostLogsPage from './components/pages/PostLogsPage'import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './components/pages/LoginPage'
import DashboardPage from './components/pages/DashboardPage'
import AccountsPage from './components/pages/AccountsPage'
import AccountSettingsPage from './components/pages/AccountSettingsPage'
import TemplatesPage from './components/pages/TemplatesPage'
import SchedulesPage from './components/pages/SchedulesPage'
import ProxiesPage from './components/pages/ProxiesPage'
import PostLogsPage from './components/pages/PostLogsPage'

function PrivateRoute({ children }) {
  const token = useAuthStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:accountId/settings" element={<AccountSettingsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="proxies" element={<ProxiesPage />} />
          <Route path="logs" element={<PostLogsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}


function PrivateRoute({ children }) {
  const token = useAuthStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="proxies" element={<ProxiesPage />} />
          <Route path="logs" element={<PostLogsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
