import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';

export class ProductController {
  static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.createProduct(req.body, req.user!);
      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, status, low_stock } = req.query;
      const products = await ProductService.getProducts({
        q: q ? String(q) : undefined,
        status: status ? String(status) : undefined,
        low_stock: low_stock === 'true',
      });
      res.status(200).json({
        success: true,
        data: products,
        total: products.length,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductService.updateProduct(productId, req.body, req.user!);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductService.getProductById(productId);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }
}
