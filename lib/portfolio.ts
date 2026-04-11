const aznFormatter = new Intl.NumberFormat("az-AZ", {
  style: "currency",
  currency: "AZN",
  maximumFractionDigits: 2,
});

export const formatAzn = (n: number) => aznFormatter.format(n);

export const formatPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const formatUnits = (n: number) =>
  new Intl.NumberFormat("az-AZ", {
    maximumFractionDigits: 4,
  }).format(n);
