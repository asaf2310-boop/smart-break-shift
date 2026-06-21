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

/** הגדרת קישור דירוג גוגל ל-SMS — ניהול מנהל */
export default function ReviewSmsSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [settings, setSettings] = useState({
    smsUrl: null,
    dbUrl: null,
    dbUrlMasked: null,
    dbTargetUrl: null,
    dbTargetUrlMasked: null,
    source: null,
    ok: false,
    message: null,
    dbError: null,
    dbErrorMessage: null,
    shortened: false,
    shortenProvider: null,
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await apiGetReviewSmsConfig();
      if (result.error === "unauthorized") {
        setSettings((prev) => ({ ...prev, message: result.message }));
        return;
      }
      const configLoaded = result.template != null || result.maxLength != null;
      if (!configLoaded) {
        toast({ title: "שגיאה", description: result.message || "לא הצלחנו לטעון את הגדרות הקישור", variant: "destructive" });
        return;
      }
      setSettings({
        smsUrl: result.smsUrl || null,
        dbUrl: result.dbUrl || null,
        dbUrlMasked: result.dbUrlMasked || null,
        dbTargetUrl: result.dbTargetUrl || null,
        dbTargetUrlMasked: result.dbTargetUrlMasked || null,
        source: result.source || null,
        ok: Boolean(result.smsUrl),
        message: result.message || null,
        dbError: result.dbError || null,
        dbErrorMessage: result.dbErrorMessage || null,
        shortened: false,
        shortenProvider: null,
      });
      setUrlInput(result.dbTargetUrl || result.dbUrl || "");
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
        dbTargetUrl: result.dbTargetUrl || null,
        dbTargetUrlMasked: result.dbTargetUrlMasked || null,
        source: result.source || "db",
        ok: Boolean(result.smsUrl),
        message: null,
        dbError: result.dbError || null,
        dbErrorMessage: result.dbErrorMessage || null,
        shortened: Boolean(result.shortened),
        shortenProvider: result.shortenProvider || null,
      });
      setUrlInput(result.dbTargetUrl || urlInput.trim());
      toast({ title: "נשמר", description: result.message || "קישור דירוג נשמר בהצלחה" });
    } catch {
      toast({ title: "שגיאה", description: "שמירת הקישור נכשלה", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = formatSourceLabel(settings.source);
  const hasDistinctTarget =
    settings.dbTargetUrl && settings.dbUrl && settings.dbTargetUrl !== settings.dbUrl;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6" dir="rtl">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white flex items-center justify-center shrink-0">
          <Star className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-lg font-extrabold text-slate-800">קישור דירוג גוגל ל-SMS</h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            ניתן להדביק קישור גוגל ארוך — המערכת תקצר אותו אוטומטית לשליחה ב-SMS. מומלץ גם{" "}
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
                  קישור ל-SMS:{" "}
                  <code className="text-xs font-mono bg-slate-50 px-1.5 py-0.5 rounded" dir="ltr">
                    {settings.dbUrlMasked}
                  </code>
                </p>
              ) : (
                <p className="text-amber-700">עדיין לא הוגדר קישור במערכת.</p>
              )}
              {hasDistinctTarget && settings.dbTargetUrlMasked ? (
                <p className="text-slate-600 text-xs">
                  יעד מקורי:{" "}
                  <code className="font-mono bg-slate-50 px-1 rounded" dir="ltr">
                    {settings.dbTargetUrlMasked}
                  </code>
                </p>
              ) : null}
              {settings.ok && settings.smsUrl && (
                <p className="text-slate-600">
                  יישלח בפועל:{" "}
                  <code className="text-xs font-mono" dir="ltr">
                    {settings.smsUrl}
                  </code>
                  {sourceLabel ? <span className="text-slate-400"> ({sourceLabel})</span> : null}
                </p>
              )}
              {settings.shortened ? (
                <p className="text-emerald-800 text-xs font-medium rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  קוצר אוטומטית{settings.shortenProvider ? ` (${settings.shortenProvider})` : ""} — הקישור הקצר יישלח ב-SMS.
                </p>
              ) : null}
              {!settings.ok && settings.message ? (
                <p className="text-amber-800 text-xs">{settings.message}</p>
              ) : null}
              {settings.dbError === "app_settings_missing" && settings.dbErrorMessage ? (
                <p className="text-amber-900 text-xs font-medium rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed">
                  {settings.dbErrorMessage}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-3">
        <div>
          <label htmlFor="admin-review-sms-url" className="block text-sm font-semibold text-slate-700 mb-1.5">
            קישור דירוג גוגל
          </label>
          <input
            id="admin-review-sms-url"
            type="url"
            inputMode="url"
            dir="ltr"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="https://g.page/r/…/review או קישור גוגל ארוך"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={loading || saving}
          />
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            חייב להיות https. קישורים ארוכים מ-120 תווים יקוצרו אוטומטית (is.gd / TinyURL) לפני שליחה ב-SMS.
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
