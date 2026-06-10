import React, { useCallback, useEffect, useState } from "react";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  X,
  Grid3x3,
  LayoutDashboard,
  User,
<<<<<<< HEAD
  UserPlus,
  ExternalLink,
  Building2,
=======
>>>>>>> 842dd9e (Initial commit)
} from "lucide-react";
import TelephonyStatusPicker from "@/components/telephony/TelephonyStatusPicker";
import TelephonyDashboardView from "@/components/telephony/TelephonyDashboardView";
import { SoftphoneDialGrid } from "@/components/telephony/SoftphoneDialPanel";
import {
  AGENT_TELEPHONY_STATUS,
  CALL_STATUS,
  getCenterStats,
  getStatusLabel,
  subscribeTelephony,
} from "@/lib/telephonyStore";
import { telephonyStatusDotClass } from "@/lib/telephonyStatus";
import { TELEPHONY_SIDEBAR_PANEL_CLASS } from "@/lib/floatingWidgetChrome";
import RemoteSupportPanel from "@/components/remote/RemoteSupportPanel";

function callStatusTone(status) {
  switch (status) {
    case CALL_STATUS.connected.value:
      return "bg-emerald-500";
    case CALL_STATUS.ringing.value:
    case CALL_STATUS.dialing.value:
      return "bg-amber-500 animate-pulse";
    default:
      return "bg-teal-500";
  }
}

<<<<<<< HEAD
const SIP_REG_LABELS = {
  idle: "לא מחובר",
  connecting: "מתחבר…",
  registered: "רשום ל-SIP",
  unregistered: "לא רשום",
  error: "שגיאת SIP",
};

