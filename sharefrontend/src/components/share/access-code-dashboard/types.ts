export type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;
