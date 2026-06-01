import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  FolderOpen,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  ArrowLeftRight,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { getStoredAgentName } from "@/constants/scheduling";
import {
  assignReferral,
  canReopenReferral,
  closeReferral,
  createCallLog,
  createEmailLog,
  createInboundEmailLog,
  createReferral,
  crmDemoAvailable,
  deleteCallLog,
  deleteCustomer,
  deleteEmailLog,
  getCallTypeLabel,
  getCustomerById,
  getEmailStatusLabel,
  getDepartmentName,
  getReferralAssignmentLabel,
  getReferralStatusLabel,
  listCallLogsForCustomer,
  listEmailLogsForCustomer,
  listReferralsForCustomer,
  reopenReferralFromCustomerResponse,
  subscribeCrmStore,
  updateCustomer,
} from "@/lib/crmStore";
import CustomerForm from "@/components/crm/CustomerForm";
import CallLogForm, { formatCallDatetime } from "@/components/crm/CallLogForm";
import EmailSendForm, { formatEmailDatetime } from "@/components/crm/EmailSendForm";
import ReferralForm from "@/components/crm/ReferralForm";
import ReferralTransferDialog from "@/components/crm/ReferralTransferDialog";
import InboundEmailForm from "@/components/crm/InboundEmailForm";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { m3PageClass } from "@/lib/hypPage";
import { useTelephony } from "@/context/TelephonyContext";
import { telephonyDemoAvailable } from "@/lib/telephonyStore";
import RemoteSupportPanel from "@/components/remote/RemoteSupportPanel";
import CustomerScreenRecordings from "@/components/crm/CustomerScreenRecordings";

const callTypeIcon = {
  incoming: Phone,
  outgoing: Phone,
  chat: MessageSquare,
};

