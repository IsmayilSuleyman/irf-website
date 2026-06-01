export type NotificationRow = {
  id: string;
  kind: "match" | "settled" | "payment_due" | "debt_notice";
  trade_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};
