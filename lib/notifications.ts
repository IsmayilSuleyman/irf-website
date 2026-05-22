export type NotificationRow = {
  id: string;
  kind: "match" | "settled";
  trade_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};
