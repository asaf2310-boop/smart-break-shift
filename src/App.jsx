import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppNav from '@/components/layout/AppNav';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthRequiredScreen from '@/components/AuthRequiredScreen';
import AppLoadError from '@/components/AppLoadError';
import AdminGate from '@/components/admin/AdminGate';
import ModuleGate from '@/components/auth/ModuleGate';
import DemoGate from '@/components/DemoGate';
import KnowledgeGate from '@/components/KnowledgeGate';
import CustomerChatGate from '@/components/CustomerChatGate';
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
import { ScreenShareSessionProvider } from '@/contexts/ScreenShareSessionContext';
import ChatRoute from './pages/ChatRoute';
import CustomerChatGuestPage from './pages/CustomerChatGuestPage';
import AgentCustomerChatPage from './pages/AgentCustomerChatPage';
import CrmDashboard from './pages/CrmDashboard';
import CrmCustomerDetail from './pages/CrmCustomerDetail';
import CrmLookupDeepLink from './pages/CrmLookupDeepLink';
import KnowledgePage from './pages/KnowledgePage';
import AdminKnowledge from './pages/AdminKnowledge';
import AdminCustomerChat from './pages/AdminCustomerChat';
import FloatingKnowledgeWidget from '@/components/knowledge/FloatingKnowledgeWidget';
import AdminLocalhostLinksFloating from '@/components/admin/AdminLocalhostLinksFloating';
import RemoteSupportConsentPage from './pages/RemoteSupportConsentPage';
import RemoteSupportPage from './pages/RemoteSupportPage';
import ScreenShareGuestPage from './pages/ScreenShareGuestPage';
import GuestJoinRedirectPage from './pages/GuestJoinRedirectPage';
import DemoRecordingPlayPage from './pages/DemoRecordingPlayPage';
import TrainingPage from './pages/TrainingPage';
import AdminTraining from './pages/AdminTraining';
import AdminRecordings from './pages/AdminRecordings';
import AdminMetrics from './pages/AdminMetrics';
import AgentMetricsPage from './pages/AgentMetricsPage';
import AgentMetricsRankingPage from './pages/AgentMetricsRankingPage';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import { hasTopAppNav } from '@/lib/appNavPaths';
import { brandVisualEnabled } from '@/lib/brandShell';
import { applyHypDemoDocumentClasses, hypDemoAppShellClass } from '@/lib/hypPage';
import { useEffect } from 'react';
import { useAgentSession } from '@/hooks/useAgentSession';

/** בודק בכל טעינה/מיקוד שהסשן תקף — מנתק מי שלא הגדיר סיסמה */
function AgentSessionGuard() {
  useAgentSession();
  return null;
}

function TopAppNav() {
  const { pathname } = useLocation();
  if (!hasTopAppNav(pathname)) return null;
  return <AppNav />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    applyHypDemoDocumentClasses();
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className={brandVisualEnabled ? "fixed inset-0 flex items-center justify-center hyp-scheduling-root" : "fixed inset-0 flex items-center justify-center m3-page"}>
        <div
          className={brandVisualEnabled ? "w-10 h-10 hyp-loader" : "w-10 h-10 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin"}
          style={brandVisualEnabled ? undefined : { boxShadow: "var(--brand-glow-purple)" }}
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
    <div className={hypDemoAppShellClass()}>
      <TopAppNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/breaks" element={<ModuleGate module="breaks"><BreakScheduler /></ModuleGate>} />
        <Route path="/shifts" element={<ModuleGate module="shifts"><RouteErrorBoundary><ShiftScheduler /></RouteErrorBoundary></ModuleGate>} />
        <Route path="/training" element={<ModuleGate module="training"><TrainingPage /></ModuleGate>} />
        <Route path="/metrics" element={<ModuleGate module="metrics"><AgentMetricsPage /></ModuleGate>} />
        <Route path="/metrics/ranking" element={<ModuleGate module="metrics"><AgentMetricsRankingPage /></ModuleGate>} />
        <Route path="/chat/guest" element={<CustomerChatGate><CustomerChatGuestPage /></CustomerChatGate>} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/customer-chat" element={<ModuleGate module="customer_chat"><CustomerChatGate><AgentCustomerChatPage /></CustomerChatGate></ModuleGate>} />
        <Route path="/crm" element={<ModuleGate module="crm"><DemoGate><CrmDashboard /></DemoGate></ModuleGate>} />
        <Route path="/crm/lookup" element={<ModuleGate module="crm"><DemoGate><CrmLookupDeepLink /></DemoGate></ModuleGate>} />
        <Route path="/crm/:id" element={<ModuleGate module="crm"><DemoGate><CrmCustomerDetail /></DemoGate></ModuleGate>} />
        <Route path="/remote-support" element={<ModuleGate module="remote_support"><RemoteSupportPage /></ModuleGate>} />
        <Route
          path="/remote-support/recordings/play"
          element={<DemoGate><DemoRecordingPlayPage /></DemoGate>}
        />
        <Route path="/j/:token" element={<RouteErrorBoundary><GuestJoinRedirectPage /></RouteErrorBoundary>} />
        <Route path="/support/consent/:token" element={<RouteErrorBoundary><RemoteSupportConsentPage /></RouteErrorBoundary>} />
        <Route path="/support/screen/:sessionId" element={<RouteErrorBoundary><ScreenShareGuestPage /></RouteErrorBoundary>} />
        <Route path="/knowledge" element={<ModuleGate module="knowledge"><KnowledgeGate><KnowledgePage /></KnowledgeGate></ModuleGate>} />
        <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
        <Route path="/admin/knowledge" element={<KnowledgeGate><AdminGate><AdminKnowledge /></AdminGate></KnowledgeGate>} />
        <Route path="/admin/customer-chat" element={<CustomerChatGate><AdminGate><AdminCustomerChat /></AdminGate></CustomerChatGate>} />
        <Route path="/admin/shifts" element={<AdminGate><AdminShifts /></AdminGate>} />
        <Route path="/admin/users" element={<AdminGate><AdminUsers /></AdminGate>} />
        <Route path="/admin/training" element={<AdminGate><AdminTraining /></AdminGate>} />
        <Route path="/admin/recordings" element={<AdminGate><AdminRecordings /></AdminGate>} />
        <Route path="/admin/metrics" element={<AdminGate><AdminMetrics /></AdminGate>} />
        <Route
          path="/admin/recordings/play"
          element={
            <AdminGate>
              <DemoRecordingPlayPage backTo="/admin/recordings" />
            </AdminGate>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <FloatingChatWidget />
      <FloatingKnowledgeWidget />
      <SoftphoneWidget />
      <AdminLocalhostLinksFloating />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LiveDataSync />
        <Router>
          <AgentSessionGuard />
          <FloatingWidgetsLayerProvider>
            <ChatPanelProvider>
              <TelephonyProvider>
                <ChatUnreadProvider>
                  <ScreenShareSessionProvider>
                    <AuthenticatedApp />
                  </ScreenShareSessionProvider>
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
