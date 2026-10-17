import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';

export class OrderController {
  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idempotencyKey =
        (req.headers['idempotency-key'] as string | undefined) || req.body?.idempotency_key;

      const result = await OrderService.createOrder(
        {
          items: req.body.items,
          idempotency_key: idempotencyKey,
        },
        req.user!
      );

      const status = result.idempotent ? 200 : 201;
      res.status(status).json({
        success: true,
        data: result.order,
        idempotent: result.idempotent,
        message: result.idempotent ? 'Order already processed (idempotent result)' : 'Order created successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async confirmOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await OrderService.confirmOrder(orderId, req.user!);
      res.status(200).json({
        success: true,
        data: order,
        message: 'Order confirmed and stock successfully reserved',
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reason = req.body?.reason || 'Order cancelled by user';
      const result = await OrderService.cancelOrder(orderId, req.user!, reason);
      res.status(200).json({
        success: true,
        data: result.order,
        released_stock: result.released_stock,
        message: result.released_stock
          ? 'Order cancelled and reserved stock successfully released'
          : 'Order cancelled successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const status = req.query.status ? String(req.query.status) : undefined;
      const q = req.query.q ? String(req.query.q) : undefined;

      const result = await OrderService.getOrders({ page, limit, status, q });
      res.status(200).json({
        success: true,
        data: result.orders,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          total_pages: result.total_pages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await OrderService.getOrderById(orderId);
      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }
}
