import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import { Loader2 } from 'lucide-react';

function DashboardSwitch() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-cyan)' }}>
        <Loader2 size={36} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingBottom: '3rem' }}>
        {user.role === 'ADMIN' ? <AdminDashboard /> : <UserDashboard />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardSwitch />
    </AuthProvider>
  );
}
