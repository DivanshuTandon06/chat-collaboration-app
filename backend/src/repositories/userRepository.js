
import User from '../models/User.js';

export const userRepository = {
  // Create a new user
  async create({ username, email, password, fullName, statusMessage }) {
    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName ? fullName.trim() : username.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName || username)}`,
      statusMessage: statusMessage ? statusMessage.trim() : 'Available to collaborate'
    });

    return this.sanitizeUser(user.toJSON());
  },

  // Find user by ID without exposing password
  async findById(id) {
    const user = await User.findById(id).lean();
    if (!user) return null;

    return this._formatUser(user);
  },

  // Find user by ID including password (for password change)
  async findByIdWithPassword(id) {
    const user = await User.findById(id).select('+password').lean();
    if (!user) return null;

    return this._formatUser(user, true);
  },

  // Find user by email (password is needed for login)
  async findByEmail(email) {
    if (!email) return null;

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).lean();

    if (!user) return null;

    return this._formatUser(user, true);
  },

  // Find user by username (password is needed for login)
  async findByUsername(username) {
    if (!username) return null;

    const user = await User.findOne({
      username: username.trim().toLowerCase()
    }).lean();

    if (!user) return null;

    return this._formatUser(user, true);
  },

  // Find all users with optional search
  async findAll({ excludeUserId = null, query = '' } = {}) {
    const filter = {};

    if (excludeUserId) {
      filter._id = { $ne: excludeUserId };
    }

    if (query && query.trim()) {
      const q = query.trim();
      const regex = new RegExp(q, 'i');

      filter.$or = [
        { username: regex },
        { fullName: regex },
        { email: regex }
      ];
    }

    const users = await User.find(filter)
      .sort({ fullName: 1 })
      .lean();

    return users.map((user) => this._formatUser(user));
  },

  // Update user profile
  async update(id, updateData) {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { ...updateData, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();

    if (!user) return null;

    return this._formatUser(user);
  },

  // Update password
  async updatePassword(id, hashedPassword) {
    return User.findByIdAndUpdate(
      id,
      { $set: { password: hashedPassword } },
      { new: true }
    );
  },

  // Convert MongoDB _id into normal id
  _formatUser(user, includePassword = false) {
    const obj = {
      ...user,
      id: user._id ? user._id.toString() : user.id
    };

    delete obj._id;
    delete obj.__v;

    if (!includePassword) {
      delete obj.password;
    }

    return obj;
  },

  // Remove password before sending user data to frontend
  sanitizeUser(user) {
    if (!user) return null;

    const { password, ...safeUser } = user;
    return safeUser;
  }
};
