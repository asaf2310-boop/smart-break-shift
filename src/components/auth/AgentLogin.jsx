import React, { useState } from "react";
import { Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabaseConfigured } from "@/api/supabase";
import {
  agentHasPendingPasswordReset,
  agentLoginWithPassword,
  agentRequestFirstLogin,
  agentRequestPasswordReset,
  agentSetupPassword,
  agentVerifyTemporaryPassword,
  canAgentAuthenticate,
  AGENT_AUTH_TIMEOUT_MSG,
  INVALID_CREDENTIALS_MSG,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MSG,
  passwordMinLengthInputProps,
  resolveAgentByEmail,
} from "@/lib/agentAuth";
import { demoModeEnabled } from "@/api/demoClient";
import { cn } from "@/lib/utils";
import {
  BRAND_SUBMIT_CLASS,
  DEMO_FIELD_CLASS,
  DEMO_SUBMIT_CLASS,
  Field,
  LoginShell,
} from "@/components/auth/LoginShell";

const MODES = {
  LOGIN: "login",
  SETUP: "setup",
  TEMP_VERIFY: "temp_verify",
  FORGOT: "forgot",
  FIRST_LOGIN: "first_login",
};

export default function AgentLogin({ onSuccess }) {
  if (demoModeEnabled) {
    return <DemoEmailLogin onSuccess={onSuccess} />;
  }
  return <ProdEmailLogin onSuccess={onSuccess} />;
}

function ProdEmailLogin({ onSuccess }) {
  return (
    <LoginShell subtitle="כניסת נציגים" hypCard>
      <EmailPasswordLogin onSuccess={onSuccess} variant="prod" />
    </LoginShell>
  );
}

function DemoEmailLogin({ onSuccess }) {
  return (
    <LoginShell subtitle="התחברות עם אימייל וסיסמה (דמו)" showDemoBadge hypCard>
      <EmailPasswordLogin onSuccess={onSuccess} variant="demo" />
    </LoginShell>
  );
}

