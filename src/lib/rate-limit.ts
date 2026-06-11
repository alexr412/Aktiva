import { NextRequest } from 'next/server';

const ipCache = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(req: Request | NextRequest, limit = 60, windowMs = 60000): { success: boolean; headers: HeadersInit } {
  // Get IP address safely from headers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'anonymous';

  const now = Date.now();
  const clientData = ipCache.get(ip);

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize
    ipCache.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(limit - 1),
        'X-RateLimit-Reset': String(Math.ceil((now + windowMs) / 1000)),
      }
    };
  }

  if (clientData.count >= limit) {
    return {
      success: false,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(clientData.resetTime / 1000)),
      }
    };
  }

  clientData.count++;
  return {
    success: true,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(limit - clientData.count),
      'X-RateLimit-Reset': String(Math.ceil(clientData.resetTime / 1000)),
    }
  };
}
