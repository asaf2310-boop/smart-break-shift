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
  UserPlus,
  ExternalLink,
  Building2,  telephonyConnected,
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
  onProductionCheck,
  onClose,
  crmCustomerId = null,
  crmCustomerName = null,
  screenPopCustomer = null,
  outboundMatch = null,
  onOpenCrm,
  onCreateCustomer,}) {
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
              <p className="text-sm font-semibold text-amber-900">לקוח לא מצויע</p>            )}
            <p className="text-base font-mono font-semibold text-slate-800 mt-1" dir="ltr">
              {active.phone}
            </p>
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
              </div>            </div>
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
            )}                  aria-label="חיוג"
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
            {outboundMatch && (
              <p className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {outboundMatch.name}
                  {outboundMatch.company ? ` · ${outboundMatch.company}` : ""}
                </span>
              </p>
            )}            {isHttpsRequired && (
              <span className="block mt-1 font-semibold">הדפדפן לא ב-HTTPS.</span>
            )}
            <button
              type="button"
              onClick={onProductionCheck}
              className="mt-2 text-xs font-semibold text-teal-800 underline"
            >
              בדיקת הגדרות SIP            </button>
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
