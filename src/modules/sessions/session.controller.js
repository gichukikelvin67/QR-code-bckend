
import {
  openDiningSession,
  getDiningSessions,
  getDiningSessionById,
  closeDiningSession,
} from "./session.service.js";

export async function openSessionController(req, res, next) {
  try {
    const session = await openDiningSession(
      req.auth.restaurantId,
      req.body.tableId
    );

    res.status(201).json({
      success: true,
      message: "Dining session opened successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessionsController(req, res, next) {
  try {
    const sessions = await getDiningSessions(
      req.auth.restaurantId
    );

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessionController(req, res, next) {
  try {
    const session = await getDiningSessionById(
      req.auth.restaurantId,
      req.params.sessionId
    );

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

export async function closeSessionController(req, res, next) {
  try {
    const session = await closeDiningSession(
      req.auth.restaurantId,
      req.params.sessionId
    );

    res.status(200).json({
      success: true,
      message: "Dining session closed successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
}
