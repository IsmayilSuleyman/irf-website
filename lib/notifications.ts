export type NotificationRow = {
  id: string;
  kind: "match" | "settled" | "payment_due";
  trade_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};
