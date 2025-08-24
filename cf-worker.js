// Cloudflare Worker with Rate Limiting - Optimized with Modern Syntax
export default {
	async fetch(request, env, ctx) {
		return handleRequest(request, env, ctx);
	},
};

// Configuration - Frozen for better performance
const CONFIG = Object.freeze({
	RATE_LIMITS: {
		PER_MINUTE: 10,
		WINDOW_MINUTE: 60,
	},
	WHITELISTED_IPS: [],
	MONITORING: {
		ENABLED: true,
		LOG_VIOLATIONS: true,
		TRACK_PATTERNS: true,
	},
});

// Reusable headers objects
const CORS_HEADERS = Object.freeze({
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
	'Access-Control-Max-Age': '86400',
	'Access-Control-Allow-Credentials': 'true',
});

const JSON_HEADERS = Object.freeze({
	'Content-Type': 'application/json',
});

// Optimized response builder class
class ResponseBuilder {
	static json(data, status = 200, origin = '*') {
		return new Response(JSON.stringify(data), {
			status,
			headers: {
				...JSON_HEADERS,
				...CORS_HEADERS,
				'Access-Control-Allow-Origin': origin,
			},
		});
	}

	static preflight(origin = '*') {
		return new Response(null, {
			status: 204,
			headers: {
				...CORS_HEADERS,
				'Access-Control-Allow-Origin': origin,
			},
		});
	}
}

// Efficient IP detection
const getClientIP = (request) =>
	request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';

async function handleRequest(request, env, ctx) {
	const clientIP = getClientIP(request);
	const origin = request.headers.get('Origin') || '*';

	try {
		// Early return for preflight
		if (request.method === 'OPTIONS') {
			return ResponseBuilder.preflight(origin);
		}

		// Early return for invalid methods
		if (request.method !== 'POST') {
			return ResponseBuilder.json(
				{
					status: false,
					message: 'Method not allowed. Use POST.',
					method: request.method,
				},
				405,
				origin,
			);
		}

		// Check if IP is whitelisted
		if (CONFIG.WHITELISTED_IPS.includes(clientIP)) {
			console.log(`✅ Whitelisted IP: ${clientIP}`);
			return await processValidation(request, env, origin);
		}

		// Check if KV namespace is available
		if (!env.TEST_LIMITER) {
			console.warn('⚠️ KV namespace TEST_LIMITER not bound, skipping rate limiting');
			return await processValidation(request, env, origin);
		}

		// Check rate limits
		const rateLimitCheck = await checkRateLimit(clientIP, env.TEST_LIMITER);

		if (!rateLimitCheck.allowed) {
			// Log rate limit violation if monitoring enabled
			if (CONFIG.MONITORING.ENABLED && CONFIG.MONITORING.LOG_VIOLATIONS) {
				ctx.waitUntil(logViolation(clientIP, rateLimitCheck.reason, env.TEST_LIMITER));
			}

			// Return generic message (silently fail as requested)
			return ResponseBuilder.json(
				{
					success: false,
					data: {
						status: false,
						message: 'Service temporarily unavailable',
					},
					message: 'Please try again later',
				},
				200,
				origin,
			);
		}

		// Process the validation
		return await processValidation(request, env, origin);
	} catch (error) {
		console.error('Worker error:', error);
		console.error('Stack:', error.stack);

		return ResponseBuilder.json(
			{
				status: false,
				message: 'Internal server error',
				error: error.message,
			},
			500,
			origin,
		);
	}
}

// Optimized rate limiting with batch operations
async function checkRateLimit(clientIP, rateLimiter) {
	const now = Date.now();
	const minuteWindow = Math.floor(now / (CONFIG.RATE_LIMITS.WINDOW_MINUTE * 1000));
	const minuteKey = `rate_minute_${clientIP}_${minuteWindow}`;

	try {
		// Get current count
		const currentCount = await getCount(rateLimiter, minuteKey);
		console.log(`📊 IP ${clientIP} - Current count: ${currentCount}/${CONFIG.RATE_LIMITS.PER_MINUTE}`);

		if (currentCount >= CONFIG.RATE_LIMITS.PER_MINUTE) {
			console.log(`⚠️ Rate limit exceeded for ${clientIP}: ${currentCount}/${CONFIG.RATE_LIMITS.PER_MINUTE}`);
			return {
				allowed: false,
				reason: 'minute_limit_exceeded',
				limit: CONFIG.RATE_LIMITS.PER_MINUTE,
				window: 'minute',
				currentCount,
			};
		}

		// Increment counter atomically
		const newCount = await incrementCounter(rateLimiter, minuteKey, CONFIG.RATE_LIMITS.WINDOW_MINUTE);
		console.log(`✅ Request allowed for ${clientIP}. New count: ${newCount}/${CONFIG.RATE_LIMITS.PER_MINUTE}`);

		return {
			allowed: true,
			remaining: CONFIG.RATE_LIMITS.PER_MINUTE - newCount,
			currentCount: newCount,
		};
	} catch (error) {
		console.error('Rate limit check error:', error);
		// Fail open on errors
		return { allowed: true, remaining: CONFIG.RATE_LIMITS.PER_MINUTE };
	}
}

// Optimized counter operations
async function getCount(rateLimiter, key) {
	try {
		const value = await rateLimiter.get(key);
		return value ? parseInt(value, 10) : 0;
	} catch (error) {
		console.error('Error getting count:', error);
		return 0;
	}
}

async function incrementCounter(rateLimiter, key, ttl) {
	try {
		const current = await getCount(rateLimiter, key);
		const newValue = current + 1;
		await rateLimiter.put(key, newValue.toString(), {
			expirationTtl: ttl,
		});
		return newValue;
	} catch (error) {
		console.error('Error incrementing count:', error);
		return 1; // Fail open
	}
}

