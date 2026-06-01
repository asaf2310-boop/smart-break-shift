import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Ban, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import {
  createManagedAgent,
  deleteManagedAgent,
  listManagedAgents,
  setManagedAgentBlocked,
  updateManagedAgent,
} from "@/lib/agentsApi";
import { demoModeEnabled } from "@/api/demoClient";
import ChatBrandingPanel from "@/components/admin/ChatBrandingPanel";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ email: "", name: "" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managed-agents"],
    queryFn: listManagedAgents,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["managed-agents"] });

  const createMutation = useMutation({
    mutationFn: () => createManagedAgent(form),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setForm({ email: "", name: "" });
      toast({ title: "נציג נוסף", description: "הנציג יוכל להתחבר עם האימייל ולהגדיר סיסמה בכניסה הראשונה" });
    },
    onError: (err) => {
      toast({
        title: "שגיאה",
        description: err.message === "email_exists" ? "אימייל כבר קיים" : "לא הצלחנו לשמור",
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

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }) => setManagedAgentBlocked(id, blocked),
    onSuccess: (_, { blocked }) => {
      invalidate();
      toast({ title: blocked ? "הנציג נחסם" : "החסימה הוסרה" });
    },
    onError: () => toast({ title: "שגיאה", description: "לא הצלחנו לעדכן חסימה", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteManagedAgent(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "הנציג נמחק", description: "לא ניתן להתחבר עם האימייל" });
    },
    onError: () => toast({ title: "שגיאה", description: "לא הצלחנו למחוק", variant: "destructive" }),
  });

  const openCreate = () => {
    setForm({ email: "", name: "" });
    setDialog({ mode: "create" });
  };

  const openEdit = (user) => {
    setForm({ email: user.email, name: user.name });
    setDialog({ mode: "edit", id: user.id });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dialog.mode === "create") createMutation.mutate();
    else updateMutation.mutate();
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
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-3xl px-4 py-8">
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
              <p className="text-sm text-slate-500">הוספה, חסימה ומחיקה — כניסה רק לנציגים פעילים</p>
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

        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-right px-4 py-3 font-semibold">שם</th>
                <th className="text-right px-4 py-3 font-semibold">אימייל</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">טוען...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">אין נציגים — הוסף/י ראשון</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={`border-t border-slate-100 ${user.blocked ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                    <td className="px-4 py-3 text-slate-600" dir="ltr">{user.email}</td>
                    <td className="px-4 py-3">{statusBadge(user)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => blockMutation.mutate({ id: user.id, blocked: !user.blocked })}
                          className={`p-2 rounded-lg transition-colors ${user.blocked ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "hover:bg-red-50 text-red-600"}`}
                          title={user.blocked ? "ביטול חסימה" : "חסימה"}
                          aria-label={user.blocked ? "ביטול חסימה" : "חסימה"}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => openEdit(user)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="עריכה">
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
            <li><strong>חסימה</strong> — הנציג נשאר ברשימה; ניתן לבטל חסימה; התחברות נחסמת</li>
            <li><strong>מחיקה</strong> — הנציג יוסר מהרשימה; לא ניתן להתחבר</li>
            <li>בניסיון התחברות: תמיד מוצגת הודעה כללית — אימייל או סיסמה שגויים</li>
          </ul>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
            dir="rtl"
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {dialog.mode === "create" ? "נציג חדש" : "עריכת נציג"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">שם תצוגה</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="text-right" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">אימייל</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setDialog(null)} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold">
                ביטול
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
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
