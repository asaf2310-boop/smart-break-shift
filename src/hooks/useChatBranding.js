import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataClient } from "@/api/client";
import { demoModeEnabled } from "@/api/demoClient";
import { isSupabaseBackend } from "@/api/dataClient";
import {
  CHAT_SETTINGS_ROW_ID,
  getEffectiveChatBranding,
  isChatSettingsUnavailableError,
  mapSupabaseChatSettingsRow,
  readLocalChatBranding,
  toSupabaseChatSettingsPatch,
  writeLocalChatBranding,
} from "@/lib/chatBranding";
import { getLiveQueryOptions } from "@/lib/liveQuery";

const QUERY_KEY = ["chat-branding"];

function useRemoteChatBranding() {
  return isSupabaseBackend() && !demoModeEnabled && Boolean(dataClient.entities.ChatSettings);
}

async function fetchRemoteChatBranding() {
  try {
    const rows = await dataClient.entities.ChatSettings.filter({ id: CHAT_SETTINGS_ROW_ID });
    return mapSupabaseChatSettingsRow(rows[0]) || readLocalChatBranding();
  } catch (error) {
    if (isChatSettingsUnavailableError(error)) {
      return readLocalChatBranding();
    }
    throw error;
  }
}

async function saveRemoteChatBranding(branding) {
  const patch = toSupabaseChatSettingsPatch(branding);
  const rows = await dataClient.entities.ChatSettings.filter({ id: CHAT_SETTINGS_ROW_ID });
  if (rows[0]?.id) {
    await dataClient.entities.ChatSettings.update(rows[0].id, patch);
  } else {
    await dataClient.entities.ChatSettings.create({
      id: CHAT_SETTINGS_ROW_ID,
      ...patch,
    });
  }
  return branding;
}

export function useChatBranding() {
  const queryClient = useQueryClient();
  const remote = useRemoteChatBranding();

  const { data: branding = null, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => (remote ? fetchRemoteChatBranding() : readLocalChatBranding()),
    ...getLiveQueryOptions(),
    retry: (failureCount, error) =>
      !isChatSettingsUnavailableError(error) && failureCount < 2,
  });

  const effective = getEffectiveChatBranding(branding);

  const saveMutation = useMutation({
    mutationFn: async (next) => {
      if (remote) {
        await saveRemoteChatBranding(next);
      } else {
        writeLocalChatBranding(next);
      }
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    branding,
    effective,
    isLoading,
    saveBranding: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
