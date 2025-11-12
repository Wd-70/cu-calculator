import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import ModificationHistory from '@/lib/models/ModificationHistory';
import DiscountRule from '@/lib/models/DiscountRule';

/**
 * GET /api/products/:id
 * Get a single product with applicable discounts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const product = await Product.findById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Find applicable discounts
    const now = new Date();
    const discounts = await DiscountRule.find({
      isActive: true,
      validFrom: { $lte: now } as any,
      validTo: { $gte: now } as any,
      $or: [
        { applicableProducts: product._id },
        { applicableCategories: product.category },
        {
          applicableProducts: { $size: 0 } as any,
          applicableCategories: { $size: 0 } as any,
        },
      ] as any,
    } as any).sort({ applicationOrder: 1 });

    return NextResponse.json({
      success: true,
      data: product,
      discounts,
      source: 'local',
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/:id
 * Update a product
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const product = await Product.findById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const beforeData = product.toObject();
    const body = await request.json();

    const userIdentifier =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'anonymous';

    // Update product
    Object.assign(product, body);
    product.lastModifiedBy = userIdentifier;
    product.modificationCount += 1;
    await product.save();

    // Log modification history
    await ModificationHistory.create({
      productId: product._id,
      action: 'update',
      beforeData,
      afterData: product.toObject(),
      modifiedBy: userIdentifier,
      modifiedAt: new Date(),
      ipAddress: userIdentifier,
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}
