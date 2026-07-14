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
import CrmGate from '@/components/CrmGate';
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
import CrmNewReferral from './pages/CrmNewReferral';
import CrmCustomerDetail from './pages/CrmCustomerDetail';
import CrmLookupDeepLink from './pages/CrmLookupDeepLink';
import AiAgentPage from './pages/AiAgentPage';
import WealthyGuideLayout from '@/components/wealthy-guide/WealthyGuideLayout';
import WealthyGuideHome from './pages/wealthy-guide/WealthyGuideHome';
import ManualChargeGuide from './pages/wealthy-guide/ManualChargeGuide';
import PaymentLinkGuide from './pages/wealthy-guide/PaymentLinkGuide';
import TransactionDetailsGuide from './pages/wealthy-guide/TransactionDetailsGuide';
import ThreeDsSettingsGuide from './pages/wealthy-guide/ThreeDsSettingsGuide';
import WordPressPluginGuide from './pages/wealthy-guide/WordPressPluginGuide';
import ShvaErrorsGuide from './pages/wealthy-guide/ShvaErrorsGuide';
import ManualChargeGuestVideoPage from './pages/wealthy-guide/ManualChargeGuestVideoPage';
import ManualChargeGuestPdfPage from './pages/wealthy-guide/ManualChargeGuestPdfPage';
import PaymentLinkGuestVideoPage from './pages/wealthy-guide/PaymentLinkGuestVideoPage';
import PaymentLinkGuestPdfPage from './pages/wealthy-guide/PaymentLinkGuestPdfPage';
import TransactionDetailsGuestVideoPage from './pages/wealthy-guide/TransactionDetailsGuestVideoPage';
import TransactionDetailsGuestPdfPage from './pages/wealthy-guide/TransactionDetailsGuestPdfPage';
import ThreeDsSettingsGuestPdfPage from './pages/wealthy-guide/ThreeDsSettingsGuestPdfPage';
import WordPressPluginGuestPdfPage from './pages/wealthy-guide/WordPressPluginGuestPdfPage';
import ShvaErrorsGuestPdfPage from './pages/wealthy-guide/ShvaErrorsGuestPdfPage';
import WealthyGuideComingSoon from './pages/wealthy-guide/WealthyGuideComingSoon';
import AdminCustomerChat from './pages/AdminCustomerChat';
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
import AdminCrmDepartments from './pages/AdminCrmDepartments';
import AdminCrmRouting from './pages/AdminCrmRouting';
import AdminCrmDashboard from './pages/AdminCrmDashboard';
import AdminSecurityAudit from './pages/AdminSecurityAudit';
import AdminSmsStats from './pages/AdminSmsStats';
import AdminReviewSms from './pages/AdminReviewSms';
import AdminKnowledge from './pages/AdminKnowledge';
import AdminKnowledgePaymentGuide from './pages/AdminKnowledgePaymentGuide';
import AdminKnowledgeAiAgent from './pages/AdminKnowledgeAiAgent';
import AgentReviewSms from './pages/AgentReviewSms';
import AgentMetricsPage from './pages/AgentMetricsPage';
import AgentMetricsRankingPage from './pages/AgentMetricsRankingPage';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import { hasTopAppNav } from '@/lib/appNavPaths';
import { brandVisualEnabled } from '@/lib/brandShell';
import { applyHypDemoDocumentClasses, hypDemoAppShellClass } from '@/lib/hypPage';
import { useEffect } from 'react';
import { AgentSessionProvider } from '@/hooks/useAgentSession';
import { cn } from '@/lib/utils';

function TopAppNav() {
  const { pathname } = useLocation();
  if (!hasTopAppNav(pathname)) return null;
  return <AppNav />;
}

