
import { z } from "zod";
import {
  getPreparationQueue,
  updatePreparationStatus,
} from "./preparation.service.js";

const itemIdSchema = z.string().uuid();

const updateStatusSchema = z.object({
  status: z.enum(["PREPARING", "READY"]),
});

export function createPreparationController(station) {
  return {
    getQueue: async (req, res, next) => {
      try {
        const items = await getPreparationQueue(
          req.auth.restaurantId,
          station
        );

        return res.status(200).json({
          success: true,
          station,
          count: items.length,
          data: items,
        });
      } catch (error) {
        next(error);
      }
    },

    updateStatus: async (req, res, next) => {
      try {
        const { itemId } = req.params;

        const validItemId = itemIdSchema.safeParse(itemId);

        if (!validItemId.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid order item ID.",
          });
        }

        const validation = updateStatusSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid preparation status.",
            errors: validation.error.issues,
          });
        }

        const item = await updatePreparationStatus({
          restaurantId: req.auth.restaurantId,
          itemId,
          station,
          newStatus: validation.data.status,
        });

        return res.status(200).json({
          success: true,
          message: "Preparation status updated.",
          data: item,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
