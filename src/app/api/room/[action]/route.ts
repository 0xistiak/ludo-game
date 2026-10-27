import { NextRequest, NextResponse } from 'next/server';
import { MultiplayerService } from '@/lib/multiplayer/service';

interface ServiceErrorLike {
  message?: string;
  code?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await context.params;
    const body = await request.json();

    switch (action) {
      case 'create': {
        const result = await MultiplayerService.createRoom(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'join': {
        const result = await MultiplayerService.joinRoom(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'ready': {
        const result = await MultiplayerService.toggleReady(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'start': {
        const result = await MultiplayerService.startGame(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'leave': {
        const result = await MultiplayerService.leaveRoom(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'roll': {
        const result = await MultiplayerService.rollDiceServer(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'move': {
        const result = await MultiplayerService.makeMoveServer(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'reconnect': {
        const result = await MultiplayerService.reconnectPlayer(body);
        return NextResponse.json({ success: true, data: result });
      }

      case 'heartbeat': {
        await MultiplayerService.heartbeat(body);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const errorObj = err as ServiceErrorLike;
    const message = errorObj?.message || 'Internal server error';
    const code = errorObj?.code || 'INTERNAL_ERROR';
    console.error('[API Room Error]:', message, code);

    return NextResponse.json(
      {
        success: false,
        error: message,
        code,
      },
      { status: code === 'VERSION_CONFLICT' ? 409 : 400 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await context.params;
    const url = new URL(request.url);

    if (action === 'get') {
      const code = url.searchParams.get('code') || undefined;
      const id = url.searchParams.get('id') || undefined;
      const sessionId = url.searchParams.get('sessionId') || request.headers.get('x-session-id') || undefined;
      const result = await MultiplayerService.getRoomData({ code, id, sessionId });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported GET action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
