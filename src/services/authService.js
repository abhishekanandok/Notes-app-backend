const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/database');

const generateToken = (id) => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

const register = async (userData) => {
  const { email, username, password } = userData;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username }
      ]
    }
  });

  if (existingUser) {
    throw new Error('User with this email or username already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true,
    }
  });

  // Generate token
  const token = generateToken(user.id);

  return {
    success: true,
    token,
    user
  };
};

const login = async (loginData) => {
  const { email, password } = loginData;

  // Check for user
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Generate token
  const token = generateToken(user.id);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
    }
  };
};

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true,
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    success: true,
    user
  };
};

module.exports = {
  register,
  login,
  getMe,
  generateToken
};
