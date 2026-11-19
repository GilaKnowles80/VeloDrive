// src/utils/currency.js

export const formatCurrency = (amount, currencyCode = 'PHP') => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
};

// Example usage in your React components:
// formatCurrency(499) -> "₱499.00"
// formatCurrency(4999) -> "₱4,999.00"