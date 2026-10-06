/**
 * PromptPay EMVCo QR Code Generator
 * Generates standard Bank-Compliant PromptPay QR Code payload for Thai Mobile / National ID.
 */

// CRC16-CCITT calculation for EMVCo QR
function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    let c = data.charCodeAt(i);
    crc ^= (c << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  let hex = crc.toString(16).toUpperCase();
  return ('0000' + hex).slice(-4);
}

function formatTag(id, val) {
  const len = ('00' + val.length).slice(-2);
  return id + len + val;
}

export function generatePromptPayPayload(targetPhone, amount) {
  // Clean phone number (e.g. 0950259996 -> 0066950259996)
  let clean = targetPhone.replace(/[^0-9]/g, '');
  let formattedTarget = clean;
  if (clean.length === 10 && clean.startsWith('0')) {
    formattedTarget = '0066' + clean.slice(1);
  }

  // Merchant Account Info (Tag 29 for PromptPay)
  const aid = formatTag('00', 'A000000677010111');
  const targetTag = formatTag('01', formattedTarget);
  const tag29 = formatTag('29', aid + targetTag);

  // Payload components
  const tag00 = formatTag('00', '01'); // Version
  const tag01 = formatTag('01', amount > 0 ? '12' : '11'); // 11 = Static, 12 = Dynamic
  const tag53 = formatTag('53', '764'); // Currency: THB
  const tag58 = formatTag('58', 'TH');  // Country: Thailand
  
  let tag54 = '';
  if (amount && amount > 0) {
    const formattedAmount = Number(amount).toFixed(2);
    tag54 = formatTag('54', formattedAmount);
  }

  let raw = tag00 + tag01 + tag29 + tag53 + tag54 + tag58 + '6304';
  const checksum = crc16(raw);
  return raw + checksum;
}

export function getPromptPayQRUrl(phone, amount) {
  const payload = generatePromptPayPayload(phone, amount);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(payload)}`;
}
