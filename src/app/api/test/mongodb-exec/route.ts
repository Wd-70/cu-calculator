import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { isAdmin } from '@/lib/adminAuth';

// 사용 가능한 모델들
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import Product from '@/lib/models/Product';

const MODELS: Record<string, any> = {
  Promotion,
  PromotionIndex,
  Product,
};

interface MongoDBCommand {
  type: 'find' | 'findOne' | 'insertOne' | 'insertMany' | 'updateOne' | 'updateMany' | 'deleteOne' | 'deleteMany' | 'aggregate' | 'countDocuments' | 'distinct';
  model: string;
  filter?: any;
  data?: any;
  update?: any;
  options?: any;
  pipeline?: any[];
  field?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { accountAddress, commands } = await request.json();

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!commands || !Array.isArray(commands)) {
      return NextResponse.json(
        { success: false, error: '명령 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    await connectDB();

    const results = [];

    for (const command of commands as MongoDBCommand[]) {
      try {
        const { type, model, filter, data, update, options, pipeline, field } = command;

        // 모델 확인
        if (!MODELS[model]) {
          results.push({
            success: false,
            error: `모델 ${model}을(를) 찾을 수 없습니다. 사용 가능한 모델: ${Object.keys(MODELS).join(', ')}`,
            command,
          });
          continue;
        }

        const Model = MODELS[model];
        let result;

        switch (type) {
          case 'find':
            result = await Model.find(filter || {}, null, options).lean();
            break;

          case 'findOne':
            result = await Model.findOne(filter || {}, null, options).lean();
            break;

          case 'insertOne':
            result = await Model.create(data);
            break;

          case 'insertMany':
            result = await Model.insertMany(data);
            break;

          case 'updateOne':
            result = await Model.updateOne(filter || {}, update, options);
            break;

          case 'updateMany':
            result = await Model.updateMany(filter || {}, update, options);
            break;

          case 'deleteOne':
            result = await Model.deleteOne(filter || {});
            break;

          case 'deleteMany':
            result = await Model.deleteMany(filter || {});
            break;

          case 'aggregate':
            result = await Model.aggregate(pipeline || []);
            break;

          case 'countDocuments':
            result = await Model.countDocuments(filter || {});
            break;

          case 'distinct':
            result = await Model.distinct(field, filter || {});
            break;

          default:
            results.push({
              success: false,
              error: `알 수 없는 명령 타입: ${type}`,
              command,
            });
            continue;
        }

        results.push({
          success: true,
          type,
          model,
          result,
          resultCount: Array.isArray(result) ? result.length : undefined,
        });

      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          command,
        });
      }
    }

    return NextResponse.json({
      success: true,
      executedCommands: commands.length,
      results,
    });

  } catch (error: any) {
    console.error('MongoDB exec error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute MongoDB commands',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
