import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

// GET /api/products - List / search products for all authenticated roles
router.get('/', authenticate, ProductController.getProducts);

// POST /api/products - Admin-only product creation
router.post('/', authenticate, requireRole('admin'), ProductController.createProduct);

// PATCH /api/products/:id - Admin-only product updates & deactivation
router.patch('/:id', authenticate, requireRole('admin'), ProductController.updateProduct);

// GET /api/products/:id - Get single product details
router.get('/:id', authenticate, ProductController.getProductById);

export default router;
