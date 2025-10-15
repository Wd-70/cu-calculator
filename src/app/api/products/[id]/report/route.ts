import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import ModificationHistory from '@/lib/models/ModificationHistory';

/**
 * POST /api/products/:id/report
 * Report incorrect product information
 */
export async function POST(
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

    const { reason } = await request.json();

    const userIdentifier =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'anonymous';

    // Increment report count
    product.reportCount += 1;
    await product.save();

    // Log modification history
    await ModificationHistory.create({
      productId: product._id,
      action: 'report',
      modifiedBy: userIdentifier,
      modifiedAt: new Date(),
      ipAddress: userIdentifier,
      afterData: { reason },
    });

    return NextResponse.json({
      success: true,
      reportCount: product.reportCount,
    });
  } catch (error) {
    console.error('Error reporting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to report product' },
      { status: 500 }
    );
  }
}
