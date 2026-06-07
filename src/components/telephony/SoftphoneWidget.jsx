import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone, X } from "lucide-react";
import { getStoredAgentName } from "@/constants/scheduling";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useTelephony } from "@/context/TelephonyContext";
import AgentTelephonySidebar from "@/components/telephony/AgentTelephonySidebar";
import CallDispositionModal from "@/components/telephony/CallDispositionModal";
import { getCustomerByPhone } from "@/lib/crmStore";
import {
  AGENT_TELEPHONY_STATUS,
  CALL_STATUS,
  connectAgentTelephonyAvailable,
  dismissCallDisposition,
  getActiveCall,
  getAgentTelephonyStatus,
  getPendingDisposition,
  hangUp,
  isAgentTelephonyConnected,
  setAgentTelephonyStatus,
  simulateInboundCall,
  startOutboundCall,
  submitCallDisposition,
  subscribeTelephony,
  telephonyDemoAvailable,
  toggleMute,
  answerInbound,
  bindSipTelephonyEvents,
  isRealSipEnabled,
} from "@/lib/telephonyStore";
import {
  connectProductionCall,
  getConfiguredProvider,
  getSipRegistrationState,
  getSipRegistrationError,
  isTelephonyConfigured,
  isHttpsRequired,
} from "@/lib/telephonyProvider";
import { PHONE_FLOAT_CHROME_CLASS } from "@/lib/floatingWidgetChrome";

const TOP_NAV_PATHS = new Set(["/breaks", "/shifts"]);

