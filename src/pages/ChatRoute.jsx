import { useSearchParams } from "react-router-dom";
import ChatDeepLink from "@/pages/ChatDeepLink";
import CustomerChatGuestPage from "@/pages/CustomerChatGuestPage";

/** /chat — token query opens guest chat; otherwise internal chat deeplink */
export default function ChatRoute() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  if (token) return <CustomerChatGuestPage />;
  return <ChatDeepLink />;
}
