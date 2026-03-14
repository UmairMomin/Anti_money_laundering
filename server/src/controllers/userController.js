import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";

const generateToken = (id) => signToken({ id }, { expiresIn: "30d" });

// @desc    Google login/signup (simple)
// @route   POST /api/users/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide name, email, and password" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ name, email, password });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
