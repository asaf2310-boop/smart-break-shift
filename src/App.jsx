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
import CustomerChatGate from '@/components/CustomerChatGate';import FloatingKnowledgeWidget from '@/components/knowledge/FloatingKnowledgeWidget';
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
          style={brandVisualEnabled ? undefined : { boxShadow: "var(--brand-glow-purple)" }}          aria-hidden
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
    <div className={hypDemoAppShellClass()}>      <TopAppNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/breaks" element={<BreakScheduler />} />
        <Route path="/shifts" element={<RouteErrorBoundary><ShiftScheduler /></RouteErrorBoundary>} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/metrics" element={<AgentMetricsPage />} />
        <Route path="/metrics/ranking" element={<AgentMetricsRankingPage />} />
        <Route path="/chat/guest" element={<CustomerChatGate><CustomerChatGuestPage /></CustomerChatGate>} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/customer-chat" element={<CustomerChatGate><AgentCustomerChatPage /></CustomerChatGate>} />
        <Route path="/crm" element={<DemoGate><CrmDashboard /></DemoGate>} />
        <Route path="/crm/lookup" element={<DemoGate><CrmLookupDeepLink /></DemoGate>} />
        <Route path="/crm/:id" element={<DemoGate><CrmCustomerDetail /></DemoGate>} />
        <Route path="/remote-support" element={<RemoteSupportPage />} />        <Route
          path="/remote-support/recordings/play"
          element={<DemoGate><DemoRecordingPlayPage /></DemoGate>}
        />
        <Route path="/j/:token" element={<GuestJoinRedirectPage />} />
        <Route path="/support/consent/:token" element={<RemoteSupportConsentPage />} />
        <Route path="/support/screen/:sessionId" element={<ScreenShareGuestPage />} />
        <Route path="/knowledge" element={<DemoGate><KnowledgePage /></DemoGate>} />
        <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
        <Route path="/admin/knowledge" element={<DemoGate><AdminGate><AdminKnowledge /></AdminGate></DemoGate>} />
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
        />        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <FloatingChatWidget />
      <FloatingKnowledgeWidget />
      <SoftphoneWidget />
      <AdminLocalhostLinksFloating />
    </div>  );
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
                  <ScreenShareSessionProvider>
                    <AuthenticatedApp />
                  </ScreenShareSessionProvider>                </ChatUnreadProvider>
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
