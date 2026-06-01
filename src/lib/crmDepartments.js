import { getAgentNamesList } from "@/constants/scheduling";

/** מחלקות CRM לדמו — כל הנציגים ב"שירות" לפי דרישה */
export const CRM_DEPARTMENTS = [
  {
    id: "service",
    name: "שירות",
    get agentNames() {
      return getAgentNamesList();
    },
  },
  {
    id: "billing",
    name: "חשבוניות",
    agentNames: ["נציג 03", "נציג 05", "נציג 08"],
  },
  {
    id: "sales",
    name: "מכירות",
    agentNames: ["נציג 01", "נציג 04"],
  },
  {
    id: "support",
    name: "תמיכה",
    agentNames: ["נציג 06", "נציג 07", "נציג 09"],
  },
];

export function getDepartmentById(id) {
  return CRM_DEPARTMENTS.find((d) => d.id === id) || null;
}

export function getDepartmentsForAgent(agentName) {
  const name = String(agentName || "").trim();
  if (!name) return [];
  return CRM_DEPARTMENTS.filter((dept) => dept.agentNames.includes(name));
}

export function isAgentInDepartment(agentName, departmentId) {
  const dept = getDepartmentById(departmentId);
  if (!dept) return false;
  return dept.agentNames.includes(String(agentName || "").trim());
}

export function getDepartmentName(departmentId) {
  return getDepartmentById(departmentId)?.name || departmentId;
}
