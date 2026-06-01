import React, { useState } from "react";
import { ChevronDown, Lock, Mail, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getAgentNamesList } from "@/constants/scheduling";
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
    <LoginShell subtitle="בחר/י את שמך להמשך" brandHero>
      <form onSubmit={handleSubmit} className="space-y-4 font-heebo">
        <div className="relative login-demo-field">
          <label className="login-demo-field__label">שם נציג</label>
          <User className="login-demo-field__icon pointer-events-none z-10" aria-hidden />
          <ChevronDown
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10"
            style={{ color: "rgb(138 43 226 / 0.5)" }}
            aria-hidden
          />
          <Select value={selected || undefined} onValueChange={setSelected}>
            <SelectTrigger
              autoFocus
              className="login-demo-input w-full py-3 px-4 pr-10 pl-10 h-auto shadow-none text-right cursor-pointer [&>svg]:hidden"
            >
              <SelectValue placeholder="בחר/י שם..." />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              align="end"
              avoidCollisions={false}
              position="popper"
              className="z-[60] max-h-72 text-right"
            >
              {agentNames.map((name) => (
                <SelectItem key={name} value={name} className="text-right pr-8 pl-2">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <button type="submit" disabled={loading || !selected} className={BRAND_SUBMIT_CLASS}>
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