function EmailPasswordLogin({ onSuccess, variant = "demo" }) {
  const isDemo = variant === "demo";
  const isProd = !isDemo;
  const fieldClass = isDemo
    ? DEMO_FIELD_CLASS
    : "login-demo-input w-full py-3 px-4 pr-10 text-right shadow-none";
  const submitClass = isDemo ? DEMO_SUBMIT_CLASS : BRAND_SUBMIT_CLASS;
  const errorClass = isDemo ? "text-red-300 login-error-message" : "login-error-message";
  const infoClass = isDemo ? "text-emerald-200" : "text-emerald-700";

  const [mode, setMode] = useState(isProd ? MODES.FIRST_LOGIN : MODES.LOGIN);
  const [emailStepDone, setEmailStepDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() =>
    isProd && !supabaseConfigured
      ? "Supabase לא מוגדר — בדוק VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ב-Vercel"
      : ""
  );
  const [info, setInfo] = useState("");
  const [firstLoginFlow, setFirstLoginFlow] = useState(isProd);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const goToReturningLogin = () => {
    setFirstLoginFlow(false);
    setMode(MODES.LOGIN);
    setPassword("");
    resetMessages();
  };

  const goToFirstLogin = () => {
    setFirstLoginFlow(true);
    setMode(MODES.FIRST_LOGIN);
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const handleProdLogin = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const result = await agentLoginWithPassword(email, password);
      if (!result.ok) {
        if (result.error === "needs_temp_password") {
          setFirstLoginFlow(true);
          setMode(MODES.TEMP_VERIFY);
          return;
        }
        if (result.error === "needs_password_setup") {
          setFirstLoginFlow(true);
          setMode(MODES.SETUP);
          return;
        }
        if (result.error === "needs_first_login") {
          goToFirstLogin();
          setInfo("הזן/י את האימייל ולחץ/י «המשך» — נשלח SMS לכניסה ראשונה.");
          return;
        }
        setError(result.message || INVALID_CREDENTIALS_MSG);
        return;
      }
      onSuccess?.(result.session);
    } catch {
      setError(AGENT_AUTH_TIMEOUT_MSG);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstLogin = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const result = await agentRequestFirstLogin(email);
      if (result.ok) {
        setInfo(result.message);
        setMode(MODES.TEMP_VERIFY);
        setPassword("");
      } else {
        setError(result.message || "לא הצלחנו לשלוח SMS. נסה/י שוב או פנה/י למנהל.");
      }
    } catch {
      setError(AGENT_AUTH_TIMEOUT_MSG);
    } finally {
      setLoading(false);
    }
  };

  const handleTempVerify = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const result = await agentVerifyTemporaryPassword(email, password);
      if (!result.ok) {
        setError(result.message || INVALID_CREDENTIALS_MSG);
        return;
      }
      setMode(MODES.SETUP);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError(AGENT_AUTH_TIMEOUT_MSG);
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
    } catch {
      setError(AGENT_AUTH_TIMEOUT_MSG);
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
        setFirstLoginFlow(false);
        setMode(MODES.TEMP_VERIFY);
        setPassword("");
      } else {
        setError(result.message || "לא הצלחנו לשלוח SMS. נסה/י שוב או פנה/י למנהל.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (mode === MODES.SETUP) {
    return (
      <form onSubmit={handleSetup} className="font-heebo space-y-1">
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-2">
          בחר/י סיסמה אישית לחשבון שלך (לפחות {PASSWORD_MIN_LENGTH} תווים).
        </p>
        <Field icon={Mail} label="אימייל">
          <Input
            type="email"
            value={email}
            readOnly
            className={cn(fieldClass, "text-muted-foreground")}
            dir="ltr"
          />
        </Field>
        <Field icon={Lock} label="סיסמה חדשה">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
            autoFocus
            {...passwordMinLengthInputProps()}
          />
        </Field>
        <Field icon={Lock} label="אימות סיסמה">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={fieldClass}
            required
            {...passwordMinLengthInputProps()}
          />
        </Field>
        {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "שומר..." : "שמירה וכניסה"}
        </button>
      </form>
    );
  }

  if (mode === MODES.TEMP_VERIFY) {
    return (
      <form onSubmit={handleTempVerify} className="font-heebo space-y-1">
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-2">
          הזן/י את הקוד שנשלח ב-SMS (6 ספרות). לאחר מכן תגדיר/י סיסמה אישית.
        </p>
        <Field icon={Mail} label="אימייל">
          <Input
            type="email"
            value={email}
            readOnly
            className={cn(fieldClass, "text-muted-foreground")}
            dir="ltr"
          />
        </Field>
        <Field icon={Lock} label="קוד מ-SMS">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </Field>
        {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}
        {info && <p className={`text-sm text-center ${infoClass}`}>{info}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "בודק..." : "המשך להגדרת סיסמה"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPassword("");
            resetMessages();
            if (firstLoginFlow) {
              setMode(MODES.FIRST_LOGIN);
            } else {
              setMode(MODES.FORGOT);
            }
          }}
          className="login-demo-link w-full text-sm mt-2"
        >
          לא קיבלתי SMS — שלח שוב
        </button>
      </form>
    );
  }

  if (mode === MODES.FORGOT) {
    return (
      <form onSubmit={handleForgot} className="font-heebo">
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-3">
          נשלח קוד זמני ב-SMS. לאחר האימות תגדיר/י סיסמה חדשה.
        </p>
        <Field icon={Mail} label="אימייל">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            required
            dir="ltr"
            autoFocus
          />
        </Field>
        {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}
        {info && <p className={`text-sm text-center ${infoClass}`}>{info}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "שולח..." : "שלח קוד ב-SMS"}
        </button>
        <button
          type="button"
          onClick={goToReturningLogin}
          className="login-demo-link w-full text-sm mt-2"
        >
          חזרה להתחברות
        </button>
      </form>
    );
  }

  if (isProd && mode === MODES.FIRST_LOGIN) {
    return (
      <form onSubmit={handleFirstLogin} className="font-heebo">
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-3">
          כניסה ראשונה — הזן/י את האימייל שרשם המנהל. נשלח SMS עם קוד אימות, ואז תבחר/י סיסמה
          אישית.
        </p>
        <Field icon={Mail} label="אימייל">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            required
            dir="ltr"
            autoFocus
          />
        </Field>
        {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}
        {info && <p className={`text-sm text-center ${infoClass}`}>{info}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "שולח..." : "המשך"}
        </button>
        <button
          type="button"
          onClick={goToReturningLogin}
          className="login-demo-link w-full text-sm mt-2"
        >
          יש לי כבר סיסמה — התחברות
        </button>
      </form>
    );
  }

  if (isProd && mode === MODES.LOGIN) {
    return (
      <form onSubmit={handleProdLogin} className="font-heebo">
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-3">
          התחברות לנציגים רשומים
        </p>
        <Field icon={Mail} label="אימייל">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            required
            dir="ltr"
            autoFocus
          />
        </Field>
        <Field icon={Lock} label="סיסמה">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}
        {info && <p className={`text-sm text-center ${infoClass}`}>{info}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "מתחבר..." : "כניסה"}
        </button>
        <div className="flex flex-col gap-2 text-center mt-2">
          <button type="button" onClick={goToFirstLogin} className="login-demo-link text-sm font-medium">
            כניסה ראשונה — הגדרת סיסמה
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
      </form>
    );
  }

  // Demo: legacy two-step flow
  const showPasswordField = emailStepDone;

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
      if (agentHasPendingPasswordReset(agent)) {
        setMode(MODES.TEMP_VERIFY);
        setPassword("");
        return;
      }
      if (agent.needsPasswordSetup) {
        setMode(MODES.SETUP);
        return;
      }
      setEmailStepDone(true);
    } catch {
      setError(AGENT_AUTH_TIMEOUT_MSG);
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
        setError(result.message || INVALID_CREDENTIALS_MSG);
        return;
      }
      onSuccess?.(result.session);
    } catch {
      setError(AGENT_AUTH_TIMEOUT_MSG);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={showPasswordField ? handleLogin : handleEmailContinue}
      className="font-heebo"
    >
      <Field icon={Mail} label="אימייל">
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailStepDone(false);
          }}
          className={fieldClass}
          required
          readOnly={showPasswordField}
          autoFocus
          dir="ltr"
        />
      </Field>
      {showPasswordField && (
        <Field icon={Lock} label="סיסמה">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
            autoFocus
          />
        </Field>
      )}
      {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}
      <button type="submit" disabled={loading} className={submitClass}>
        {loading ? "מתחבר..." : showPasswordField ? "כניסה" : "המשך"}
      </button>
    </form>
  );
}
