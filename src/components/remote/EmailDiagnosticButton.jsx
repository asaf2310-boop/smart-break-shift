<<<<<<< HEAD
import React, { useState } from "react";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getDemoEmailBuildDiagnostic } from "@/api/demoClient";
import { fetchEmailStatus, formatEmailDiagnosticReport } from "@/lib/emailApi";

export default function EmailDiagnosticButton({
  variant = "outline",
  size = "sm",
  className = "",
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const status = await fetchEmailStatus();
      const buildFlags = getDemoEmailBuildDiagnostic();
      const report = formatEmailDiagnosticReport(status, buildFlags);
      const needsAttention =
        !status.apiPresent ||
        !status.configured ||
        status.sandboxMode ||
        status.legacyStatusOnly ||
        (buildFlags.demoModeEnabled && !buildFlags.attemptsRealEmailInDemo);
      toast({
        title: status.sandboxMode
          ? "מייל — מצב בדיקות Resend"
          : needsAttention
            ? "בדיקת מייל — נדרשת פעולה"
            : "בדיקת מייל",
        description: (
          <pre className="whitespace-pre-wrap text-xs font-sans text-right leading-relaxed mt-1">
            {report}
          </pre>
        ),
        duration: needsAttention ? 14000 : 8000,
        variant: needsAttention ? "destructive" : undefined,
      });
    } catch {
      toast({
        title: "בדיקת מייל נכשלה",
        description: "לא ניתן לגשת ל-/api/email-status — בדקו חיבור ו-Redeploy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={`gap-1.5 ${className}`}
      onClick={runDiagnostic}
      disabled={loading}
    >
      <Stethoscope className="w-3.5 h-3.5 shrink-0" />
      {loading ? "בודק..." : "בדיקת מייל"}
    </Button>
  );
}
=======
import React, { useState } from "react";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getDemoEmailBuildDiagnostic } from "@/api/demoClient";
import { fetchEmailStatus, formatEmailDiagnosticReport } from "@/lib/emailApi";

export default function EmailDiagnosticButton({
  variant = "outline",
  size = "sm",
  className = "",
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const status = await fetchEmailStatus();
      const buildFlags = getDemoEmailBuildDiagnostic();
      const report = formatEmailDiagnosticReport(status, buildFlags);
      const needsAttention =
        !status.apiPresent ||
        !status.configured ||
        status.sandboxMode ||
        status.legacyStatusOnly ||
        (buildFlags.demoModeEnabled && !buildFlags.attemptsRealEmailInDemo);
      toast({
        title: status.sandboxMode
          ? "מייל — מצב בדיקות Resend"
          : needsAttention
            ? "בדיקת מייל — נדרשת פעולה"
            : "בדיקת מייל",
        description: (
          <pre className="whitespace-pre-wrap text-xs font-sans text-right leading-relaxed mt-1">
            {report}
          </pre>
        ),
        duration: needsAttention ? 14000 : 8000,
        variant: needsAttention ? "destructive" : undefined,
      });
    } catch {
      toast({
        title: "בדיקת מייל נכשלה",
        description: "לא ניתן לגשת ל-/api/email-status — בדקו חיבור ו-Redeploy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={`gap-1.5 ${className}`}
      onClick={runDiagnostic}
      disabled={loading}
    >
      <Stethoscope className="w-3.5 h-3.5 shrink-0" />
      {loading ? "בודק..." : "בדיקת מייל"}
    </Button>
  );
}
>>>>>>> 842dd9e (Initial commit)