export default function CrmCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agentName = getStoredAgentName();
  const [customer, setCustomer] = useState(null);
  const [calls, setCalls] = useState([]);
  const [emails, setEmails] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [activeTab, setActiveTab] = useState("calls");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferRef, setTransferRef] = useState(null);
  const { toast } = useToast();
  const { dialNumber } = useTelephony();

  const refresh = useCallback(() => {
    setCustomer(getCustomerById(id));
    setCalls(listCallLogsForCustomer(id));
    setEmails(listEmailLogsForCustomer(id));
    setReferrals(listReferralsForCustomer(id));
  }, [id]);

  useEffect(() => {
    refresh();
    return subscribeCrmStore(refresh);
  }, [refresh]);

  if (!agentName) {
    return <Navigate to="/" replace />;
  }

  if (!crmDemoAvailable()) {
    return <Navigate to="/crm" replace />;
  }

  if (!customer) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="text-center">
          <p className="text-slate-600 mb-4">לקוח לא נמצא</p>
          <Link to="/crm" className="text-indigo-600 font-semibold text-sm">
            חזרה לרשימה
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdate = (data) => {
    updateCustomer(customer.id, data);
    setEditOpen(false);
    toast({ title: "נשמר", description: "פרטי הלקוח עודכנו" });
    refresh();
  };

  const handleDelete = () => {
    deleteCustomer(customer.id);
    toast({ title: "נמחק", description: "הלקוח והתיעודים שלו הוסרו" });
    navigate("/crm", { replace: true });
  };

  const handleAddCall = (data) => {
    createCallLog({ customer_id: customer.id, ...data });
    toast({ title: "תועד", description: "השיחה נשמרה בציר הזמן" });
    refresh();
  };

  const handleAddReferral = (data) => {
    try {
      createReferral({ customer_id: customer.id, ...data });
      const assignLabel =
        data.assigned_to_type === "department"
          ? `מחלקת ${getDepartmentName(data.assigned_department_id)}`
          : data.assigned_agent_name;
      toast({
        title: data.status === "closed" ? "פניה נסגרה" : "פניה נפתחה",
        description:
          data.status === "closed"
            ? "הפניה נשמרה כהסתיים טיפול"
            : `הפניה שויכה ל${assignLabel}`,
      });
      refresh();
    } catch (err) {
      toast({ title: "שגיאה", description: err.message || "לא ניתן לשמור", variant: "destructive" });
    }
  };

  const handleCloseReferral = (refId) => {
    closeReferral(refId);
    toast({ title: "נסגר", description: "הפניה סומנה כהסתיים טיפול" });
    refresh();
  };

  const handleCustomerResponded = (refId) => {
    const updated = reopenReferralFromCustomerResponse(refId);
    if (updated) {
      toast({
        title: "נפתח מחדש",
        description: `הפניה חזרה ל${getReferralAssignmentLabel(updated)}`,
      });
    } else {
      toast({
        title: "לא ניתן לפתוח",
        description: "ניתן לפתוח מחדש רק תוך 7 ימים מסגירת הפניה",
        variant: "destructive",
      });
    }
    refresh();
  };

  const handleTransferReferral = (assignment) => {
    if (!transferRef) return;
    const updated = assignReferral(transferRef.id, assignment);
    if (updated) {
      toast({
        title: "הועבר",
        description: `הפניה שויכה ל${getReferralAssignmentLabel(updated)}`,
      });
      refresh();
    }
    setTransferRef(null);
  };

  const handleInboundEmail = (data) => {
    createInboundEmailLog({ customer_id: customer.id, ...data });
    toast({ title: "מייל נכנס נרשם", description: "תגובת הלקוח נשמרה — ייתכן שפניה סגורה נפתחה מחדש" });
    refresh();
  };

  const handleDeleteCall = (callId) => {
    deleteCallLog(callId);
    toast({ title: "הוסר", description: "תיעוד השיחה נמחק" });
    refresh();
  };

  const handleSendEmail = (data) => {
    createEmailLog({ customer_id: customer.id, ...data });
    toast({ title: "מייל נשלח (דמו)", description: "המייל נשמר בהיסטוריה — ללא שליחה אמיתית" });
    refresh();
  };

  const handleDeleteEmail = (emailId) => {
    deleteEmailLog(emailId);
    toast({ title: "הוסר", description: "תיעוד המייל נמחק" });
    refresh();
  };

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-3xl px-4 py-6 sm:py-10 pb-24">
        <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 mb-4">
          <ArrowRight className="w-4 h-4" />
          כל הלקוחות
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-lg mb-6"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">{customer.name}</h1>
              {customer.company && (
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {customer.company}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="עריכה"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                aria-label="מחיקה"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-600">
            {customer.phone && (
              telephonyDemoAvailable() ? (
                <button
                  type="button"
                  onClick={() => {
                    dialNumber(customer.phone, {
                      customerId: customer.id,
                      customerName: customer.name,
                    });
                  }}
                  className="flex items-center gap-2 hover:text-teal-700 text-teal-800 font-semibold"
                  dir="ltr"
                  title="חיוג דמו — ללא שיחה אמיתית"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  {customer.phone}
                  <span className="text-[10px] font-normal text-teal-600/90 mr-1">חיוג</span>
                </button>
              ) : (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 hover:text-indigo-600" dir="ltr">
                  <Phone className="w-4 h-4 shrink-0" />
                  {customer.phone}
                </a>
              )
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 hover:text-indigo-600 truncate" dir="ltr">
                <Mail className="w-4 h-4 shrink-0" />
                {customer.email}
              </a>
            )}
          </div>
          {customer.notes && (
            <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{customer.notes}</p>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <RemoteSupportPanel
              agentName={agentName}
              crmCustomerId={customer.id}
              customerName={customer.name}
              customerEmail={customer.email}
            />
          </div>
          <CustomerScreenRecordings crmCustomerId={customer.id} />
        </motion.div>

        <section className="mb-6">
          <ReferralForm agentName={agentName} onSubmit={handleAddReferral} />
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-teal-600" />
            פניות והפניות
          </h2>
          {referrals.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4 rounded-2xl border border-dashed border-slate-200">
              אין פניות ללקוח זה
            </p>
          ) : (
            <div className="space-y-3">
              {referrals.map((ref) => {
                const isOpen = ref.status === "open";
                const mayReopen = canReopenReferral(ref);
                return (
                  <div
                    key={ref.id}
                    className={`rounded-2xl border p-4 shadow-sm ${
                      isOpen ? "border-teal-200 bg-teal-50/30" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2 py-0.5">
                          {ref.referral_topic}
                        </span>
                        <span
                          className={`text-xs font-bold rounded-lg px-2 py-0.5 border ${
                            isOpen
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-slate-600 bg-slate-100 border-slate-200"
                          }`}
                        >
                          {getReferralStatusLabel(ref.status)}
                        </span>
                        {ref.reopened_at && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5">
                            נפתח מחדש
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {getReferralAssignmentLabel(ref)}
                        {ref.original_agent_name && ` · יוצר: ${ref.original_agent_name}`}
                        {ref.closed_at && ` · נסגר ${format(new Date(ref.closed_at), "dd/MM/yy")}`}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{ref.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3 justify-end">
                      {isOpen && (
                        <>
                          <button
                            type="button"
                            onClick={() => setTransferRef(ref)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            העבר ל...
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloseReferral(ref.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            הסתיים טיפול
                          </button>
                        </>
                      )}
                      {!isOpen && mayReopen && (
                        <button
                          type="button"
                          onClick={() => handleCustomerResponded(ref.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          לקוח השיב
                        </button>
                      )}
                      {!isOpen && !mayReopen && ref.closed_at && (
                        <span className="text-xs text-slate-400 py-1.5">חלון 7 ימים לתגובה הסתיים</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm p-1 gap-1 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("calls")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "calls"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Phone className="w-4 h-4" />
            תיעוד שיחות
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "email"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Send className="w-4 h-4" />
            שליחת מייל
          </button>
        </div>

        {activeTab === "calls" && (
          <>
            <div className="mb-6">
              <CallLogForm agentName={agentName} onSubmit={handleAddCall} />
            </div>
            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-4">ציר זמן — תיעוד שיחות</h2>
              {calls.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">אין תיעודים עדיין</p>
              ) : (
                <div className="relative pr-4 border-r-2 border-indigo-200 space-y-4">
                  {calls.map((log, i) => {
                    const Icon = callTypeIcon[log.call_type] || MessageSquare;
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative mr-4"
                      >
                        <span className="absolute -right-[21px] top-3 w-3 h-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 ring-4 ring-indigo-50" />
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Icon className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-bold text-indigo-700">{getCallTypeLabel(log.call_type)}</span>
                              {log.referral_topic && (
                                <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2 py-0.5">
                                  נושא: {log.referral_topic}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">{formatCallDatetime(log.occurred_at)}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteCall(log.id)}
                                className="text-slate-300 hover:text-red-500 p-1"
                                aria-label="מחק תיעוד"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">{log.summary}</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {log.agent_name}
                            {log.duration_minutes != null && ` · ${log.duration_minutes} דקות`}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "email" && (
          <>
            <div className="mb-6 space-y-4">
              <EmailSendForm
                customerEmail={customer.email}
                agentName={agentName}
                onSubmit={handleSendEmail}
              />
              <InboundEmailForm customerEmail={customer.email} onSubmit={handleInboundEmail} />
            </div>
            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-4">היסטוריית מיילים</h2>
              {emails.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">אין מיילים שנשלחו עדיין</p>
              ) : (
                <div className="relative pr-4 border-r-2 border-purple-200 space-y-4">
                  {emails.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="relative mr-4"
                    >
                      <span className="absolute -right-[21px] top-3 w-3 h-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 ring-4 ring-purple-50" />
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Mail className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm font-bold text-slate-800">{log.subject}</span>
                            {log.referral_topic && (
                              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2 py-0.5">
                                {log.referral_topic}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 bg-slate-100 rounded-lg px-2 py-0.5">
                              {getEmailStatusLabel(log.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">{formatEmailDatetime(log.sent_at)}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmail(log.id)}
                              className="text-slate-300 hover:text-red-500 p-1"
                              aria-label="מחק מייל"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-2" dir="ltr">
                          אל: {log.to_email}
                        </p>
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{log.body}</p>
                        <p className="text-xs text-slate-500 mt-2">{log.agent_name}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <ReferralTransferDialog
        referral={transferRef}
        open={Boolean(transferRef)}
        onOpenChange={(open) => !open && setTransferRef(null)}
        onConfirm={handleTransferReferral}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת לקוח</DialogTitle>
          </DialogHeader>
          <CustomerForm initial={customer} onSubmit={handleUpdate} onCancel={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את {customer.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק גם את כל תיעודי השיחות והמיילים של הלקוח. לא ניתן לבטל.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HypPageLayout>
  );
}
