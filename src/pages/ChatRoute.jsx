import { useSearchParams } from "react-router-dom";
import ModuleGate from "@/components/auth/ModuleGate";
import ChatDeepLink from "@/pages/ChatDeepLink";
import CustomerChatGuestPage from "@/pages/CustomerChatGuestPage";

/** /chat — token query opens guest chat; otherwise internal chat deeplink */
export default function ChatRoute() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  if (token) return <CustomerChatGuestPage />;
  return (
    <ModuleGate module="internal_chat">
      <ChatDeepLink />
    </ModuleGate>
  );
}
