import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import AppNav from '@/components/layout/AppNav';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthRequiredScreen from '@/components/AuthRequiredScreen';
import AppLoadError from '@/components/AppLoadError';
import AdminGate from '@/components/admin/AdminGate';
import Home from './pages/Home';
import BreakScheduler from './pages/BreakScheduler';
import AdminDashboard from './pages/AdminDashboard';
import ShiftScheduler from './pages/ShiftScheduler';
import AdminShifts from './pages/AdminShifts';
import AdminUsers from './pages/AdminUsers';
import ResetPassword from './pages/ResetPassword';
import LiveDataSync from '@/components/LiveDataSync';
import FloatingChatWidget from '@/components/chat/FloatingChatWidget';
import { ChatPanelProvider } from '@/context/ChatPanelContext';
import { ChatUnreadProvider } from '@/hooks/useChatUnread';
import ChatDeepLink from './pages/ChatDeepLink';

const BOTTOM_NAV_PATHS = new Set(['/breaks', '/shifts']);

function BottomAppNav() {
  const { pathname } = useLocation();
  if (!BOTTOM_NAV_PATHS.has(pathname)) return null;
  return <AppNav />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <AuthRequiredScreen />;
    } else if (authError.type === 'unknown') {
      return <AppLoadError message={authError.message} />;
    }
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/breaks" element={<BreakScheduler />} />
        <Route path="/shifts" element={<ShiftScheduler />} />
        <Route path="/chat" element={<ChatDeepLink />} />
        <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
        <Route path="/admin/shifts" element={<AdminGate><AdminShifts /></AdminGate>} />
        <Route path="/admin/users" element={<AdminGate><AdminUsers /></AdminGate>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <BottomAppNav />
      <FloatingChatWidget />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LiveDataSync />
        <Router>
          <ChatPanelProvider>
            <ChatUnreadProvider>
              <AuthenticatedApp />
            </ChatUnreadProvider>
          </ChatPanelProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
