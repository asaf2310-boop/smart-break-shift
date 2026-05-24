import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Lock, Mail, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  agentLoginByDisplayName,
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
import { BRAND_LOGIN_HERO_SRC } from "@/components/brand/BrandLogo";
import { getAgentNamesList } from "@/constants/scheduling";
import { cn } from "@/lib/utils";

const MODES = {
  LOGIN: "login",
  SETUP: "setup",
  FORGOT: "forgot",
};

export default function AgentLogin({ onSuccess }) {
  if (!demoModeEnabled) {
    return <ProdNameLogin onSuccess={onSuccess} />;
  }
  return <DemoEmailLogin onSuccess={onSuccess} />;
}

function ProdNameLogin({ onSuccess }) {
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const agentNames = getAgentNamesList();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = agentLoginByDisplayName(selected);
      if (!result.ok) {
        setError(result.message || "יש לבחור שם מהרשימה");
        return;
      }
      onSuccess?.(result.session);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginShell subtitle="בחר/י את שמך להמשך" production>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            required
            autoFocus
            className="w-full rounded-2xl border border-input bg-white py-3 px-4 pr-10 pl-10 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-right appearance-none cursor-pointer"
          >
            <option value="" disabled>
              בחר/י שם...
            </option>
            {agentNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <button type="submit" disabled={loading || !selected} className="m3-btn-primary w-full py-3">
          {loading ? "נכנס..." : "כניסה למערכת"}
        </button>
      </form>
    </LoginShell>
  );
}

function DemoEmailLogin({ onSuccess }) {
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

  const subtitle =
    mode === MODES.SETUP
      ? "הגדרת סיסמה — כניסה ראשונה"
      : mode === MODES.FORGOT
        ? "שכחתי סיסמה"
        : "התחברות עם אימייל וסיסמה (דמו)";

  return (
    <LoginShell subtitle={subtitle} showDemoBadge demoHero>
      {mode === MODES.FORGOT ? (
        <form onSubmit={handleForgot}>
          <Field icon={Mail} label="אימייל">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={DEMO_FIELD_CLASS}
              required
              dir="ltr"
            />
          </Field>
          {error && <p className="text-sm text-red-300 text-center">{error}</p>}
          {info && <p className="text-sm text-emerald-200 text-center">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className={DEMO_SUBMIT_CLASS}
          >
            {loading ? "שולח..." : "שלח קישור לאיפוס"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(MODES.LOGIN);
              resetMessages();
            }}
            className="login-demo-link w-full text-sm"
          >
            חזרה להתחברות
          </button>
        </form>
      ) : mode === MODES.SETUP ? (
        <form onSubmit={handleSetup}>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            זו הכניסה הראשונה שלך. בחר/י סיסמה.
          </p>
          <Field icon={Mail} label="אימייל">
            <Input
              type="email"
              value={email}
              readOnly
              className={cn(DEMO_FIELD_CLASS, "text-muted-foreground")}
              dir="ltr"
            />
          </Field>
          <Field icon={Lock} label="סיסמה חדשה">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={DEMO_FIELD_CLASS}
              required
              {...passwordMinLengthInputProps()}
            />
          </Field>
          <Field icon={Lock} label="אימות סיסמה">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={DEMO_FIELD_CLASS}
              required
              {...passwordMinLengthInputProps()}
            />
          </Field>
          {error && <p className="text-sm text-red-300 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={DEMO_SUBMIT_CLASS}
          >
            {loading ? "שומר..." : "שמירה וכניסה"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(MODES.LOGIN);
              resetMessages();
            }}
            className="login-demo-link w-full text-sm"
          >
            יש לי כבר סיסמה
          </button>
        </form>
      ) : (
        <form onSubmit={emailStepDone ? handleLogin : handleEmailContinue}>
          <Field icon={Mail} label="אימייל">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailStepDone(false);
              }}
              className={DEMO_FIELD_CLASS}
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
                className={DEMO_FIELD_CLASS}
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
            className={DEMO_SUBMIT_CLASS}
          >
            {loading ? "מתחבר..." : emailStepDone ? "כניסה" : "המשך"}
          </button>
          {emailStepDone && (
            <div className="flex flex-col gap-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setEmailStepDone(false);
                  resetMessages();
                }}
                className="login-demo-link text-sm"
              >
                שינוי אימייל
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode(MODES.FORGOT);
                  resetMessages();
                }}
                className="login-demo-link text-sm"
              >
                שכחתי סיסמה
              </button>
            </div>
          )}
        </form>
      )}
    </LoginShell>
  );
}

const DEMO_FIELD_CLASS = "login-demo-input text-right";
const DEMO_SUBMIT_CLASS =
  "login-demo-submit w-full rounded-2xl font-semibold text-white tracking-wide disabled:opacity-50 transition-all duration-200";

function LoginShell({ subtitle, showDemoBadge, demoHero = false, production = false, children }) {
  return (
    <div
      className={cn(
        "login-shell",
        demoHero && "login-shell--demo login-hero-bg",
        production && "login-shell--prod m3-page"
      )}
      dir="rtl"
    >
      {!demoHero && (
        <h1
          className={cn(
            "relative z-10 text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-10 shrink-0",
            production ? "text-foreground" : "text-white"
          )}
        >
          כניסת נציג
        </h1>
      )}

      {demoHero && (
        <div className="login-shell__brand-zone logo-wrapper">
          <img
            src={BRAND_LOGIN_HERO_SRC}
            alt="AllInCenter — CONNECT • MANAGE • GROW"
            className="login-shell__hero-img"
            width={1024}
            height={682}
            decoding="async"
          />
        </div>
      )}

      <div
        className={cn(
          "login-shell__content",
          demoHero && "login-shell__content--demo"
        )}
      >
        <motion.div
          initial={
            demoHero
              ? false
              : typeof window !== "undefined" &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? false
                : { opacity: 0, scale: 0.96, y: 16 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: demoHero ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative z-10 w-full min-h-0",
            demoHero ? "login-shell__card-wrap" : "max-w-sm sm:max-w-md px-2"
          )}
        >
          <div
            className={cn(
              "login-shell__card w-full",
              demoHero ? "login-shell__card--demo login-card" : "p-5 sm:p-8"
            )}
          >
            <header className="login-shell__card-header">
              {demoHero ? (
                <h2 className="login-shell__title">{subtitle}</h2>
              ) : (
                <p
                  className={cn(
                    "login-shell__subtitle",
                    production ? "text-muted-foreground" : ""
                  )}
                >
                  {subtitle}
                </p>
              )}
              {showDemoBadge && (
                <span className="login-demo-badge" aria-label="סביבת דמו">
                  סביבת דמו
                </span>
              )}
            </header>
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div className="login-demo-field">
      <label className="login-demo-field__label">{label}</label>
      <div className="relative">
        <Icon className="login-demo-field__icon" aria-hidden />
        <div className="pr-10">{children}</div>
      </div>
    </div>
  );
}
