import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/studio?name=Alice&type=LIB_CHARACTER
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');
        const type = searchParams.get('type');

        if (!name || !type) {
            return NextResponse.json(
                { error: 'Missing name or type parameter' },
                { status: 400 }
            );
        }

        const asset = await db.studioItem.findFirst({
            where: { name, type },
            include: {
                media: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!asset) {
            return NextResponse.json(
                { error: 'Studio asset not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(asset);
    } catch (error) {
        console.error('[Studio GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch studio asset' },
            { status: 500 }
        );
    }
}

// PUT /api/studio - Update Studio asset (description, etc.)
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, type, description, notes } = body;

        if (!name || !type) {
            return NextResponse.json(
                { error: 'Missing name or type' },
                { status: 400 }
            );
        }

        // Build update data object
        const updateData: any = {};
        if (description !== undefined) updateData.description = description;
        if (notes !== undefined) updateData.notes = notes;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        const updated = await db.studioItem.updateMany({
            where: { name, type },
            data: updateData
        });

        if (updated.count === 0) {
            return NextResponse.json(
                { error: 'Studio asset not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            updated: updated.count
        });
    } catch (error) {
        console.error('[Studio PUT] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update studio asset' },
            { status: 500 }
        );
    }
}
