import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  KeyRound,
  Pencil,
  Plus,
  LayoutGrid,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import {
  adminSetManagedAgentPassword,
  createManagedAgent,
  deleteManagedAgent,
  isPlaceholderAgentEmail,
  listManagedAgents,
  setManagedAgentBlocked,
  updateManagedAgent,
  updateManagedAgentCrmRole,
  updateManagedAgentModules,
  formatCrmRoleLabel,
} from "@/lib/agentsApi";
import { CRM_ROLE_OPTIONS } from "@/lib/crmRoles";
import AgentModulesPicker from "@/components/admin/AgentModulesPicker";
import { formatModulesSummary, modulesForPicker } from "@/constants/agentModules";
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MSG } from "@/lib/agentAuth";
import { formatAgentPhoneDisplay, normalizeAgentPhone } from "@/lib/agentPhone";
import { demoModeEnabled } from "@/api/demoClient";
import ChatBrandingPanel from "@/components/admin/ChatBrandingPanel";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";

function formatEmail(email) {
  if (!email || isPlaceholderAgentEmail(email)) {
    return <span className="text-slate-400 italic">לא הוגדר — לחץ עריכה</span>;
  }
  return (
    <span dir="ltr" className="text-slate-600">
      {email}
    </span>
  );
}

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ password: "", forceSetup: true });
  const [modulesForm, setModulesForm] = useState([]);
  const [crmRoleForm, setCrmRoleForm] = useState("none");

  const { data: users = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["managed-agents"],
    queryFn: listManagedAgents,
    retry: 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["managed-agents"] });

  const createMutation = useMutation({
    mutationFn: () => createManagedAgent(form),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setForm({ email: "", name: "", phone: "" });
      toast({
        title: "נציג נוסף",
        description:
          "הנציג יגדיר סיסמה בכניסה הראשונה («כניסה ראשונה» במסך הכניסה). אין צורך להגדיר סיסמה כאן.",
      });
    },
    onError: (err) => {
      toast({
        title: "שגיאה",
        description:
          err.message === "email_exists"
            ? "אימייל כבר קיים"
            : err.message === "invalid_fields"
              ? "יש למלא שם ואימייל תקין"
              : "לא הצלחנו לשמור",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateManagedAgent(dialog.id, form),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "עודכן בהצלחה" });
    },
    onError: () => toast({ title: "שגיאה", description: "לא הצלחנו לעדכן", variant: "destructive" }),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      adminSetManagedAgentPassword(dialog.id, passwordForm.password, {
        forceSetup: passwordForm.forceSetup,
      }),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setPasswordForm({ password: "", forceSetup: true });
      toast({
        title: "סיסמה עודכנה",
        description: passwordForm.forceSetup
          ? "הנציג יידרש להגדיר סיסמה בכניסה הבאה"
          : "הסיסמה עודכנה ב-Supabase Auth",
      });
    },
    onError: (err) => {
      toast({
        title: "שגיאה",
        description:
          err.message === "password_too_short" ? PASSWORD_MIN_LENGTH_MSG : "לא הצלחנו לעדכן סיסמה",
        variant: "destructive",
      });
    },
  });

  const modulesMutation = useMutation({
    mutationFn: () => updateManagedAgentModules(dialog.id, modulesForm),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({
        title: "הרשאות עודכנו",
        description: "השינוי יחול בכניסה הבאה של הנציג (או לאחר התנתקות והתחברות מחדש)",
      });
    },
    onError: () =>
      toast({ title: "שגיאה", description: "לא הצלחנו לעדכן הרשאות", variant: "destructive" }),
  });

  const crmRoleMutation = useMutation({
    mutationFn: () => updateManagedAgentCrmRole(dialog.id, crmRoleForm),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({
        title: "תפקיד CRM עודכן",
        description: "השינוי יחול בכניסה הבאה של הנציג (או לאחר התנתקות והתחברות מחדש)",
      });
    },
    onError: () =>
      toast({ title: "שגיאה", description: "לא הצלחנו לעדכן תפקיד CRM", variant: "destructive" }),
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }) => setManagedAgentBlocked(id, blocked),
    onSuccess: (_, { blocked }) => {
      invalidate();
      toast({ title: blocked ? "הנציג נחסם" : "החסימה הוסרה" });
    },
    onError: () => toast({ title: "שגיאה", description: "לא הצלחנו לעדכן חסימה", variant: "destructive" }),
  });

  const phoneMutation = useMutation({
    mutationFn: ({ id, phone }) => updateManagedAgent(id, { phone }),
    onSuccess: () => {
      invalidate();
      toast({ title: "טלפון עודכן" });
    },
    onError: () =>
      toast({ title: "שגיאה", description: "לא הצלחנו לעדכן טלפון", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteManagedAgent(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "הנציג נמחק", description: "לא ניתן להתחבר עם האימייל" });
    },
    onError: (error) =>
      toast({
        title: "שגיאה",
        description: String(error?.message || "").trim() || "לא הצלחנו למחוק",
        variant: "destructive",
      }),
  });

  const openCreate = () => {
    setForm({ email: "", name: "", phone: "" });
    setDialog({ mode: "create" });
  };

  const openEdit = (user) => {
    const email = isPlaceholderAgentEmail(user.email) ? "" : user.email;
    setForm({
      email,
      name: user.name,
      phone: formatAgentPhoneDisplay(user.phone),
    });
    setDialog({ mode: "edit", id: user.id });
  };

  const saveInlinePhone = (user, rawValue) => {
    const next = normalizeAgentPhone(rawValue);
    const current = normalizeAgentPhone(user.phone);
    if (next === current) return;
    if (!next && !current) return;
    phoneMutation.mutate({ id: user.id, phone: rawValue });
  };

  const openPassword = (user) => {
    setPasswordForm({ password: "", forceSetup: true });
    setDialog({ mode: "password", id: user.id, userName: user.name });
  };

  const openModules = (user) => {
    setModulesForm(modulesForPicker(user.modules));
    setDialog({ mode: "modules", id: user.id, userName: user.name });
  };

  const openCrmRole = (user) => {
    setCrmRoleForm(user.crmRole || "none");
    setDialog({ mode: "crmRole", id: user.id, userName: user.name });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dialog.mode === "create") createMutation.mutate();
    else if (dialog.mode === "edit") updateMutation.mutate();
    else if (dialog.mode === "password") passwordMutation.mutate();
    else if (dialog.mode === "modules") modulesMutation.mutate();
    else if (dialog.mode === "crmRole") crmRoleMutation.mutate();
  };

  const statusBadge = (user) => {
    if (user.blocked) {
      return <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">חסום</span>;
    }
    if (user.needsPasswordSetup) {
      return <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ממתין לסיסמה</span>;
    }
    return <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">פעיל</span>;
  };

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={hypHeaderIconClass(
              "w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500"
            )}
          >
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">ניהול נציגים</h1>
            <p className="text-sm text-slate-500">
              אימיילים, סיסמאות וחסימה — כניסה עם אימייל ו-Supabase Auth
            </p>
          </div>
        </div>
        <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Link>
      </div>

      {demoModeEnabled && (
        <p className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          דמו: משתמשים ב-localStorage. חסימה/מחיקה מונעות התחברות עם הודעת שגיאה כללית.
        </p>
      )}

      {!demoModeEnabled && (
        <p className="mb-4 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
          בטעינה ראשונה הרשימה מתמלאת אוטומטית משמות הנציגים. ערכ/י אימייל וטלפון — הנציג יגדיר סיסמה בכניסה הראשונה.
        </p>
      )}

      <div className="mb-6">
        <ChatBrandingPanel />
      </div>

      <button
        type="button"
        onClick={openCreate}
        className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold shadow-md"
      >
        <UserPlus className="w-4 h-4" />
        הוספת נציג
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="text-right px-4 py-3 font-semibold">שם</th>
              <th className="text-right px-4 py-3 font-semibold">אימייל</th>
              <th className="text-right px-4 py-3 font-semibold">טלפון (SMS)</th>
              <th className="text-right px-4 py-3 font-semibold">מודולים</th>
              <th className="text-right px-4 py-3 font-semibold">תפקיד CRM</th>
              <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  טוען...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <p className="text-red-600 font-medium mb-2">
                    {error?.message === "agents_list_timeout"
                      ? "טעינת הנציגים נכשלה — בדוק חיבור ל-Supabase"
                      : "לא הצלחנו לטעון את רשימת הנציגים"}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="text-sm text-primary underline"
                  >
                    נסה שוב
                  </button>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  אין נציגים — הוסף/י ראשון או המתן לטעינה
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-t border-slate-100 ${user.blocked ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                  <td className="px-4 py-3">{formatEmail(user.email)}</td>
                  <td className="px-4 py-3">
                    <Input
                      key={`${user.id}-${user.phone || ""}`}
                      defaultValue={formatAgentPhoneDisplay(user.phone)}
                      onBlur={(e) => saveInlinePhone(user, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      placeholder="0501234567"
                      dir="ltr"
                      className="text-left text-xs h-8 max-w-[9rem] font-mono"
                      disabled={phoneMutation.isPending}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[10rem] leading-snug">
                    {formatModulesSummary(user.modules)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                    {formatCrmRoleLabel(user.crmRole)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(user)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end flex-wrap">
                      <button
                        type="button"
                        onClick={() => openCrmRole(user)}
                        className="p-2 rounded-lg hover:bg-sky-50 text-sky-700"
                        title="תפקיד CRM"
                        aria-label="תפקיד CRM"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openModules(user)}
                        className="p-2 rounded-lg hover:bg-violet-50 text-violet-700"
                        title="הרשאות מודולים"
                        aria-label="הרשאות"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openPassword(user)}
                        className="p-2 rounded-lg hover:bg-amber-50 text-amber-700"
                        title="איפוס סיסמה (מנהל)"
                        aria-label="איפוס סיסמה"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => blockMutation.mutate({ id: user.id, blocked: !user.blocked })}
                        className={`p-2 rounded-lg transition-colors ${user.blocked ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "hover:bg-red-50 text-red-600"}`}
                        title={user.blocked ? "ביטול חסימה" : "חסימה"}
                        aria-label={user.blocked ? "ביטול חסימה" : "חסימה"}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                        aria-label="עריכה"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`למחוק את ${user.name}? לא יוכל/תכול להתחבר.`)) {
                            deleteMutation.mutate(user.id);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                        aria-label="מחיקה"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-slate-600">
        <div className="flex items-center gap-2 mb-2 font-bold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          הוראות
        </div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>
            <strong>סיסמה</strong> — הנציג מגדיר בכניסה ראשונה (SMS). מנהל יכול לאפס סיסמה במקרה הצורך
          </li>
          <li>
            <strong>אימייל</strong> — נדרש לכניסה עם אימייל; בלי אימייל — כניסה בשם מהרשימה
          </li>
          <li>
            <strong>חסימה</strong> — הנציג נשאר ברשימה; התחברות נחסמת
          </li>
          <li>
            <strong>תפקיד CRM</strong> — ללא גישה / משתמש (חיפוש בסיסי) / נציג (דשבורד) / מנהל CRM (ניהול + דוחות)
          </li>
          <li>
            <strong>מודולים</strong> — בחר/י אילו מסכים יופיעו לנציג (למשל רק השתלטות מרחוק)
          </li>
          <li>
            <strong>טלפון</strong> — לשליחת SMS בפרסום שיבוץ ואיפוס סיסמה; עריכה ישירות בטבלה או בחלון עריכה
          </li>
        </ul>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={handleSubmit}
            className={`w-full bg-white rounded-3xl p-6 shadow-2xl ${dialog.mode === "modules" || dialog.mode === "crmRole" ? "max-w-lg" : "max-w-md"}`}
            dir="rtl"
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              {dialog.mode === "password" ? (
                <KeyRound className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {dialog.mode === "create" && "נציג חדש"}
              {dialog.mode === "edit" && "עריכת נציג"}
              {dialog.mode === "password" && `סיסמה — ${dialog.userName}`}
              {dialog.mode === "modules" && `הרשאות מודולים — ${dialog.userName}`}
              {dialog.mode === "crmRole" && `תפקיד CRM — ${dialog.userName}`}
            </h2>

            {dialog.mode === "modules" ? (
              <AgentModulesPicker value={modulesForm} onChange={setModulesForm} />
            ) : dialog.mode === "crmRole" ? (
              <div className="space-y-3">
                <label className="text-xs text-slate-500 mb-1 block">רמת גישה ל-CRM</label>
                <select
                  value={crmRoleForm}
                  onChange={(e) => setCrmRoleForm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  {CRM_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 leading-relaxed">
                  משתמש — חיפוש וצפייה בלקוחות. נציג — דשבורד פניות. מנהל CRM — ניהול CRM ודוחות (ללא גישה לשאר פאנל המנהל).
                </p>
              </div>
            ) : dialog.mode === "password" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">סיסמה חדשה</label>
                  <Input
                    type="password"
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    dir="ltr"
                    className="text-left font-mono"
                    autoComplete="off"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={passwordForm.forceSetup}
                    onChange={(e) =>
                      setPasswordForm((f) => ({ ...f, forceSetup: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  חייב שינוי סיסמה בכניסה הבאה (הגדרה ראשונה)
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">שם תצוגה</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="text-right"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">אימייל</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required={dialog.mode === "create"}
                    dir="ltr"
                    className="text-left"
                    placeholder="name@company.co.il"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">טלפון (SMS)</label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    dir="ltr"
                    className="text-left font-mono"
                    placeholder="0501234567"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  passwordMutation.isPending ||
                  modulesMutation.isPending ||
                  crmRoleMutation.isPending
                }
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold disabled:opacity-50"
              >
                שמירה
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </HypPageLayout>
  );
}
