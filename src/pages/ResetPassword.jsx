import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/api/supabase";
import {
  completePasswordReset,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MSG,
  passwordMinLengthInputProps,
} from "@/lib/agentAuth";
import { demoModeEnabled } from "@/api/demoClient";

export default function ResetPassword() {
  if (!demoModeEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 px-4" dir="rtl">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-600 mb-4">איפוס סיסמה זמין רק בסביבת דמו.</p>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            חזרה לדף הראשי
          </Link>
        </div>
      </div>
    );
  }
  return <DemoResetPassword />;
}

function DemoResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(Boolean(session));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setReady(Boolean(session));
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_MIN_LENGTH_MSG);
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    const result = await completePasswordReset(password);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(result.message);
    setTimeout(() => navigate("/", { replace: true }), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 px-4" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Lock className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">איפוס סיסמה</h1>
        </div>

        {!ready ? (
          <p className="text-sm text-slate-500 text-center">
            פתח/י את הקישור מהמייל לאיפוס סיסמה. אם הקישור פג תוקף, בקש/י קישור חדש ממסך ההתחברות.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="סיסמה חדשה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-right"
              required
              {...passwordMinLengthInputProps()}
            />
            <Input
              type="password"
              placeholder="אימות סיסמה"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="text-right"
              required
              {...passwordMinLengthInputProps()}
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {success && <p className="text-sm text-emerald-600 text-center">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 disabled:opacity-50"
            >
              {loading ? "שומר..." : "עדכון סיסמה"}
            </button>
          </form>
        )}

        <Link to="/" className="block mt-6 text-center text-sm text-slate-500 hover:text-slate-800">
          חזרה להתחברות
        </Link>
      </div>
    </div>
  );
}
