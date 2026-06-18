import React, { useEffect, useState } from "react";
import { Loader2, Save, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiGetReviewSmsConfig, apiUpdateReviewSmsSettings } from "@/lib/agentAuthClient";

function formatSourceLabel(source) {
  if (source === "db") return "נשמר במערכת";
  if (source === "env_sms") return "משתנה סביבה GOOGLE_REVIEW_SMS_URL";
  if (source === "env_fallback") return "משתנה סביבה GOOGLE_REVIEW_URL";
  return null;
}

/** הגדרת קישור דירוג גוגל ל-SMS — דשבורד מנהל */
export default function ReviewSmsSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [settings, setSettings] = useState({
    smsUrl: null,
    dbUrl: null,
    dbUrlMasked: null,
    source: null,
    ok: false,
    message: null,
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await apiGetReviewSmsConfig();
      if (!result.ok && result.error === "unauthorized") {
        setSettings((prev) => ({ ...prev, message: result.message }));
        return;
      }
      setSettings({
        smsUrl: result.smsUrl || null,
        dbUrl: result.dbUrl || null,
        dbUrlMasked: result.dbUrlMasked || null,
        source: result.source || null,
        ok: Boolean(result.smsUrl),
        message: result.message || null,
      });
      setUrlInput(result.dbUrl || "");
    } catch {
      toast({ title: "שגיאה", description: "לא הצלחנו לטעון את הגדרות הקישור", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiUpdateReviewSmsSettings({ googleReviewSmsUrl: urlInput.trim() });
      if (!result.ok) {
        toast({
          title: "לא נשמר",
          description: result.message || "שמירת הקישור נכשלה",
          variant: "destructive",
        });
        return;
      }
      setSettings({
        smsUrl: result.smsUrl || null,
        dbUrl: result.dbUrl || null,
        dbUrlMasked: result.dbUrlMasked || null,
        source: result.source || "db",
        ok: Boolean(result.smsUrl),
        message: null,
      });
      setUrlInput(result.dbUrl || urlInput.trim());
      toast({ title: "נשמר", description: result.message || "קישור דירוג נשמר בהצלחה" });
    } catch {
      toast({ title: "שגיאה", description: "שמירת הקישור נכשלה", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = formatSourceLabel(settings.source);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6" dir="rtl">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white flex items-center justify-center shrink-0">
          <Star className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-lg font-extrabold text-slate-800">קישור דירוג גוגל ל-SMS</h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            קישור קצר שיישלח ללקוחות ב-SMS. מומלץ קישור{" "}
            <code className="text-xs" dir="ltr">
              g.page/r/…/review
            </code>{" "}
            — לא דומיין האפליקציה ולא /go/review.
          </p>
          {loading ? (
            <p className="mt-3 text-sm text-slate-400 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              טוען...
            </p>
          ) : (
            <div className="mt-3 space-y-1 text-sm">
              {settings.dbUrlMasked ? (
                <p className="text-slate-700">
                  קישור שמור:{" "}
                  <code className="text-xs font-mono bg-slate-50 px-1.5 py-0.5 rounded" dir="ltr">
                    {settings.dbUrlMasked}
                  </code>
                </p>
              ) : (
                <p className="text-amber-700">עדיין לא הוגדר קישור במערכת.</p>
              )}
              {settings.ok && settings.smsUrl && (
                <p className="text-slate-600">
                  יישלח בפועל:{" "}
                  <code className="text-xs font-mono" dir="ltr">
                    {settings.smsUrl}
                  </code>
                  {sourceLabel ? <span className="text-slate-400"> ({sourceLabel})</span> : null}
                </p>
              )}
              {!settings.ok && settings.message ? (
                <p className="text-amber-800 text-xs">{settings.message}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-3">
        <div>
          <label htmlFor="admin-review-sms-url" className="block text-sm font-semibold text-slate-700 mb-1.5">
            קישור דירוג גוגל ל-SMS
          </label>
          <input
            id="admin-review-sms-url"
            type="url"
            inputMode="url"
            dir="ltr"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="https://g.page/r/…/review"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={loading || saving}
          />
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            חייב להיות https, עד 120 תווים. אין צורך לעדכן Vercel — הנציגים יראו את הקישור מיד אחרי שמירה.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading || saving || !urlInput.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2.5 text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          שמור קישור
        </button>
      </form>
    </section>
  );
}
