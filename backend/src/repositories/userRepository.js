import User from '../models/User.js';

export const userRepository = {
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

  async findById(id) {
    const user = await User.findById(id).lean();
    if (!user) return null;
    user.id = user._id.toString();
    delete user._id;
    delete user.__v;
    return user;
  },

  async findByEmail(email) {
    if (!email) return null;
    const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
    if (!user) return null;
    user.id = user._id.toString();
    delete user._id;
    delete user.__v;
    return user;
  },

  async findByUsername(username) {
    if (!username) return null;
    const user = await User.findOne({ username: username.trim().toLowerCase() }).lean();
    if (!user) return null;
    user.id = user._id.toString();
    delete user._id;
    delete user.__v;
    return user;
  },

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

    const users = await User.find(filter).sort({ fullName: 1 }).lean();

    return users.map((u) => {
      u.id = u._id.toString();
      delete u._id;
      delete u.__v;
      return this.sanitizeUser(u);
    });
  },

  async update(id, updateData) {
    const user = await User.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!user) return null;
    user.id = user._id.toString();
    delete user._id;
    delete user.__v;
    return this.sanitizeUser(user);
  },

  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }
};
