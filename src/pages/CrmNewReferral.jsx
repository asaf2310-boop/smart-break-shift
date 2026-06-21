import React from "react";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { getStoredAgentName } from "@/constants/scheduling";
import {
  createCustomer,
  createReferral,
  crmDemoAvailable,
  getReferralAssignmentLabel,
} from "@/lib/crmStore";
import { recordRecentVisit } from "@/lib/crmRecents";
import ManualReferralForm from "@/components/crm/ManualReferralForm";
import CrmBackToDashboard from "@/components/crm/CrmBackToDashboard";
import { useToast } from "@/components/ui/use-toast";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";
import { demoModeEnabled } from "@/api/demoClient";

export default function CrmNewReferral() {
  const agentName = getStoredAgentName();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (!agentName) {
    return <Navigate to="/" replace />;
  }

  if (!crmDemoAvailable()) {
    return <Navigate to="/crm" replace />;
  }

  const handleSubmit = (data) => {
    try {
      const customer =
        data.existingCustomer ||
        createCustomer({
          name: data.name,
          phone: data.phone,
        });

      const created = createReferral({
        customer_id: customer.id,
        referral_topic: data.referral_topic,
        description: data.description,
        agent_name: data.agent_name,
        priority: data.priority,
        status: data.status,
        explicit_assignment: data.explicit_assignment,
        assigned_to_type: data.assigned_to_type,
        assigned_agent_name: data.assigned_agent_name,
        assigned_department_id: data.assigned_department_id,
      });

      recordRecentVisit({
        customerId: customer.id,
        customerName: customer.name,
        referralId: created.id,
        referralTopic: created.referral_topic,
      });

      toast({
        title: "פניה נפתחה",
        description: `הפניה שויכה ל${getReferralAssignmentLabel(created)}`,
      });

      navigate(`/crm/${customer.id}`, {
        replace: true,
        state: {
          referralId: created.id,
          referralTopic: created.referral_topic,
        },
      });
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן לפתוח פניה",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={m3PageClass("pb-24")} dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary-container/35 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <CrmBackToDashboard />
          <div className={cn(hypHeaderIconClass("shadow-elevation-1 mb-3 mt-4"), !demoModeEnabled && "bg-primary")}>
            <FolderOpen className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary-foreground")} />
          </div>
          <h1 className="m3-headline-small font-medium">פתיחת פניה ידנית</h1>
          <p className="m3-label-medium mt-1">
            שלום, <span className="font-semibold text-foreground">{agentName}</span> — חפש לקוח לפי טלפון או צור חדש
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="m3-card p-5 sm:p-6"
        >
          <ManualReferralForm
            agentName={agentName}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/crm")}
          />
        </motion.section>
      </div>
    </div>
  );
}