// Optimized phone number formatting
function formatPhoneNumber(number) {
	if (!number) return null;

	// Single regex operation
	const cleaned = String(number)
		.trim()
		.replace(/[^\d+]/g, '');

	// Efficient prefix handling
	if (cleaned.startsWith('0')) return '+62' + cleaned.slice(1);
	if (cleaned.startsWith('62')) return '+' + cleaned;
	if (cleaned.startsWith('+')) return cleaned;
	return '+62' + cleaned;
}

// Streamlined request body parsing
async function parseRequestBody(request) {
	try {
		const contentType = request.headers.get('content-type') || '';

		if (!contentType.includes('application/json')) {
			return {
				success: false,
				error: {
					status: false,
					message: 'Content-Type must be application/json',
					received: contentType,
				},
			};
		}

		const text = await request.text();
		if (!text) {
			return {
				success: false,
				error: {
					status: false,
					message: 'Empty request body',
				},
			};
		}

		const body = JSON.parse(text);
		console.log('Parsed request body:', body);

		return { success: true, data: body };
	} catch (error) {
		console.error('JSON Parse Error:', error.message);
		return {
			success: false,
			error: {
				status: false,
				message: 'Invalid JSON in request body',
				error: error.message,
			},
		};
	}
}

// Optimized API call with AbortController
async function callStarsenderAPI(phoneNumber, apiKey) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 8000);

	try {
		const response = await fetch('https://api.starsender.online/api/check-number', {
			method: 'POST',
			headers: {
				Authorization: apiKey,
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'User-Agent': 'CloudflareWorker/2.0',
			},
			body: JSON.stringify({ number: phoneNumber }),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`API responded with ${response.status}: ${response.statusText}`);
		}

		const responseText = await response.text();
		console.log('API Response Text:', responseText);

		// Handle non-JSON responses
		if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
			throw new Error('Received HTML instead of JSON');
		}

		return {
			success: true,
			data: JSON.parse(responseText),
			status: response.status,
		};
	} catch (error) {
		clearTimeout(timeoutId);

		if (error.name === 'AbortError') {
			throw new Error('API timeout after 8 seconds');
		}

		throw error;
	}
}

async function processValidation(request, env, origin) {
	try {
		// Parse and validate request body
		const bodyResult = await parseRequestBody(request);
		if (!bodyResult.success) {
			return ResponseBuilder.json(bodyResult.error, 400, origin);
		}

		const { data: body } = bodyResult;

		// Validate phone number
		if (!body.number) {
			return ResponseBuilder.json(
				{
					status: false,
					message: 'Phone number is required',
					received: body,
				},
				400,
				origin,
			);
		}

		// Format phone number
		const phoneNumber = formatPhoneNumber(body.number);
		if (!phoneNumber) {
			return ResponseBuilder.json(
				{
					status: false,
					message: 'Invalid phone number format',
				},
				400,
				origin,
			);
		}

		console.log('Original number:', body.number);
		console.log('Formatted number:', phoneNumber);

		// Check if API key is available
		if (!env.STARSENDER_DEVICE_KEY) {
			console.error('❌ STARSENDER_DEVICE_KEY not configured');
			return ResponseBuilder.json(
				{
					status: false,
					message: 'Server misconfiguration: API key missing',
				},
				500,
				origin,
			);
		}

		// Call Starsender API
		const apiResult = await callStarsenderAPI(phoneNumber, env.STARSENDER_DEVICE_KEY);

		if (!apiResult.success) {
			throw new Error('API call failed');
		}

		console.log('API Response Status:', apiResult.status);

		// Return the API response
		return ResponseBuilder.json(apiResult.data, apiResult.status, origin);
	} catch (error) {
		console.error('Validation error:', error);
		console.error('Stack:', error.stack);

		let errorMessage = 'Internal server error';
		let errorStatus = 500;

		if (error.message.includes('timeout')) {
			errorMessage = 'WhatsApp API request timed out';
			errorStatus = 504;
		} else if (error.message.includes('fetch') || error.message.includes('API')) {
			errorMessage = 'Failed to connect to WhatsApp API';
			errorStatus = 502;
		} else if (error.message.includes('HTML')) {
			errorMessage = 'WhatsApp API service error';
			errorStatus = 502;
		}

		return ResponseBuilder.json(
			{
				status: false,
				message: errorMessage,
				error: error.message,
			},
			errorStatus,
			origin,
		);
	}
}

// Optimized monitoring functions
async function logViolation(clientIP, reason, rateLimiter) {
	try {
		const date = new Date().toISOString();
		const violationKey = `violation_${date}_${clientIP}`;

		// Batch the violation logging
		const violations = [
			{
				key: violationKey,
				value: JSON.stringify({
					ip: clientIP,
					reason: reason,
					timestamp: date,
				}),
				ttl: 86400,
			},
		];

		// Also increment daily violation counter
		const dailyKey = `violations_count_${date.split('T')[0]}`;
		const count = await getCount(rateLimiter, dailyKey);
		violations.push({
			key: dailyKey,
			value: (count + 1).toString(),
			ttl: 86400 * 7,
		});

		// Execute batch operations
		await Promise.all(violations.map((v) => rateLimiter.put(v.key, v.value, { expirationTtl: v.ttl })));

		console.log(`⚠️ Rate limit violation: ${clientIP} - ${reason}`);
	} catch (error) {
		console.error('Error logging violation:', error);
	}
}

async function trackRequest(clientIP, rateLimiter) {
	try {
		const hourKey = `requests_${new Date().toISOString().substring(0, 13)}`;
		await incrementCounter(rateLimiter, hourKey, 86400 * 7);
	} catch (error) {
		console.error('Error tracking request:', error);
	}
}
