import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChatPanel } from "@/context/ChatPanelContext";
import { getStoredAgentName } from "@/constants/scheduling";

/** /chat — פותח את בועת הצ'אט ומחזיר לדף רגיל */
export default function ChatDeepLink() {
  const navigate = useNavigate();
  const { openChat } = useChatPanel();

  useEffect(() => {
    openChat();
    navigate(getStoredAgentName() ? "/breaks" : "/", { replace: true });
  }, [navigate, openChat]);

  return null;
}