function formatDuration(sec) {
  if (!sec || sec < 1) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusTone(status) {
  switch (status) {
    case CALL_STATUS.connected.value:
      return "bg-emerald-500";
    case CALL_STATUS.ringing.value:
    case CALL_STATUS.dialing.value:
      return "bg-amber-500 animate-pulse";
    case CALL_STATUS.ended.value:
      return "bg-slate-400";
    default:
      return "bg-teal-500";
  }
}

export default function SoftphoneWidget() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hasTopNav = TOP_NAV_PATHS.has(pathname);
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const {
    sidebarOpen,
    dialOpen,
    toggleSoftphone,
    closeSoftphone,
    toggleDialPad,
    closeDialPad,
    pendingDial,
    clearPendingDial,
    openSoftphone,
  } = useTelephony();

  const remoteAudioRef = useRef(null);
  const showWidget = telephonyDemoAvailable() || isTelephonyConfigured();
  const isDemo = telephonyDemoAvailable();
  const isSip = isRealSipEnabled();
  const provider = getConfiguredProvider();

  const [number, setNumber] = useState("");
  const [crmMeta, setCrmMeta] = useState(null);
  const [active, setActive] = useState(() => getActiveCall());
  const [pendingDisposition, setPendingDisposition] = useState(() => getPendingDisposition());
  const [telephonyConnected, setTelephonyConnected] = useState(() =>
    isAgentTelephonyConnected()
  );
  const [statusKey, setStatusKey] = useState(() => getAgentTelephonyStatus(agentName));
  const [statusPending, setStatusPending] = useState(false);
  const [sipRegistration, setSipRegistration] = useState(() => getSipRegistrationState());
  const [sipError, setSipError] = useState(() => getSipRegistrationError());
  const [callError, setCallError] = useState(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setActive(getActiveCall());
    setPendingDisposition(getPendingDisposition());
    setTelephonyConnected(isAgentTelephonyConnected());
    setStatusKey(getAgentTelephonyStatus(agentName));
  }, [agentName]);

  useEffect(() => {
    if (isSip) {
      bindSipTelephonyEvents(remoteAudioRef.current);
    }
  }, [isSip]);

  useEffect(() => subscribeTelephony(refresh), [refresh]);

  useEffect(() => {
    if (!isSip) return undefined;
    const id = setInterval(() => {
      setSipRegistration(getSipRegistrationState());
      setSipError(getSipRegistrationError());
    }, 800);
    return () => clearInterval(id);
  }, [isSip]);
  useEffect(() => {
    refresh();
  }, [sidebarOpen, dialOpen, refresh]);

  useEffect(() => {
    const root = document.documentElement;
    if (sidebarOpen) {
      root.setAttribute("data-softphone-open", "");
    } else {
      root.removeAttribute("data-softphone-open");
    }
    return () => root.removeAttribute("data-softphone-open");
  }, [sidebarOpen]);

  useEffect(() => {
    if (!pendingDial?.phone) return;
    setNumber(pendingDial.phone);
    setCrmMeta({
      customerId: pendingDial.customerId,
      customerName: pendingDial.customerName,
    });
    clearPendingDial();
  }, [pendingDial, clearPendingDial]);

  useEffect(() => {
    if (active?.status !== CALL_STATUS.connected.value) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active?.status, active?.connected_at]);

  const inCall =
    active &&
    active.status !== CALL_STATUS.idle.value &&
    active.status !== CALL_STATUS.ended.value;

  const inboundRinging =
    inCall &&
    active.direction === "inbound" &&
    active.status === CALL_STATUS.ringing.value;

  useEffect(() => {
    if (!inboundRinging) return;
    openSoftphone();
  }, [inboundRinging, openSoftphone]);

  const screenPopCustomer = useMemo(() => {
    if (!inboundRinging || !active?.phone) return null;
    if (active.customer_id) {
      return {
        id: active.customer_id,
        name: active.customer_name,
        company: active.customer_company,
      };
    }
    const match = getCustomerByPhone(active.phone);
    if (!match) return null;
    return { id: match.id, name: match.name, company: match.company };
  }, [inboundRinging, active]);

  const outboundMatch = useMemo(() => {
    if (inCall || !String(number || "").trim()) return null;
    return getCustomerByPhone(number);
  }, [number, inCall]);

  useEffect(() => {
    if (!outboundMatch || inCall) return;
    setCrmMeta((prev) =>
      prev?.customerId === outboundMatch.id
        ? prev
        : {
            customerId: outboundMatch.id,
            customerName: outboundMatch.name,
          }
    );
  }, [outboundMatch, inCall]);

  const liveDuration = useMemo(() => {
    if (!active?.connected_at) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(active.connected_at).getTime()) / 1000));
  }, [active?.connected_at, tick]);

  if (!showWidget || !agentName) return null;

  const handleStatusChange = (e) => {
    const key = e.target.value;
    setStatusPending(true);
    setAgentTelephonyStatus(agentName, key);
    refresh();
    setStatusPending(false);
  };

  const handleDisconnect = () => {
    setStatusPending(true);
    setAgentTelephonyStatus(agentName, AGENT_TELEPHONY_STATUS.offline.key);
    refresh();
    setStatusPending(false);
  };

  const handleConnect = () => {
    setStatusPending(true);
    connectAgentTelephonyAvailable(agentName);
    refresh();
    setStatusPending(false);
  };

  const handleCall = async () => {
    setCallError(null);
    try {
      await startOutboundCall({
        phone: number,
        agentName,
        customer_id: crmMeta?.customerId,
        customer_name: crmMeta?.customerName,
      });
      refresh();
      closeDialPad();
    } catch (err) {
      setCallError(err?.message || "כשל בחיוג");
      refresh();
    }
  };

  const handleHangup = async () => {
    await hangUp();
    refresh();
  };

  const handleMute = async () => {
    await toggleMute();
    refresh();
  };

  const handleInboundDemo = () => {
    simulateInboundCall({
      agentName,
      phone: number || "050-1234567",
    });
    refresh();
  };

  const handleOpenCrm = (customerId) => {
    if (customerId) navigate(`/crm/${customerId}`);
  };

  const handleCreateCustomer = () => {
    const phone = active?.phone || number || "";
    navigate(`/crm?addphone=${encodeURIComponent(phone)}`);
  };

  const handleDispositionSubmit = (data) => {
    submitCallDisposition(data);
    refresh();
  };

  const handleDispositionDismiss = () => {
    dismissCallDisposition();
    refresh();
  };

  const handleAnswer = async () => {
    await answerInbound();
    refresh();
  };

  const handleProductionCheck = async () => {
    setCallError(null);
    const result = await connectProductionCall();
    if (!result.ok) {
      setCallError(result.reason);
    } else {
      setCallError(result.reason);
    }
  };

  const handleToggleMain = () => {
    if (sidebarOpen) {
      closeSoftphone();
    } else {
      toggleSoftphone();
    }
  };

  const handleToggleDialPad = () => toggleDialPad();

  return (
    <div className={PHONE_FLOAT_CHROME_CLASS} dir="ltr">
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" aria-hidden />
      <CallDispositionModal
        open={Boolean(pendingDisposition)}
        call={pendingDisposition}
        onSubmit={handleDispositionSubmit}
        onDismiss={handleDispositionDismiss}
      />
      {sidebarOpen && (
        <AgentTelephonySidebar
          agentName={agentName}
          isDemo={isDemo}
          isSip={isSip}
          provider={provider}
          isHttpsRequired={isHttpsRequired()}
          sipRegistration={sipRegistration}
          sipError={sipError}
          callError={callError}
          telephonyConnected={telephonyConnected}
          statusKey={statusKey}
          onStatusChange={handleStatusChange}
          onDisconnect={handleDisconnect}
          onConnect={handleConnect}
          statusPending={statusPending}
          active={active}
          inCall={inCall}
          inboundRinging={inboundRinging}
          liveDuration={liveDuration}
          formatDuration={formatDuration}
          onAnswer={handleAnswer}
          onHangup={handleHangup}
          onMute={handleMute}
          number={number}
          onNumberChange={setNumber}
          onDigit={(d) => setNumber((n) => `${n}${d}`)}
          onBackspace={() => setNumber((n) => n.slice(0, -1))}
          dialOpen={dialOpen && !inCall}
          onToggleDialPad={handleToggleDialPad}
          onCall={handleCall}
          onSimulateInbound={handleInboundDemo}
          onProductionCheck={handleProductionCheck}
          onClose={closeSoftphone}
          crmCustomerId={crmMeta?.customerId}
          crmCustomerName={crmMeta?.customerName}
          screenPopCustomer={screenPopCustomer}
          outboundMatch={outboundMatch}
          onOpenCrm={handleOpenCrm}
          onCreateCustomer={handleCreateCustomer}
        />
      )}

      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        {inCall && !sidebarOpen && (
          <span
            className={`w-3 h-3 rounded-full ring-2 ring-white shadow-sm ${statusTone(active.status)}`}
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={handleToggleMain}
          aria-expanded={sidebarOpen}
          aria-label={
            sidebarOpen ? "סגור טלפוניה" : inCall ? "פתח טלפוניה — בשיחה" : "פתח טלפוניה"
          }
          className={`relative w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ${
            inCall
              ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/40"
              : "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/40"
          }`}
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
        </button>
      </div>

      {hasTopNav && <span className="sr-only">ניווט עליון פעיל</span>}
    </div>
  );
}
