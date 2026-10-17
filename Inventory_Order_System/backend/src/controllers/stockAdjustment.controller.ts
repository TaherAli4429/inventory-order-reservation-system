import { Request, Response, NextFunction } from 'express';
import { StockAdjustmentService } from '../services/stockAdjustment.service';

export class StockAdjustmentController {
  static async createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await StockAdjustmentService.adjustStock(req.body, req.user!);
      res.status(201).json({
        success: true,
        data: result.adjustment,
        product: result.product,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.query.product_id ? String(req.query.product_id) : undefined;
      const adjustments = await StockAdjustmentService.getStockAdjustments(productId);
      res.status(200).json({
        success: true,
        data: adjustments,
        total: adjustments.length,
      });
    } catch (err) {
      next(err);
    }
  }
}
