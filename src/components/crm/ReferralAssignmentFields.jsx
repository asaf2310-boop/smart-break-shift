import React, { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { listCrmDepartments, subscribeCrmDepartments } from "@/lib/crmDepartments";
import { getAgentNamesList } from "@/constants/scheduling";

export const ASSIGNMENT_TYPES = [
  { value: "agent", label: "נציג" },
  { value: "department", label: "מחלקה" },
];

export default function ReferralAssignmentFields({ value, onChange, defaultAgentName }) {
  const agents = useMemo(() => getAgentNamesList(), []);
  const [departments, setDepartments] = useState(() => listCrmDepartments());

  useEffect(() => {
    const refresh = () => setDepartments(listCrmDepartments());
    refresh();
    return subscribeCrmDepartments(refresh);
  }, []);

  const setType = (assigned_to_type) => {
    if (assigned_to_type === "agent") {
      onChange({
        assigned_to_type: "agent",
        assigned_agent_name: value.assigned_agent_name || defaultAgentName || agents[0] || "",
        assigned_department_id: null,
      });
    } else {
      onChange({
        assigned_to_type: "department",
        assigned_agent_name: null,
        assigned_department_id: value.assigned_department_id || departments[0]?.id || "service",
      });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3" dir="rtl">
      <Label className="text-slate-700">שיוך ל</Label>
      <div className="flex flex-wrap gap-2">
        {ASSIGNMENT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`text-sm font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
              value.assigned_to_type === t.value
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {value.assigned_to_type === "agent" ? (
        <div className="space-y-1.5">
          <Label htmlFor="assign-agent" className="text-xs text-slate-500">
            בחר נציג
          </Label>
          <select
            id="assign-agent"
            value={value.assigned_agent_name || ""}
            onChange={(e) =>
              onChange({
                ...value,
                assigned_to_type: "agent",
                assigned_agent_name: e.target.value,
                assigned_department_id: null,
              })
            }
            className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 text-sm shadow-sm"
          >
            {agents.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="assign-dept" className="text-xs text-slate-500">
            בחר מחלקה
          </Label>
          <select
            id="assign-dept"
            value={value.assigned_department_id || ""}
            onChange={(e) =>
              onChange({
                ...value,
                assigned_to_type: "department",
                assigned_agent_name: null,
                assigned_department_id: e.target.value,
              })
            }
            className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 text-sm shadow-sm"
          >
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
                {dept.agentNames.length ? ` (${dept.agentNames.length} נציגים)` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
