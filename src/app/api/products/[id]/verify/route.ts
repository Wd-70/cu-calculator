import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import ModificationHistory from '@/lib/models/ModificationHistory';

/**
 * POST /api/products/:id/verify
 * Verify product information
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

    const userIdentifier =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'anonymous';

    // Increment verification count
    product.verificationCount += 1;

    // Mark as verified if threshold met (e.g., 3 verifications)
    if (product.verificationCount >= 3) {
      product.isVerified = true;
    }

    await product.save();

    // Log modification history
    await ModificationHistory.create({
      productId: product._id,
      action: 'verify',
      modifiedBy: userIdentifier,
      modifiedAt: new Date(),
      ipAddress: userIdentifier,
    });

    return NextResponse.json({
      success: true,
      verificationCount: product.verificationCount,
      isVerified: product.isVerified,
    });
  } catch (error) {
    console.error('Error verifying product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify product' },
      { status: 500 }
    );
  }
}
