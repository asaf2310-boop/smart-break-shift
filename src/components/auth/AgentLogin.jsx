import React, { useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  agentLoginWithPassword,
  agentRequestPasswordReset,
  agentSetupPassword,
  canAgentAuthenticate,
  INVALID_CREDENTIALS_MSG,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MSG,
  passwordMinLengthInputProps,
  resolveAgentByEmail,
} from "@/lib/agentAuth";
import { demoModeEnabled } from "@/api/demoClient";

const MODES = {
  LOGIN: "login",
  SETUP: "setup",
  FORGOT: "forgot",
};

export default function AgentLogin({ onSuccess }) {
  const [mode, setMode] = useState(MODES.LOGIN);
  const [emailStepDone, setEmailStepDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const handleEmailContinue = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const agent = await resolveAgentByEmail(email);
      if (!canAgentAuthenticate(agent)) {
        setError(INVALID_CREDENTIALS_MSG);
        return;
      }
      if (agent.needsPasswordSetup) {
        setMode(MODES.SETUP);
        setPassword("");
        setConfirmPassword("");
        setEmailStepDone(false);
      } else {
        setMode(MODES.LOGIN);
        setEmailStepDone(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const result = await agentLoginWithPassword(email, password);
      if (!result.ok) {
        if (result.error === "needs_password_setup") {
          setMode(MODES.SETUP);
          return;
        }
        setError(result.message || INVALID_CREDENTIALS_MSG);
        return;
      }
      onSuccess?.(result.session);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    resetMessages();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_MIN_LENGTH_MSG);
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    try {
      const result = await agentSetupPassword(email, password);
      if (!result.ok) {
        setError(result.message || INVALID_CREDENTIALS_MSG);
        return;
      }
      onSuccess?.(result.session);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const result = await agentRequestPasswordReset(email);
      if (result.ok) {
        setInfo(result.message);
      } else {
        setInfo("אם האימייל ברשימה, נשלח קישור לאיפוס. בדוק את תיבת הדואר.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-4">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm sm:max-w-md"
        dir="rtl"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-5 sm:p-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg">
              <CalendarClock className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">מערכת הפסקות ומשמרות</h1>
              <p className="text-white/60 text-sm mt-1">
                {mode === MODES.SETUP && "הגדרת סיסמה — כניסה ראשונה"}
                {mode === MODES.FORGOT && "שכחתי סיסמה"}
                {mode === MODES.LOGIN && "התחברות עם אימייל וסיסמה"}
              </p>
            </div>
            {demoModeEnabled && (
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full">
                סביבת דמו
              </span>
            )}
          </div>

          {mode === MODES.FORGOT ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <Field icon={Mail} label="אימייל">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white text-right"
                  required
                  dir="ltr"
                />
              </Field>
              {error && <p className="text-sm text-red-300 text-center">{error}</p>}
              {info && <p className="text-sm text-emerald-200 text-center">{info}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 disabled:opacity-50"
              >
                {loading ? "שולח..." : "שלח קישור לאיפוס"}
              </button>
              <button type="button" onClick={() => { setMode(MODES.LOGIN); resetMessages(); }} className="w-full text-sm text-white/60 hover:text-white">
                חזרה להתחברות
              </button>
            </form>
          ) : mode === MODES.SETUP ? (
            <form onSubmit={handleSetup} className="space-y-4">
              <p className="text-sm text-white/70 text-center">זו הכניסה הראשונה שלך. בחר/י סיסמה.</p>
              <Field icon={Mail} label="אימייל">
                <Input type="email" value={email} readOnly className="bg-white/5 border-white/10 text-white/80 text-right" dir="ltr" />
              </Field>
              <Field icon={Lock} label="סיסמה חדשה">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white text-right"
                  required
                  {...passwordMinLengthInputProps()}
                />
              </Field>
              <Field icon={Lock} label="אימות סיסמה">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white text-right"
                  required
                  {...passwordMinLengthInputProps()}
                />
              </Field>
              {error && <p className="text-sm text-red-300 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 disabled:opacity-50"
              >
                {loading ? "שומר..." : "שמירה וכניסה"}
              </button>
              <button type="button" onClick={() => { setMode(MODES.LOGIN); resetMessages(); }} className="w-full text-sm text-white/60 hover:text-white">
                יש לי כבר סיסמה
              </button>
            </form>
          ) : (
            <form onSubmit={emailStepDone ? handleLogin : handleEmailContinue} className="space-y-4">
              <Field icon={Mail} label="אימייל">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailStepDone(false); }}
                  className="bg-white/10 border-white/20 text-white text-right"
                  required
                  readOnly={emailStepDone}
                  autoFocus
                  dir="ltr"
                />
              </Field>
              {emailStepDone && (
                <Field icon={Lock} label="סיסמה">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/10 border-white/20 text-white text-right"
                    required
                    autoFocus
                  />
                </Field>
              )}
              {error && <p className="text-sm text-red-300 text-center">{error}</p>}
              {info && <p className="text-sm text-emerald-200 text-center">{info}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 disabled:opacity-50"
              >
                {loading ? "מתחבר..." : emailStepDone ? "כניסה" : "המשך"}
              </button>
              {emailStepDone && (
                <div className="flex flex-col gap-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setEmailStepDone(false); resetMessages(); }}
                    className="text-sm text-white/60 hover:text-white"
                  >
                    שינוי אימייל
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode(MODES.FORGOT); resetMessages(); }}
                    className="text-sm text-white/60 hover:text-white"
                  >
                    שכחתי סיסמה
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1 pr-1">{label}</label>
      <div className="relative">
        <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        <div className="pr-10">{children}</div>
      </div>
    </div>
  );
}
