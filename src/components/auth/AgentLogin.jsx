<<<<<<< HEAD
﻿import React, { useState } from "react";

import { Lock, Mail } from "lucide-react";

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

  if (demoModeEnabled) {

    return <DemoEmailLogin onSuccess={onSuccess} />;

  }

  return <ProdEmailLogin onSuccess={onSuccess} />;

}



function ProdEmailLogin({ onSuccess }) {

  return (

    <LoginShell subtitle="התחברות עם אימייל וסיסמה" hypCard>

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

  const fieldClass = isDemo ? DEMO_FIELD_CLASS : "login-demo-input w-full py-3 px-4 pr-10 text-right shadow-none";

  const submitClass = isDemo ? DEMO_SUBMIT_CLASS : BRAND_SUBMIT_CLASS;

  const errorClass = isDemo ? "text-red-300" : "text-destructive";

  const infoClass = isDemo ? "text-emerald-200" : "text-emerald-700";



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



  if (mode === MODES.FORGOT) {

    return (

      <form onSubmit={handleForgot} className="font-heebo">

        <Field icon={Mail} label="אימייל">

          <Input

            type="email"

            value={email}

            onChange={(e) => setEmail(e.target.value)}

            className={fieldClass}

            required

            dir="ltr"

          />

        </Field>

        {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}

        {info && <p className={`text-sm text-center ${infoClass}`}>{info}</p>}

        <button type="submit" disabled={loading} className={submitClass}>

          {loading ? "שולח..." : "שלח קישור לאיפוס"}

        </button>

        <button

          type="button"

          onClick={() => {

            setMode(MODES.LOGIN);

            resetMessages();

          }}

          className="login-demo-link w-full text-sm mt-2"

        >

          חזרה להתחברות

        </button>

      </form>

    );

  }



  if (mode === MODES.SETUP) {

    return (

      <form onSubmit={handleSetup} className="font-heebo space-y-1">

        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-2">

          זו הכניסה הראשונה שלך. בחר/י סיסמה — רק מנהל יוכל לשנות אותה לאחר מכן.

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



  return (

    <form

      onSubmit={emailStepDone ? handleLogin : handleEmailContinue}

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

            className={fieldClass}

            required

            autoFocus

          />

        </Field>

      )}

      {error && <p className={`text-sm text-center ${errorClass}`}>{error}</p>}

      {info && <p className={`text-sm text-center ${infoClass}`}>{info}</p>}

      <button type="submit" disabled={loading} className={submitClass}>

        {loading ? "מתחבר..." : emailStepDone ? "כניסה" : "המשך"}

      </button>

      {emailStepDone && isDemo && (

        <div className="flex flex-col gap-2 text-center mt-2">

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

      {emailStepDone && !isDemo && (

        <button

          type="button"

          onClick={() => {

            setEmailStepDone(false);

            resetMessages();

          }}

          className="login-demo-link w-full text-sm mt-2"

        >

          שינוי אימייל

        </button>

      )}

    </form>

  );

}


=======
﻿import React, { useState } from "react";
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
    <LoginShell subtitle="בחר/י את שמך להמשך" production>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <Select value={selected || undefined} onValueChange={setSelected}>
            <SelectTrigger
              autoFocus
              className="w-full rounded-2xl border border-input bg-white py-3 px-4 pr-10 pl-10 h-auto shadow-none text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 text-right cursor-pointer [&>svg]:hidden"
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
>>>>>>> 842dd9e (Initial commit)
