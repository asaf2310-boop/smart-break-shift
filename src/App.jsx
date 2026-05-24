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
import DemoGate from '@/components/DemoGate';
import Home from './pages/Home';
import BreakScheduler from './pages/BreakScheduler';
import AdminDashboard from './pages/AdminDashboard';
import ShiftScheduler from './pages/ShiftScheduler';
import AdminShifts from './pages/AdminShifts';
import AdminUsers from './pages/AdminUsers';
import ResetPassword from './pages/ResetPassword';
import LiveDataSync from '@/components/LiveDataSync';
import FloatingChatWidget from '@/components/chat/FloatingChatWidget';
import SoftphoneWidget from '@/components/telephony/SoftphoneWidget';
import { ChatPanelProvider } from '@/context/ChatPanelContext';
import { TelephonyProvider } from '@/context/TelephonyContext';
import { FloatingWidgetsLayerProvider } from '@/context/FloatingWidgetsLayerContext';
import { ChatUnreadProvider } from '@/hooks/useChatUnread';
import ChatDeepLink from './pages/ChatDeepLink';
import CrmDashboard from './pages/CrmDashboard';
import CrmCustomerDetail from './pages/CrmCustomerDetail';
import KnowledgePage from './pages/KnowledgePage';
import AdminKnowledge from './pages/AdminKnowledge';
import FloatingKnowledgeWidget from '@/components/knowledge/FloatingKnowledgeWidget';
import AdminLocalhostLinksFloating from '@/components/admin/AdminLocalhostLinksFloating';
import RemoteSupportConsentPage from './pages/RemoteSupportConsentPage';
import RemoteSupportPage from './pages/RemoteSupportPage';
import ScreenShareGuestPage from './pages/ScreenShareGuestPage';
import DemoRecordingPlayPage from './pages/DemoRecordingPlayPage';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import { hasTopAppNav } from '@/lib/appNavPaths';

function TopAppNav() {
  const { pathname } = useLocation();
  if (!hasTopAppNav(pathname)) return null;
  return <AppNav />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center m3-page">
        <div
          className="w-10 h-10 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin"
          style={{ boxShadow: "var(--brand-glow-purple)" }}
          aria-hidden
        />
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
      <TopAppNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/breaks" element={<BreakScheduler />} />
        <Route path="/shifts" element={<RouteErrorBoundary><ShiftScheduler /></RouteErrorBoundary>} />
        <Route path="/chat" element={<ChatDeepLink />} />
        <Route path="/crm" element={<DemoGate><CrmDashboard /></DemoGate>} />
        <Route path="/crm/:id" element={<DemoGate><CrmCustomerDetail /></DemoGate>} />
        <Route path="/remote-support" element={<DemoGate><RemoteSupportPage /></DemoGate>} />
        <Route
          path="/remote-support/recordings/play"
          element={<DemoGate><DemoRecordingPlayPage /></DemoGate>}
        />
        <Route path="/support/consent/:token" element={<DemoGate><RemoteSupportConsentPage /></DemoGate>} />
        <Route path="/support/screen/:sessionId" element={<DemoGate><ScreenShareGuestPage /></DemoGate>} />
        <Route path="/knowledge" element={<DemoGate><KnowledgePage /></DemoGate>} />
        <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
        <Route path="/admin/knowledge" element={<DemoGate><AdminGate><AdminKnowledge /></AdminGate></DemoGate>} />
        <Route path="/admin/shifts" element={<AdminGate><AdminShifts /></AdminGate>} />
        <Route path="/admin/users" element={<AdminGate><AdminUsers /></AdminGate>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <FloatingChatWidget />
      <FloatingKnowledgeWidget />
      <SoftphoneWidget />
      <AdminLocalhostLinksFloating />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LiveDataSync />
        <Router>
          <FloatingWidgetsLayerProvider>
            <ChatPanelProvider>
              <TelephonyProvider>
                <ChatUnreadProvider>
                  <AuthenticatedApp />
                </ChatUnreadProvider>
              </TelephonyProvider>
            </ChatPanelProvider>
          </FloatingWidgetsLayerProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
