-- Guest Messaging (WhatsApp first; architected for future channels —
-- Instagram, Airbnb/Booking.com/VRBO in-platform messaging — the same
-- way integrations/airbnbApi's adapter pattern was built to add a
-- provider without rewriting the pipeline around it).
--
-- Mirrors the existing ai_conversations/ai_messages shape (see
-- backend/src/modules/ai/repository.ts) — a conversations table
-- scoped to organization/guest/reservation, and a messages table
-- scoped to a conversation — rather than inventing a new schema
-- pattern for chat data.
--
-- guest_id is nullable: an inbound message can arrive before staff
-- have linked it to a known guest (e.g. a new phone number that
-- doesn't match any guest.phone on file yet) — the conversation is
-- still stored and visible for manual linking, never dropped.

CREATE TABLE guest_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  guest_id UUID NULL REFERENCES guests(id) ON DELETE SET NULL,
  reservation_id UUID NULL REFERENCES reservations(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  external_contact_id TEXT NOT NULL,
  last_message_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT guest_conversations_channel_check
    CHECK (channel IN ('whatsapp'))
);

-- One conversation per (organization, channel, external contact) —
-- e.g. one WhatsApp thread per phone number per org, so a repeat
-- inbound message from the same number always resolves to the same
-- conversation rather than forking a new one.
CREATE UNIQUE INDEX guest_conversations_org_channel_contact_key
  ON guest_conversations (organization_id, channel, external_contact_id);

CREATE INDEX guest_conversations_organization_id_idx
  ON guest_conversations (organization_id);

CREATE INDEX guest_conversations_guest_id_idx
  ON guest_conversations (guest_id);

CREATE TABLE guest_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES guest_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  external_message_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT guest_messages_direction_check
    CHECK (direction IN ('inbound', 'outbound')),

  CONSTRAINT guest_messages_status_check
    CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'received'))
);

-- Every inbound webhook delivery is deduped against this — Meta (and
-- most webhook providers) can redeliver the same event on retry, and
-- external_message_id is the provider's own dedup key.
CREATE UNIQUE INDEX guest_messages_external_message_id_key
  ON guest_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX guest_messages_conversation_id_idx
  ON guest_messages (conversation_id);

-- Tables created via a raw CREATE TABLE in the SQL Editor don't
-- automatically receive PostgREST's standard service_role grants
-- (confirmed repeatedly across earlier migrations in this project) —
-- granted here upfront.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_messages TO service_role;