export default function AgentTelephonySidebar({
  agentName,
  isDemo,
  isSip = false,
  provider,
  isHttpsRequired,
  sipRegistration = "idle",
  sipError = null,
  callError = null,
=======
export default function AgentTelephonySidebar({
  agentName,
  isDemo,
  provider,
  isHttpsRequired,
>>>>>>> 842dd9e (Initial commit)
  telephonyConnected,
  statusKey,
  onStatusChange,
  onDisconnect,
  onConnect,
  statusPending,
  active,
  inCall,
  inboundRinging,
  liveDuration,
  formatDuration,
  onAnswer,
  onHangup,
  onMute,
  number = "",
  onNumberChange,
  onDigit,
  onBackspace,
  dialOpen = false,
  onToggleDialPad,
  onCall,
  onSimulateInbound,
<<<<<<< HEAD
  onProductionCheck,
  onClose,
  crmCustomerId = null,
  crmCustomerName = null,
  screenPopCustomer = null,
  outboundMatch = null,
  onOpenCrm,
  onCreateCustomer,
=======
  onProductionStub,
  onClose,
  crmCustomerId = null,
  crmCustomerName = null,
>>>>>>> 842dd9e (Initial commit)
}) {
  const [panelView, setPanelView] = useState("personal");
  const [waitingCount, setWaitingCount] = useState(() => getCenterStats().waiting);
  const statusMeta = AGENT_TELEPHONY_STATUS[statusKey] || AGENT_TELEPHONY_STATUS.offline;
  const showDashboard = panelView === "dashboard";

  const refreshWaiting = useCallback(() => {
    setWaitingCount(getCenterStats().waiting);
  }, []);

  useEffect(() => subscribeTelephony(refreshWaiting), [refreshWaiting]);
  useEffect(() => {
    refreshWaiting();
  }, [refreshWaiting]);

  useEffect(() => {
    if (dialOpen) setPanelView("personal");
  }, [dialOpen]);

<<<<<<< HEAD
  const inboundCustomer =
    screenPopCustomer ||
    (active?.customer_id
      ? {
          id: active.customer_id,
          name: active.customer_name,
          company: active.customer_company,
        }
      : null);
  const inboundKnown = Boolean(inboundCustomer?.id);

=======
>>>>>>> 842dd9e (Initial commit)
  return (
    <div
      role="dialog"
      aria-label="סרגל טלפוניה"
      className={`pointer-events-auto w-[min(calc(100vw-2rem),300px)] min-w-[260px] ${TELEPHONY_SIDEBAR_PANEL_CLASS} flex flex-col bg-surface-container-lowest rounded-2xl border border-outline/20 shadow-elevation-3 overflow-hidden animate-in slide-in-from-bottom-2 fade-in-0 duration-200`}
      dir="rtl"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-outline/15 bg-gradient-to-l from-teal-600 to-emerald-600 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="w-5 h-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight">טלפוניה</p>
            <p className="text-[11px] text-white/85 truncate">
<<<<<<< HEAD
              {isDemo
                ? "דמו"
                : isSip
                  ? SIP_REG_LABELS[sipRegistration] || "SIP"
                  : provider === "twilio"
                    ? "Twilio"
                    : "SIP"}
=======
              {isDemo ? "דמו" : provider === "twilio" ? "Twilio" : "SIP"}
>>>>>>> 842dd9e (Initial commit)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/15"
          aria-label="סגור"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="shrink-0 flex gap-1 p-2 border-b border-outline/10 bg-surface-container-low/50">
        <button
          type="button"
          onClick={() => setPanelView("personal")}
          aria-pressed={!showDashboard}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-colors ${
            !showDashboard
              ? "bg-teal-600 text-white shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          שלי
        </button>
        <button
          type="button"
          onClick={() => setPanelView("dashboard")}
          aria-pressed={showDashboard}
          className={`relative flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-colors ${
            showDashboard
              ? "bg-teal-600 text-white shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          דשבורד
          {waitingCount > 0 && (
            <span
              className={`absolute -top-1 -left-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-extrabold tabular-nums flex items-center justify-center text-white shadow-sm ${
                !showDashboard ? "bg-amber-500 animate-pulse" : "bg-amber-600"
              }`}
              aria-label={`${waitingCount} ממתינות בתור`}
            >
              {waitingCount > 9 ? "9+" : waitingCount}
            </span>
          )}
        </button>
      </div>

      <div
        className={`p-3 space-y-3 ${
          showDashboard || dialOpen
            ? "flex-1 min-h-0 overflow-y-auto"
            : "overflow-visible shrink-0"
        }`}
      >
        {showDashboard ? (
          <TelephonyDashboardView agentName={agentName} isDemo={isDemo} />
        ) : (
          <>
        <section className="space-y-1.5">
          <p className="m3-label-medium text-on-surface-variant">זמינות נציג</p>
          {statusKey === AGENT_TELEPHONY_STATUS.offline.key ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${telephonyStatusDotClass(statusMeta.tone)}`}
                />
                {statusMeta.label}
              </div>
              <button
                type="button"
                onClick={onConnect}
                disabled={statusPending}
                className="h-10 rounded-full m3-btn-tonal text-sm font-bold"
              >
                התחבר
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <TelephonyStatusPicker
                value={statusKey}
                onChange={onStatusChange}
                disabled={statusPending}
              />
              <button
                type="button"
                onClick={onDisconnect}
                disabled={statusPending}
                className="w-full h-10 rounded-full m3-btn-outlined text-sm font-bold"
              >
                התנתק
              </button>
            </div>
          )}
        </section>

        {inboundRinging && active && (
          <section
            className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-elevation-1 animate-pulse"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 mb-2">
              <PhoneIncoming className="w-5 h-5 text-amber-700" />
              <span className="text-sm font-bold text-amber-900">שיחה נכנסת</span>
            </div>
<<<<<<< HEAD
            {inboundKnown ? (
              <>
                <p className="text-lg font-bold text-slate-900 leading-tight">
                  {inboundCustomer.name}
                </p>
                {inboundCustomer.company && (
                  <p className="text-sm text-slate-700 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    {inboundCustomer.company}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-amber-900">לקוח לא מצויע</p>
=======
            {active.customer_name && (
              <p className="text-lg font-bold text-slate-900 leading-tight">
                {active.customer_name}
              </p>
>>>>>>> 842dd9e (Initial commit)
            )}
            <p className="text-base font-mono font-semibold text-slate-800 mt-1" dir="ltr">
              {active.phone}
            </p>
<<<<<<< HEAD
            <div className="flex flex-col gap-2 mt-4">
              {inboundKnown ? (
                <button
                  type="button"
                  onClick={() => onOpenCrm?.(inboundCustomer.id)}
                  className="inline-flex w-full items-center justify-center gap-1.5 h-10 rounded-xl border border-teal-200 bg-white text-teal-800 text-sm font-bold hover:bg-teal-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  פתח כרטיס CRM
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCreateCustomer}
                  className="inline-flex w-full items-center justify-center gap-1.5 h-10 rounded-xl border border-teal-200 bg-white text-teal-800 text-sm font-bold hover:bg-teal-50"
                >
                  <UserPlus className="w-4 h-4" />
                  צור לקוח חדש
                </button>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onAnswer}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
                >
                  <PhoneCall className="w-4 h-4" />
                  מענה
                </button>
                <button
                  type="button"
                  onClick={onHangup}
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                  aria-label="דחייה"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
=======
            <div className="flex gap-2 mt-4 justify-end">
              <button
                type="button"
                onClick={onAnswer}
                className="inline-flex flex-1 items-center justify-center gap-1.5 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
              >
                <PhoneCall className="w-4 h-4" />
                מענה
              </button>
              <button
                type="button"
                onClick={onHangup}
                className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                aria-label="דחייה"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
>>>>>>> 842dd9e (Initial commit)
            </div>
          </section>
        )}

        {inCall && !inboundRinging && (
          <section className="rounded-2xl border border-outline/20 bg-surface-container-low p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${callStatusTone(active.status)}`} />
              <span className="text-sm font-bold text-foreground">
                {getStatusLabel(active.status)}
              </span>
              <span className="text-xs text-on-surface-variant">
                {active.direction === "inbound" ? "נכנסת" : "יוצאת"}
              </span>
            </div>
            {active.customer_name && (
              <p className="text-base font-bold text-foreground">{active.customer_name}</p>
            )}
<<<<<<< HEAD
            {active.customer_company && (
              <p className="text-sm text-on-surface-variant flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                {active.customer_company}
              </p>
            )}
            {active.customer_id && (
              <button
                type="button"
                onClick={() => onOpenCrm?.(active.customer_id)}
                className="mt-1 text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                פתח כרטיס CRM
              </button>
            )}
=======
>>>>>>> 842dd9e (Initial commit)
            <p className="text-lg font-mono font-semibold text-foreground" dir="ltr">
              {active.phone}
            </p>
            {active.status === CALL_STATUS.connected.value && (
              <p className="text-xs text-emerald-700 mt-1 font-mono" dir="ltr">
                {formatDuration(liveDuration)}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3 justify-end">
              {active.status === CALL_STATUS.connected.value && (
                <button
                  type="button"
                  onClick={onMute}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-outline/25 text-sm font-semibold hover:bg-surface-container-lowest"
                  aria-pressed={active.muted}
                >
                  {active.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {active.muted ? "מושתק" : "השתקה"}
                </button>
              )}
              <button
                type="button"
                onClick={onHangup}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
              >
                <PhoneOff className="w-4 h-4" />
                ניתוק
              </button>
            </div>
          </section>
        )}

        {!inCall && (
          <section className="space-y-1.5" aria-label="חיוג יוצא">
            <p className="m3-label-medium text-on-surface-variant">חיוג יוצא</p>
            <div className="flex flex-row gap-2 items-stretch">
<<<<<<< HEAD
              {(isDemo || (isSip && telephonyConnected)) && (
                <button
                  type="button"
                  onClick={onCall}
                  disabled={!String(number || "").trim() || (isSip && sipRegistration !== "registered")}
=======
              {isDemo && (
                <button
                  type="button"
                  onClick={onCall}
                  disabled={!String(number || "").trim()}
>>>>>>> 842dd9e (Initial commit)
                  aria-label="חיוג"
                  className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-l from-teal-600 to-emerald-600 text-white flex items-center justify-center hover:opacity-95 disabled:opacity-40 shadow-sm shadow-teal-500/20"
                >
                  <PhoneCall className="w-4 h-4" />
                </button>
              )}
              <input
                type="tel"
                value={number}
                onChange={(e) => onNumberChange?.(e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
                className="flex-1 min-w-0 rounded-xl border border-outline/30 bg-surface-container-low px-3 py-2 text-base font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                aria-label="מספר לחיוג"
              />
              <button
                type="button"
                onClick={onToggleDialPad}
                aria-expanded={dialOpen}
                aria-controls="softphone-dial-pad"
                aria-label={dialOpen ? "סגור לוח מקשים" : "פתח לוח מקשים"}
                className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                  dialOpen
                    ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                    : "border-outline/25 bg-surface-container-low text-foreground hover:bg-surface-container-high"
                }`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            </div>
<<<<<<< HEAD
            {outboundMatch && (
              <p className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {outboundMatch.name}
                  {outboundMatch.company ? ` · ${outboundMatch.company}` : ""}
                </span>
              </p>
            )}
=======
>>>>>>> 842dd9e (Initial commit)

            {dialOpen && (
              <div
                id="softphone-dial-pad"
                className="rounded-xl border border-outline/15 bg-surface-container-low/80 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-on-surface-variant">לוח מקשים</p>
                  <button
                    type="button"
                    onClick={onBackspace}
                    className="text-xs font-semibold text-on-surface-variant px-2 py-1 hover:text-foreground"
                  >
                    מחיקה
                  </button>
                </div>
                <SoftphoneDialGrid onDigit={onDigit} />
              </div>
            )}
          </section>
        )}

        {isDemo && !inCall && (
          <button
            type="button"
            onClick={onSimulateInbound}
            className="w-full h-10 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-teal-100"
          >
            <PhoneIncoming className="w-4 h-4" />
            שיחה נכנסת (דמו)
          </button>
        )}

        {crmCustomerId && (
          <RemoteSupportPanel
            agentName={agentName}
            crmCustomerId={crmCustomerId}
            customerName={crmCustomerName}
            compact
          />
        )}

        {!isDemo && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed">
<<<<<<< HEAD
            {isSip ? (
              <>
                חיוג WebRTC בדפדפן — לחצו «התחבר» להרשמה ל-SIP.
                {sipError && (
                  <span className="block mt-1 font-semibold text-red-800">{sipError}</span>
                )}
                {callError && (
                  <span className="block mt-1 text-teal-900">{callError}</span>
                )}
              </>
            ) : (
              <>חיוג אמיתי דורש SIP/Twilio, HTTPS ואישור IT.</>
            )}
=======
            חיוג אמיתי דורש SIP/Twilio, HTTPS ואישור IT.
>>>>>>> 842dd9e (Initial commit)
            {isHttpsRequired && (
              <span className="block mt-1 font-semibold">הדפדפן לא ב-HTTPS.</span>
            )}
            <button
              type="button"
<<<<<<< HEAD
              onClick={onProductionCheck}
              className="mt-2 text-xs font-semibold text-teal-800 underline"
            >
              בדיקת הגדרות SIP
=======
              onClick={onProductionStub}
              className="mt-2 text-xs font-semibold text-teal-800 underline"
            >
              בדיקת הגדרות (stub)
>>>>>>> 842dd9e (Initial commit)
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {isDemo && (
        <p className="text-[10px] text-center text-on-surface-variant px-3 pb-3 leading-relaxed shrink-0">
          סימולציה בלבד — ללא חיוג לרשת הציבורית
        </p>
      )}
    </div>
  );
}
