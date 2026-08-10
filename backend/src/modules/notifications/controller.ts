import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
  removeNotification,
} from "./service";

export async function listNotificationsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await listNotifications(
      req.organization.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("List notifications error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load notifications",
    });
  }
}

export async function unreadCountController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const count = await getUnreadCount(
      req.organization.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Unread notification count error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load unread count",
    });
  }
}

export async function markReadController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const updated = await markAsRead(
      req.organization.id,
      req.user.id,
      req.params.id
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to update notification",
    });
  }
}

export async function markAllReadController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const updated = await markAllAsRead(
      req.organization.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: { updated },
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to update notifications",
    });
  }
}

export async function deleteNotificationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const deleted = await removeNotification(
      req.organization.id,
      req.user.id,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to delete notification",
    });
  }
}
