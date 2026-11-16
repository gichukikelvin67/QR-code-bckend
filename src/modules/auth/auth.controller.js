import { registerOwner, 
  login,
  refreshSession,
  logout} from "./auth.service.js";


function setRefreshCookie(res,token){
    res.cookie("refreshToken",token,{
 httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function register(req, res, next) {
  try {
    const result = await registerOwner(req.body);

    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      message: "Restaurant registered successfully.",
      data: {
        user: result.user,
        restaurant: result.restaurant,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function loginUser(req, res, next) {
  try {
    const result = await login(req.body);

    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: result.user,
        restaurant: result.restaurant,
        role: result.role,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}
    //refresh token is not stored in json is stored in cookie parase

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
};

export async function refresh(req, res, next) {
  try {
    const result = await refreshSession(req.cookies?.refreshToken);

    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      message: "Session refreshed successfully.",
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutUser(req, res, next) {
  try {
    await logout(req.cookies?.refreshToken);

    res.clearCookie("refreshToken", refreshCookieOptions);

    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export function getCurrentUser(req, res) {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.auth.userId,
        name: req.auth.name,
        email: req.auth.email,
      },
      restaurantId: req.auth.restaurantId,
      membershipId: req.auth.membershipId,
      role: req.auth.role,
    },
  });
}
