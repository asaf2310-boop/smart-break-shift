import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ExternalLink,
  FolderOpen,
  Hash,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import ReferralForm from "@/components/crm/ReferralForm";
import { crmEnabled } from "@/api/crmMode";
import {
  createReferral,
  getCustomerById,
  getReferralAssignmentLabel,
  getReferralStatusLabel,
  hydrateCrmStore,
  listReferralsForCustomer,
  subscribeCrmStore,
} from "@/lib/crmStore";
import {
  formatChatTranscript,
  getSessionById,
  listMessages,
  subscribeCustomerChatStore,
  tryLinkSessionToCrmCustomer,
} from "@/lib/customerChatStore";
import { recordRecentVisit } from "@/lib/crmRecents";

function formatReferralDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "";
  }
}

function DetailRow({ icon: Icon, label, value, dir }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="font-medium break-words" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AgentCrmSidebar({ session, agentName, messages }) {
  const { toast } = useToast();
  const [crmTick, setCrmTick] = useState(0);
  const [chatTick, setChatTick] = useState(0);
  const [referralOpen, setReferralOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const sessionId = session?.id;
  const liveSession = sessionId ? getSessionById(sessionId) || session : session;

  useEffect(() => {
    if (!crmEnabled) return undefined;
    hydrateCrmStore().finally(() => setHydrated(true));
    return subscribeCrmStore(() => setCrmTick((n) => n + 1));
  }, []);

  useEffect(() => subscribeCustomerChatStore(() => setChatTick((n) => n + 1)), []);

  useEffect(() => {
    if (!sessionId || !crmEnabled) return;
    tryLinkSessionToCrmCustomer(sessionId);
  }, [sessionId, liveSession?.guest_email, liveSession?.guest_phone, liveSession?.merchant_ref, crmTick, chatTick]);

  const customer = useMemo(() => {
    if (!liveSession?.crm_customer_id) return null;
    return getCustomerById(liveSession.crm_customer_id);
  }, [liveSession?.crm_customer_id, crmTick]);

  const referrals = useMemo(() => {
    if (!customer?.id) return [];
    return listReferralsForCustomer(customer.id).slice(0, 5);
  }, [customer?.id, crmTick]);

  const chatTranscript = useMemo(() => {
    const source = messages?.length ? messages : sessionId ? listMessages(sessionId) : [];
    const body = formatChatTranscript(source);
    if (!body) return "";
    return `--- תמליל צ'אט ---\n${body}`;
  }, [messages, sessionId]);

  const handleReferralSubmit = useCallback(
    (data) => {
      if (!customer?.id) return;
      try {
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
        setReferralOpen(false);
        setCrmTick((n) => n + 1);
      } catch (err) {
        toast({
          title: "שגיאה",
          description: err.message || "לא ניתן לפתוח פניה",
          variant: "destructive",
        });
      }
    },
    [customer, toast]
  );

  if (!crmEnabled) {
    return (
      <aside className="m3-card p-4 min-h-[24rem] lg:min-h-[32rem] flex items-center justify-center text-center">
        <p className="text-sm text-on-surface-variant">מודול CRM אינו פעיל</p>
      </aside>
    );
  }

  if (!session) {
    return (
      <aside className="m3-card p-4 min-h-[24rem] lg:min-h-[32rem] flex items-center justify-center text-center">
        <p className="text-sm text-on-surface-variant">בחרו שיחה לצפייה בכרטיס לקוח</p>
      </aside>
    );
  }

  const sessionHints = [
    liveSession?.guest_email && { label: "אימייל מהשיחה", value: liveSession.guest_email },
    liveSession?.guest_phone && { label: "טלפון מהשיחה", value: liveSession.guest_phone },
    liveSession?.merchant_ref && { label: "מסוף/ח.פ מהשיחה", value: liveSession.merchant_ref },
  ].filter(Boolean);

  return (
    <>
      <aside className="m3-card flex flex-col min-h-[24rem] lg:min-h-[32rem] overflow-hidden">
        <div className="px-4 py-3 border-b border-outline/15">
          <h2 className="m3-title-small flex items-center gap-2">
            <UserRound className="w-4 h-4 text-primary" />
            כרטיס לקוח CRM
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!hydrated ? (
            <p className="text-sm text-on-surface-variant text-center py-6">טוען נתוני CRM…</p>
          ) : customer ? (
            <>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m3-label-large truncate">{customer.name}</p>
                    {customer.company ? (
                      <p className="text-xs text-on-surface-variant truncate">{customer.company}</p>
                    ) : null}
                  </div>
                  <Link
                    to={`/crm/${customer.id}`}
                    className="m3-icon-button rounded-full shrink-0"
                    aria-label="פתיחת כרטיס לקוח מלא"
                    title="כרטיס לקוח מלא"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                <DetailRow icon={Phone} label="טלפון" value={customer.phone} dir="ltr" />
                <DetailRow icon={Mail} label="אימייל" value={customer.email} dir="ltr" />
                <DetailRow icon={Hash} label="ח.פ / עוסק" value={customer.tax_id} dir="ltr" />
                <DetailRow icon={Building2} label="חברה" value={customer.company} />
              </div>

              <section>
                <h3 className="m3-label-large mb-2 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  פניות אחרונות
                </h3>
                {referrals.length === 0 ? (
                  <p className="text-sm text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-3 text-center">
                    אין פניות קודמות
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {referrals.map((ref) => (
                      <li key={ref.id}>
                        <Link
                          to={`/crm/${customer.id}`}
                          state={{ referralId: ref.id, referralTopic: ref.referral_topic }}
                          className="block rounded-xl border border-outline/15 px-3 py-2 hover:bg-surface-container-low transition-colors"
                        >
                          <p className="text-sm font-medium truncate">{ref.referral_topic}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {getReferralStatusLabel(ref.status)}
                            {ref.opened_at ? ` · ${formatReferralDate(ref.opened_at)}` : ""}
                          </p>
                          {ref.description ? (
                            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                              {ref.description}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                לא זוהה לקוח ב-CRM לפי הנתונים מהשיחה
              </p>
              {sessionHints.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-on-surface-variant">פרטים שנאספו בשיחה:</p>
                  {sessionHints.map((hint) => (
                    <div
                      key={hint.label}
                      className="text-sm rounded-xl bg-surface-container-low px-3 py-2"
                    >
                      <p className="text-xs text-on-surface-variant">{hint.label}</p>
                      <p className="font-medium break-words" dir="ltr">
                        {hint.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  הלקוח עדיין לא הזין אימייל, טלפון או ח.פ מזוהים
                </p>
              )}
            </div>
          )}
        </div>

        {customer ? (
          <div className="p-3 border-t border-outline/15">
            <Button type="button" className="w-full" onClick={() => setReferralOpen(true)}>
              <FolderOpen className="w-4 h-4 ml-2" />
              פתיחת פניה
            </Button>
          </div>
        ) : null}
      </aside>

      <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>פתיחת פניה מצ'אט</DialogTitle>
          </DialogHeader>
          <ReferralForm
            agentName={agentName}
            initialDescription={chatTranscript}
            onSubmit={handleReferralSubmit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
