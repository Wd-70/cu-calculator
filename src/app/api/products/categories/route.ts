import { NextResponse } from 'next/server';
import Product from '@/lib/models/Product';
import connectDB from '@/lib/mongodb';

/**
 * GET /api/products/categories
 * Get all unique categories from categoryTags
 */
export async function GET() {
  try {
    await connectDB();

    // MongoDB aggregation to extract all unique category names from categoryTags array
    const result = await Product.aggregate([
      { $match: { categoryTags: { $exists: true, $ne: null, $not: { $size: 0 } } } } as any,
      { $unwind: '$categoryTags' },
      { $group: { _id: '$categoryTags.name' } },
      { $sort: { _id: 1 } }
    ]);

    const categories = result.map(item => item._id);

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
