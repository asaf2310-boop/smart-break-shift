import React, { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReferralAssignmentFields from "@/components/crm/ReferralAssignmentFields";

export default function ReferralTransferDialog({ referral, open, onOpenChange, onConfirm }) {
  const [assignment, setAssignment] = useState({
    assigned_to_type: "agent",
    assigned_agent_name: "",
    assigned_department_id: null,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!referral || !open) return;
    setAssignment({
      assigned_to_type: referral.assigned_to_type || "agent",
      assigned_agent_name: referral.assigned_agent_name || referral.original_agent_name || "",
      assigned_department_id: referral.assigned_department_id || null,
    });
    setError("");
  }, [referral, open]);

  const handleConfirm = () => {
    if (assignment.assigned_to_type === "agent" && !assignment.assigned_agent_name?.trim()) {
      setError("יש לבחור נציג");
      return;
    }
    if (assignment.assigned_to_type === "department" && !assignment.assigned_department_id) {
      setError("יש לבחור מחלקה");
      return;
    }
    onConfirm(assignment);
    onOpenChange(false);
  };

  if (!referral) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-teal-600" />
            העברת פניה — {referral.referral_topic}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 line-clamp-2">{referral.description}</p>
        <ReferralAssignmentFields
          value={assignment}
          onChange={setAssignment}
          defaultAgentName={referral.original_agent_name}
        />
        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600"
            onClick={handleConfirm}
          >
            העבר
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
