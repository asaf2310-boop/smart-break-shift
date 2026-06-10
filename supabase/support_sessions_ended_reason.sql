-- סיבת סיום סשן — לסנכרון נציג ↔ לקוח (מי סיים ראשון)
alter table support_sessions
  add column if not exists ended_reason text;
