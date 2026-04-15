export function luhnCheck(number) {
  const digits = number.replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (isEven) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

export function detectCardBrand(number) {
  const digits = number.replace(/\s/g, '');
  if (/^4/.test(digits)) return 'visa';
  if (/^5[1-5]/.test(digits) || (/^2/.test(digits) && parseInt(digits.slice(0, 4)) >= 2221 && parseInt(digits.slice(0, 4)) <= 2720)) {
    return 'mastercard';
  }
  return 'unknown';
}

export function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

export function validateExpiry(mmYY) {
  const [mm, yy] = mmYY.split('/');
  if (!mm || !yy || mm.length !== 2 || yy.length !== 2) return false;
  const month = parseInt(mm, 10);
  const year = parseInt('20' + yy, 10);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const expiry = new Date(year, month - 1, 1);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  return expiry >= current;
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
