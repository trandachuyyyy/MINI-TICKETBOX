/**
 * Anonymous "who is this browser" id, generated once and reused. Lets a
 * user refresh the checkout page (or get knocked offline briefly) and still
 * own/recover their own hold, without requiring a login system for this demo.
 */
// export function getClientId(): string {
//   if (typeof window === 'undefined') return '';
//   const key = 'ticketbox_client_id';
//   let id = window.localStorage.getItem(key);
//   if (!id) {
//     id = crypto.randomUUID();
//     window.localStorage.setItem(key, id);
//   }
//   return id;
// }

export function getClientId(): string {
  if (typeof window === 'undefined') return '';

  const key = 'ticketbox_client_id';
  let id = window.localStorage.getItem(key);

  if (!id) {
    if (
      typeof window.crypto !== 'undefined' &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      id = window.crypto.randomUUID();
    } else {
      // Fallback cho trình duyệt không hỗ trợ
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    window.localStorage.setItem(key, id);
  }

  return id;
}
