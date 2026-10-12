import { ShopProvider, useShop } from './lib/ShopContext'
import ShopGate from './components/ShopGate'
import SignupPage from './pages/SignupPage'
import SettingsPage from './pages/SettingsPage'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import OrdersPage from './pages/OrdersPage'
import OrderForm from './pages/OrderForm'
import OrderDetail from './pages/OrderDetail'
import ProductsPage from './pages/ProductsPage'
import TrackPage from './pages/TrackPage'
import ConnectPrinterPage from './pages/ConnectPrinterPage'

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, var(--teal), #00a88c)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,201,167,0.3)', animation: 'pulse 1.4s ease-in-out infinite' }}>
        <img src="/sf-mark-light.png" alt="" style={{ width: '70%' }} /></div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Loading…</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.95)}}`}</style>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  return <ShopGate loading={<LoadingScreen />}>{children}</ShopGate>
}
function PublicRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (session) return <Navigate to="/" replace />
  return children
}

const link = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`

function Nav() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const { shop } = useShop()
  if (pathname.startsWith('/track') || !shop || shop.status !== 'approved') return null
  const displayName = user?.email?.split('@')[0] ?? ''
  return (
    <nav className="nav">
      <NavLink to="/" className="nav-logo">
        <img src="/sf-mark-light.png" alt="" style={{ width: 22, verticalAlign: 'middle' }} />
        {(shop?.name || 'Stellar Forge').split(' ')[0]} <span>{(shop?.name || 'Stellar Forge').split(' ').slice(1).join(' ')}</span>
      </NavLink>
      <div className="nav-links">
        <NavLink to="/" end className={link}>Home</NavLink>
        <NavLink to="/orders" end className={link}>Orders</NavLink>
        <NavLink to="/orders/new" className={link}>➕ New Order</NavLink>
        <NavLink to="/products" className={link}>Products</NavLink>
        <NavLink to="/settings" className={link}>Settings</NavLink>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 6, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.12)', gap: 6 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
          <button onClick={signOut} className="nav-link" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', padding: '5px 8px' }}>Out</button>
        </div>
      </div>
    </nav>
  )
}

function PoweredBy() {
  const { pathname } = useLocation()
  const { shop, settings } = useShop()
  if (pathname.startsWith('/track') || !shop || shop.status !== 'approved' || settings?.hide_powered) return null
  return <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted, #6b7c93)', padding: '14px 0 22px' }}>Powered by Stellar Forge</div>
}

function AppShell() {
  return (
    <div className="app-shell">
      <Nav />
      <Routes>
        <Route path="/track/:token" element={<TrackPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/orders/new" element={<ProtectedRoute><OrderForm /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/orders/:id/edit" element={<ProtectedRoute><OrderForm /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/connect-printer" element={<ProtectedRoute><ConnectPrinterPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PoweredBy />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><ShopProvider><ToastProvider><AppShell /></ToastProvider></ShopProvider></AuthProvider>
    </BrowserRouter>
  )
}
