export const COMMISSION = 0.03;

export const buyPrice = (current: number): number => current * (1 + COMMISSION);
export const sellPrice = (current: number): number => current * (1 - COMMISSION);