/** Offset for fixed AppNav — single place for all routed pages. */
function AppMain({ children }) {
  const { pathname } = useLocation();
  const showTopNav = hasTopAppNav(pathname);

  useEffect(() => {
    if (showTopNav) {
      document.documentElement.setAttribute('data-top-nav', '');
    } else {
      document.documentElement.removeAttribute('data-top-nav');
    }
  }, [showTopNav]);

  return (
    <main className={cn(showTopNav && 'pt-app-nav')}>
      {children}
    </main>
  );
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
      <AppMain>
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
        <Route path="/crm" element={<CrmGate require="access" deferHydration><RouteErrorBoundary><CrmDashboard /></RouteErrorBoundary></CrmGate>} />
        <Route path="/crm/new" element={<CrmGate require="agent"><RouteErrorBoundary><CrmNewReferral /></RouteErrorBoundary></CrmGate>} />
        <Route path="/crm/lookup" element={<CrmGate require="access"><RouteErrorBoundary><CrmLookupDeepLink /></RouteErrorBoundary></CrmGate>} />
        <Route path="/crm/:id" element={<CrmGate require="access"><RouteErrorBoundary><CrmCustomerDetail /></RouteErrorBoundary></CrmGate>} />
        <Route path="/remote-support" element={<ModuleGate module="remote_support"><RemoteSupportPage /></ModuleGate>} />
        <Route path="/review-sms" element={<ModuleGate module="google_review"><AgentReviewSms /></ModuleGate>} />
        <Route
          path="/remote-support/recordings/play"
          element={<DemoGate><DemoRecordingPlayPage /></DemoGate>}
        />
        <Route path="/j/:token" element={<RouteErrorBoundary><GuestJoinRedirectPage /></RouteErrorBoundary>} />
        <Route path="/guide/manual-charge/video" element={<RouteErrorBoundary><ManualChargeGuestVideoPage /></RouteErrorBoundary>} />
        <Route path="/guide/manual-charge/pdf" element={<RouteErrorBoundary><ManualChargeGuestPdfPage /></RouteErrorBoundary>} />
        <Route path="/guide/payment-link/video" element={<RouteErrorBoundary><PaymentLinkGuestVideoPage /></RouteErrorBoundary>} />
        <Route path="/guide/payment-link/pdf" element={<RouteErrorBoundary><PaymentLinkGuestPdfPage /></RouteErrorBoundary>} />
        <Route path="/guide/transaction-details/video" element={<RouteErrorBoundary><TransactionDetailsGuestVideoPage /></RouteErrorBoundary>} />
        <Route path="/guide/transaction-details/pdf" element={<RouteErrorBoundary><TransactionDetailsGuestPdfPage /></RouteErrorBoundary>} />
        <Route path="/guide/3ds-settings/pdf" element={<RouteErrorBoundary><ThreeDsSettingsGuestPdfPage /></RouteErrorBoundary>} />
        <Route path="/guide/wordpress-plugin/pdf" element={<RouteErrorBoundary><WordPressPluginGuestPdfPage /></RouteErrorBoundary>} />
        <Route path="/guide/shva-errors/pdf" element={<RouteErrorBoundary><ShvaErrorsGuestPdfPage /></RouteErrorBoundary>} />
        <Route path="/support/consent/:token" element={<RouteErrorBoundary><RemoteSupportConsentPage /></RouteErrorBoundary>} />
        <Route path="/support/screen/:sessionId" element={<RouteErrorBoundary><ScreenShareGuestPage /></RouteErrorBoundary>} />
        <Route path="/ai-agent" element={<ModuleGate module="ai_agent"><AiAgentPage /></ModuleGate>} />
        <Route path="/knowledge/wealthy-guide" element={<ModuleGate module="knowledge_guide"><KnowledgeGate><WealthyGuideLayout /></KnowledgeGate></ModuleGate>}>
          <Route index element={<WealthyGuideHome />} />
          <Route path="manual-charge" element={<ManualChargeGuide />} />
          <Route path="payment-link" element={<PaymentLinkGuide />} />
          <Route path="transaction-details" element={<TransactionDetailsGuide />} />
          <Route path="3ds-settings" element={<ThreeDsSettingsGuide />} />
          <Route path="wordpress-plugin" element={<WordPressPluginGuide />} />
          <Route path="shva-errors" element={<ShvaErrorsGuide />} />
          <Route path="*" element={<WealthyGuideComingSoon />} />
        </Route>
        <Route path="/knowledge" element={<Navigate to="/knowledge/wealthy-guide" replace />} />
        <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
        <Route path="/admin/customer-chat" element={<CustomerChatGate><AdminGate><AdminCustomerChat /></AdminGate></CustomerChatGate>} />
        <Route path="/admin/shifts" element={<AdminGate><AdminShifts /></AdminGate>} />
        <Route path="/admin/users" element={<AdminGate><AdminUsers /></AdminGate>} />
        <Route path="/admin/training" element={<AdminGate><AdminTraining /></AdminGate>} />
        <Route path="/admin/recordings" element={<AdminGate><AdminRecordings /></AdminGate>} />
        <Route path="/admin/metrics" element={<AdminGate><AdminMetrics /></AdminGate>} />
        <Route path="/admin/crm" element={<CrmGate require="admin"><RouteErrorBoundary><AdminCrmDashboard /></RouteErrorBoundary></CrmGate>} />
        <Route path="/admin/crm/departments" element={<CrmGate require="admin"><AdminCrmDepartments /></CrmGate>} />
        <Route path="/admin/crm/routing" element={<CrmGate require="admin"><AdminCrmRouting /></CrmGate>} />
        <Route path="/admin/security-audit" element={<AdminGate><AdminSecurityAudit /></AdminGate>} />
        <Route path="/admin/sms-stats" element={<AdminGate><AdminSmsStats /></AdminGate>} />
        <Route path="/admin/review-sms" element={<AdminGate><AdminReviewSms /></AdminGate>} />
        <Route path="/admin/knowledge" element={<AdminGate><AdminKnowledge /></AdminGate>}>
          <Route index element={<Navigate to="payment-guide" replace />} />
          <Route path="payment-guide" element={<AdminKnowledgePaymentGuide />} />
          <Route path="ai-agent" element={<AdminKnowledgeAiAgent />} />
        </Route>
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
      </AppMain>
      <FloatingChatWidget />
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
          <AgentSessionProvider>
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
          </AgentSessionProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
