export type ShareCardAccessCodeProps = {
  cardId: string;
};

export type ExpireOption = {
  value: number;
  label: string;
  description: string;
};

export type UseShareCardAccessCodeArgs = {
  cardId: string;
  isWizardFlow: boolean;
};
