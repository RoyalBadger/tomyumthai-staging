// GET /api/admin/me — who am I (session check for the portal shell).
import { requireAdmin } from '../../lib/auth.js';

export default requireAdmin(async (req, res, admin) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ email: admin.email, role: admin.role });
});
