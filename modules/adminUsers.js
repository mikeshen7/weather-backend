'use strict';

const adminUserDb = require('../models/adminUserDb');
const { OWNER_ROLE, ADMIN_ROLE, READONLY_ROLE } = require('./adminAuth');
const ALLOWED_ROLES = new Set([OWNER_ROLE, ADMIN_ROLE, READONLY_ROLE]);
const ALLOWED_LOCATION_ACCESS = new Set(['all', 'resort-only', 'non-resort-only']);

async function listUsers(request, response, next) {
  try {
    const users = await adminUserDb.find().sort({ createdAt: -1 }).lean();
    return response.status(200).send(users);
  } catch (error) {
    console.error('*** adminUsers list error:', error.message);
    return next(error);
  }
}

async function createUser(request, response, next) {
  try {
    const { email, name, roles, locationAccess } = request.body || {};
    if (!email) {
      return response.status(400).send('email is required');
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await adminUserDb.findOne({ email: normalizedEmail });
    if (existing) {
      return response.status(400).send('User already exists');
    }
    const parsedRoles = parseRoles(roles);
    if (parsedRoles.includes(OWNER_ROLE)) {
      return response.status(403).send('Cannot create owner via API');
    }
    const parsedAccess = parseLocationAccess(locationAccess);
    const user = await adminUserDb.create({
      email: normalizedEmail,
      name: name ? String(name).trim() : '',
      roles: parsedRoles.length ? parsedRoles : [ADMIN_ROLE],
      locationAccess: parsedAccess || 'all',
      status: 'active',
    });
    return response.status(201).send(user);
  } catch (error) {
    console.error('*** adminUsers create error:', error.message);
    return next(error);
  }
}

async function updateUser(request, response, next) {
  try {
    const { id } = request.params;
    const { name, roles, status, locationAccess } = request.body || {};
    const update = {};
    if (name !== undefined) update.name = String(name || '').trim();
    if (roles !== undefined) {
      const parsedRoles = parseRoles(roles);
      if (parsedRoles.includes(OWNER_ROLE)) {
        return response.status(403).send('Cannot assign owner role');
      }
      update.roles = parsedRoles.length ? parsedRoles : [ADMIN_ROLE];
    }
    if (status === 'active' || status === 'suspended') {
      update.status = status;
    }
    if (locationAccess !== undefined) {
      const parsedAccess = parseLocationAccess(locationAccess);
      if (parsedAccess) {
        update.locationAccess = parsedAccess;
      }
    }
    if (!Object.keys(update).length) {
      return response.status(400).send('No valid fields provided');
    }
    const user = await adminUserDb.findByIdAndUpdate(id, update, { new: true });
    if (!user) {
      return response.status(404).send('User not found');
    }
    return response.status(200).send(user);
  } catch (error) {
    console.error('*** adminUsers update error:', error.message);
    return next(error);
  }
}

async function deleteUser(request, response, next) {
  try {
    const { id } = request.params;
    const user = await adminUserDb.findById(id);
    if (!user) {
      return response.status(404).send('User not found');
    }
    if (user.roles && user.roles.includes(OWNER_ROLE)) {
      return response.status(403).send('Cannot delete owner');
    }
    await adminUserDb.findByIdAndDelete(id);
    return response.status(204).send();
  } catch (error) {
    console.error('*** adminUsers delete error:', error.message);
    return next(error);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};

function parseRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => String(r).trim())
    .filter((r) => ALLOWED_ROLES.has(r));
}

function parseLocationAccess(value) {
  if (!value) return '';
  const normalized = String(value).trim();
  return ALLOWED_LOCATION_ACCESS.has(normalized) ? normalized : '';
}
