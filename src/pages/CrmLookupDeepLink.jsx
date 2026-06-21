import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { crmDemoAvailable, getCustomerByPhone } from "@/lib/crmStore";
import { recordRecentSearch, recordRecentVisit } from "@/lib/crmRecents";
import { getStoredAgentName } from "@/constants/scheduling";

/** /crm/lookup?phone= — deep link מ-Zoiper Event Rule או חייגן חיצוני */
export default function CrmLookupDeepLink() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!getStoredAgentName()) {
      navigate("/", { replace: true });
      return;
    }
    if (!crmDemoAvailable()) {
      navigate("/crm", { replace: true });
      return;
    }

    const phone = searchParams.get("phone") || "";
    if (!phone.trim()) {
      navigate("/crm", { replace: true });
      return;
    }

    const customer = getCustomerByPhone(phone);
    if (customer) {
      recordRecentSearch(phone.trim());
      recordRecentVisit({
        customerId: customer.id,
        customerName: customer.name,
      });
      navigate(`/crm/${customer.id}`, { replace: true });
    } else {
      navigate(`/crm?notfound=${encodeURIComponent(phone.trim())}`, { replace: true });
    }
  }, [navigate, searchParams]);

  return null;
}
