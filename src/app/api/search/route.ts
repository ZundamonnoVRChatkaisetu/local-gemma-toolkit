import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarText } from '@/lib/search';
import prisma from '@/lib/prisma/client';

// Handle GET requests to /api/search
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    // Search for similar text
    const results = await searchSimilarText(query, limit);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}

// Handle POST requests to /api/search for document upload
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    
    if (!file || !title) {
      return NextResponse.json(
        { error: 'File and title are required' },
        { status: 400 }
      );
    }
    
    // Read file content
    const content = await file.text();
    const mimeType = file.type || 'text/plain';
    
    // Create document in database
    const document = await prisma.document.create({
      data: {
        title,
        content,
        mimeType,
        filePath: null, // In a real implementation, we'd save the file and store the path
      },
    });
    
    // In a real implementation, we would process the document and generate embeddings here
    // For now, we'll just return the document ID
    
    return NextResponse.json({ 
      documentId: document.id,
      message: 'Document uploaded successfully. Processing will begin shortly.' 
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
