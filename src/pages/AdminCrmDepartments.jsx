import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Save, Trash2, UserRound } from "lucide-react";
import { getAgentNamesList } from "@/constants/scheduling";
import {
  createCrmDepartment,
  deleteCrmDepartment,
  listCrmDepartments,
  setDepartmentAgentNames,
  subscribeCrmDepartments,
  updateCrmDepartment,
} from "@/lib/crmDepartments";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";

function slugifyDepartmentId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "-");
}

export default function AdminCrmDepartments() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState(() => listCrmDepartments());
  const [newName, setNewName] = useState("");
  const [savingId, setSavingId] = useState("");
  const allAgents = useMemo(() => getAgentNamesList(), []);

  useEffect(() => {
    const refresh = () => setDepartments(listCrmDepartments());
    refresh();
    return subscribeCrmDepartments(refresh);
  }, []);

  const handleCreate = () => {
    const cleanName = String(newName || "").trim();
    if (!cleanName) return;
    try {
      createCrmDepartment({ id: slugifyDepartmentId(cleanName), name: cleanName });
      setNewName("");
      toast({ title: "מחלקה נוספה", description: cleanName });
    } catch (err) {
      toast({ title: "לא ניתן להוסיף מחלקה", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = (deptId, deptName) => {
    deleteCrmDepartment(deptId);
    toast({ title: "מחלקה נמחקה", description: deptName });
  };

  const handleNameChange = (deptId, name) => {
    setDepartments((prev) => prev.map((dept) => (dept.id === deptId ? { ...dept, name } : dept)));
  };

  const handleToggleAgent = (deptId, agentName) => {
    setDepartments((prev) =>
      prev.map((dept) => {
        if (dept.id !== deptId) return dept;
        const hasAgent = dept.agentNames.includes(agentName);
        return {
          ...dept,
          agentNames: hasAgent
            ? dept.agentNames.filter((name) => name !== agentName)
            : [...dept.agentNames, agentName],
        };
      })
    );
  };

  const handleSaveDepartment = (dept) => {
    setSavingId(dept.id);
    try {
      updateCrmDepartment(dept.id, { name: dept.name });
      setDepartmentAgentNames(dept.id, dept.agentNames);
      toast({ title: "מחלקה נשמרה", description: dept.name });
    } catch (err) {
      toast({ title: "שמירה נכשלה", description: err.message, variant: "destructive" });
    } finally {
      setSavingId("");
    }
  };

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-700">
          חזרה לדשבורד מנהל
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 inline-flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          ניהול מחלקות CRM
        </h1>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-3">הוספת מחלקה</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="שם מחלקה חדשה..."
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={handleCreate} className="m3-btn-tonal px-3 py-2">
            <Plus className="w-4 h-4" />
            הוסף
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {departments.map((dept) => (
          <section key={dept.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500">שם מחלקה</label>
                <input
                  type="text"
                  value={dept.name}
                  onChange={(e) => handleNameChange(dept.id, e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm mt-1"
                />
              </div>
              <button
                type="button"
                onClick={() => handleDelete(dept.id, dept.name)}
                className="text-red-600 border border-red-200 rounded-xl px-2 py-2 hover:bg-red-50"
                aria-label={`מחיקת מחלקת ${dept.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-2 inline-flex items-center gap-1">
              <UserRound className="w-3 h-3" />
              חברי מחלקה
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allAgents.map((agentName) => {
                const checked = dept.agentNames.includes(agentName);
                return (
                  <label
                    key={`${dept.id}-${agentName}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleAgent(dept.id, agentName)}
                    />
                    <span>{agentName}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveDepartment(dept)}
                className="m3-btn-tonal px-3 py-2"
                disabled={savingId === dept.id}
              >
                <Save className="w-4 h-4" />
                שמור
              </button>
            </div>
          </section>
        ))}
      </div>
    </HypPageLayout>
  );
}
