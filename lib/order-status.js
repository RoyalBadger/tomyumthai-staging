// Order status lifecycle. pending_payment is entered only by /api/orders and exited only
// by the Stripe webhook; the kitchen moves orders along the rest of the chain.
export const KITCHEN_STATUSES = ['received', 'cooking', 'ready', 'completed'];

const ALLOWED = {
  received: ['cooking', 'canceled'],
  cooking: ['ready', 'canceled'],
  ready: ['completed'],
  completed: [],
  canceled: [],
  pending_payment: [], // webhook-only; the kitchen never touches unpaid orders
};

export function canTransition(from, to) {
  return (ALLOWED[from] || []).includes(to);
}
