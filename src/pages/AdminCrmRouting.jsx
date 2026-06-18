import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, Plus, Save, Trash2 } from "lucide-react";
import { getAgentNamesList } from "@/constants/scheduling";
import { REFERRAL_TOPICS } from "@/lib/crmStore";
import { listCrmDepartments, subscribeCrmDepartments } from "@/lib/crmDepartments";
import {
  createCrmRoutingRule,
  deleteCrmRoutingRule,
  listCrmRoutingRules,
  subscribeCrmRoutingRules,
  updateCrmRoutingRule,
} from "@/lib/crmRoutingRules";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { cn } from "@/lib/utils";

function slugifyRuleId(topic) {
  return `rule_${String(topic || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_")}`;
}

export default function AdminCrmRouting() {
  const { toast } = useToast();
  const [rules, setRules] = useState(() => listCrmRoutingRules());
  const [departments, setDepartments] = useState(() => listCrmDepartments());
  const [newTopic, setNewTopic] = useState(REFERRAL_TOPICS[0] || "");
  const [newType, setNewType] = useState("department");
  const [newDept, setNewDept] = useState("");
  const [newAgent, setNewAgent] = useState("");
  const agents = useMemo(() => getAgentNamesList(), []);

  useEffect(() => {
    const refreshRules = () => setRules(listCrmRoutingRules());
    const refreshDepts = () => {
      const depts = listCrmDepartments();
      setDepartments(depts);
      if (!newDept && depts[0]) setNewDept(depts[0].id);
    };
    refreshRules();
    refreshDepts();
    const unsubRules = subscribeCrmRoutingRules(refreshRules);
    const unsubDepts = subscribeCrmDepartments(refreshDepts);
    return () => {
      unsubRules();
      unsubDepts();
    };
  }, [newDept]);

  useEffect(() => {
    if (!newAgent && agents[0]) setNewAgent(agents[0]);
  }, [agents, newAgent]);

  const handleCreate = () => {
    const topic = String(newTopic || "").trim();
    if (!topic) return;
    try {
      createCrmRoutingRule({
        id: slugifyRuleId(topic),
        referral_topic: topic,
        assigned_to_type: newType,
        assigned_department_id: newType === "department" ? newDept : null,
        assigned_agent_name: newType === "agent" ? newAgent : null,
      });
      toast({ title: "כלל נוסף", description: `${topic} → שיוך אוטומטי` });
    } catch (err) {
      toast({ title: "לא ניתן להוסיף", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = (rule) => {
    deleteCrmRoutingRule(rule.id);
    toast({ title: "כלל נמחק", description: rule.referral_topic });
  };

  const handleSave = (rule) => {
    try {
      updateCrmRoutingRule(rule.id, rule);
      toast({ title: "כלל נשמר", description: rule.referral_topic });
    } catch (err) {
      toast({ title: "שמירה נכשלה", description: err.message, variant: "destructive" });
    }
  };

  const updateLocalRule = (id, patch) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/crm" className="text-sm text-slate-500 hover:text-slate-700">
          חזרה לדשבורד CRM
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 inline-flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          כללי ניתוב אוטומטי
        </h1>
      </div>

      <p className="text-sm text-slate-600 mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        כללים אלה מיישמים שיוך אוטומטי בעת יצירת פניה חדשה, כאשר הנציג בוחר «שיוך אוטומטי לפי נושא».
        נושא הפניה ממופה למחלקה או לנציג ברירת מחדל.
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-3">הוספת כלל</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-slate-500">נושא הפניה</label>
            <select
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
            >
              {REFERRAL_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={newTopic && !REFERRAL_TOPICS.includes(newTopic) ? newTopic : ""}>
                {newTopic && !REFERRAL_TOPICS.includes(newTopic) ? newTopic : "אחר..."}
              </option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">סוג שיוך</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
            >
              <option value="department">מחלקה</option>
              <option value="agent">נציג</option>
            </select>
          </div>
          {newType === "department" ? (
            <div>
              <label className="text-xs text-slate-500">מחלקה</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500">נציג</label>
              <select
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
              >
                {agents.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button type="button" onClick={handleCreate} className="m3-btn-tonal w-full px-3 py-2">
              <Plus className="w-4 h-4 inline ml-1" />
              הוסף כלל
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {rules.length === 0 ? (
          <p className="text-center text-slate-500 py-8 rounded-2xl border border-dashed border-slate-200">
            אין כללי ניתוב — פניות חדשות ישויכו לנציג היוצר
          </p>
        ) : (
          rules.map((rule) => (
            <section key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-500">נושא</label>
                  <input
                    type="text"
                    value={rule.referral_topic}
                    onChange={(e) => updateLocalRule(rule.id, { referral_topic: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">סוג שיוך</label>
                  <select
                    value={rule.assigned_to_type}
                    onChange={(e) => {
                      const type = e.target.value;
                      updateLocalRule(rule.id, {
                        assigned_to_type: type,
                        assigned_department_id: type === "department" ? departments[0]?.id || "service" : null,
                        assigned_agent_name: type === "agent" ? agents[0] || "" : null,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
                  >
                    <option value="department">מחלקה</option>
                    <option value="agent">נציג</option>
                  </select>
                </div>
                {rule.assigned_to_type === "department" ? (
                  <div>
                    <label className="text-xs text-slate-500">מחלקה</label>
                    <select
                      value={rule.assigned_department_id || ""}
                      onChange={(e) =>
                        updateLocalRule(rule.id, { assigned_department_id: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-500">נציג</label>
                    <select
                      value={rule.assigned_agent_name || ""}
                      onChange={(e) =>
                        updateLocalRule(rule.id, { assigned_agent_name: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
                    >
                      {agents.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(rule)}
                    className={cn("m3-btn-tonal px-3 py-2 flex-1 sm:flex-none")}
                  >
                    <Save className="w-4 h-4 inline ml-1" />
                    שמור
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rule)}
                    className="text-red-600 border border-red-200 rounded-xl px-2 py-2 hover:bg-red-50"
                    aria-label={`מחיקת כלל ${rule.referral_topic}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </HypPageLayout>
  );
}
