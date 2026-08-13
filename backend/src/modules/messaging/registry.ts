import { whatsappAdapter } from "./whatsapp/adapter";
import { whatsappMockAdapter, isWhatsAppMockAllowed } from "./whatsapp/mockAdapter";
import { MessagingAdapter, MessagingChannel } from "./types";

export function getMessagingAdapter(channel: MessagingChannel): MessagingAdapter {
  if (channel === "whatsapp") {
    return isWhatsAppMockAllowed() ? whatsappMockAdapter : whatsappAdapter;
  }

  throw new Error(`Unsupported messaging channel: ${channel}`);
}
