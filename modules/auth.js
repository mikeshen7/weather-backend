'use strict';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

function requireAdminToken(request, response, next) {
  if (!ADMIN_TOKEN) {
    return response.status(500).send('Admin token not configured');
  }
  const token = request.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return response.status(401).send('Unauthorized');
  }
  return next();
}

module.exports = { requireAdminToken };
